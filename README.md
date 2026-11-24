# Dr. Rainbow's Interactive Science

Live at https://mattrainbow.github.io/biology-website/

## Where things are

```
assets/css/tokens.css     fonts, text sizes, colors: change the whole site here
assets/css/site.css       page layout and text styles
assets/css/interactive.css  shared look of every interactive (stage, buttons, sliders)
assets/js/                shared scripts
modules/<name>/           one folder per module, with everything it needs:
    article.html            title, summary and the text of the page
    interactive.js          the interactive
    interactive.css         styles only this module needs
    thumbnail.jpg           homepage picture
    index.html              built page (don't edit)
site.json                 site title, tagline, and the order of modules
templates/                page shells: header, footer, homepage, cards
build.py                  builds the pages
tools/thumbnails.py       retakes thumbnails
```

The forelimbs module is split further: `data.js` (the animals), `skeleton.js` (bone
positions), `renderer.js` (3D drawing) and `interactive.js` (controls and labels).

## Working on it

Preview, rebuilding each time you save:

```
python3 build.py --serve
```

Then open http://localhost:8123/modules/finch-beak/ (or any module) and refresh after saving.

- **Change fonts, sizes or colors:** edit `assets/css/tokens.css`.
- **Edit a module's text:** edit its `article.html`. `<!-- interactive -->` marks where the interactive goes.
- **Edit an interactive:** edit the `.js` files in its folder.
- **Add a module:** `python3 build.py --new dna-to-protein "From DNA to protein"`
- **Retake a thumbnail:** `python3 tools/thumbnails.py finch-beak`
- **Publish:** run `python3 build.py`, commit, and push `main`. GitHub Pages updates in a minute or two.
