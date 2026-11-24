# Working in this repo

Static site for GitHub Pages. No frameworks, no packages, Python standard library for the build.
README.md has the folder map and commands.

- Never edit `index.html` or `modules/*/index.html`; edit sources and run `python3 build.py`. Commit the built pages.
- Page fonts, sizes and colors come only from `assets/css/tokens.css`. Canvas text reads them with `IX.token()`.
- Figures keep a dark stage in both light and dark mode.
- Interactives: call `IX.define(slug, root => ...)`, animate with `IX.runner` (it handles off-screen pausing and
  slow devices), use the `.ix-*` classes for controls, and set `root.interactive = { thumbnail() {...} }`.
- Extra scripts are listed in article.html front matter: `scripts: a.js, interactive.js`.
- Must run well on weak devices. Measured traps: `alpha: false` canvases and full-shape `ctx.clip()` are very slow
  without a GPU. Batch paths by color, bake finished work into an offscreen canvas, avoid layout reads per frame.
- Let the page scroll: no plain-wheel zoom, `touch-action: pan-y` on draggable canvases.
- Keep all paths relative. Don't add third-party requests.
