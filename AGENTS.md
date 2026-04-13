# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

"Ruleta de Pendientes" is a zero-dependency static web application (vanilla HTML/CSS/JS). There is no package manager, no build step, no backend, and no database. All state is in-memory.

### Running the dev server

Serve the files with any static HTTP server from the workspace root:

```sh
python3 -m http.server 8080 --bind 0.0.0.0
```

The app is then available at `http://localhost:8080`.

### Lint / Test / Build

- **Lint**: No linter is configured. You can optionally validate HTML with an online validator or run `npx htmlhint index.html` as a quick check.
- **Tests**: No automated test suite exists. Validate changes manually in a browser.
- **Build**: There is no build step; the source files are production-ready as-is.

### Key files

| File | Purpose |
|---|---|
| `index.html` | Single-page HTML shell (Spanish language) |
| `app.js` | All application logic (IIFE, Canvas wheel, DOM manipulation) |
| `styles.css` | Dark-mode responsive styles |

### Gotchas

- The app uses the Canvas API to draw the spinning wheel; changes to wheel rendering must be tested visually.
- External resources (Google Fonts, Giphy GIFs) require internet access but the app degrades gracefully without them.
- No localStorage or persistence — refreshing the page resets all tasks.
