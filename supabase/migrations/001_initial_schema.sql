-- Ruleta: perfiles y eventos de actividad (ejecutar en Supabase SQL Editor o vía CLI)
-- Requiere extensión pgcrypto para gen_random_uuid (habilitada por defecto en Supabase)

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_user_created_idx
  on public.activity_events (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.activity_events enable row level security;

-- Perfil: lectura y actualización solo del propio usuario (la fila la crea el trigger)
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Eventos: inmutable desde el cliente; solo insert y select propios
create policy "activity_events_select_own"
  on public.activity_events for select
  using (auth.uid() = user_id);

create policy "activity_events_insert_own"
  on public.activity_events for insert
  with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'Usuario'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

-- Si tu instancia rechaza "execute function", usa en su lugar: execute procedure public.handle_new_user();
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Puntuación total (todos los eventos del usuario); el historial en la app sigue limitado a 50 filas.
create or replace function public.user_activity_score()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    sum(
      case event_type
        when 'spin' then 1
        when 'task_completed' then 10
        when 'task_added' then 1
        else 0
      end
    ),
    0
  )::integer
  from public.activity_events
  where user_id = auth.uid();
$$;

revoke all on function public.user_activity_score() from public;
grant execute on function public.user_activity_score() to authenticated;
