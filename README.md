# Dr. Rainbow's Interactive Science

Static site hosted on GitHub Pages. No build step and no dependencies.

- `index.html`: homepage
- `assets/`: shared site styles and icon
- `interactives/<name>/`: one self-contained module per interactive

## Embedding an interactive

```html
<link rel="stylesheet" href="interactives/finch-beak/finch-beak.css">
<div data-interactive="finch-beak"></div>
<script src="interactives/finch-beak/finch-beak.js" defer></script>
```

## Conventions

- All paths are relative, so the site works at any address.
- Interactives pause when off screen or in a background tab, and lower their own
  resolution on slow devices.

## Preview locally

```
python3 -m http.server 8123
```
