#!/usr/bin/env python3
"""Builds the site's HTML pages. Python standard library only.

  python3 build.py                     build once
  python3 build.py --serve             preview at http://localhost:8123, rebuilding on save
  python3 build.py --new SLUG "Title"  start a new module

Reads   site.json, templates/*.html, modules/<slug>/article.html
Writes  index.html and modules/<slug>/index.html  (never edit these by hand)
"""
import hashlib, html, json, re, sys, threading, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = 8123


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def tpl(name):
    return read(f"templates/{name}.html")


def esc(text):
    return html.escape(text, quote=True)


def fill(text, root, **values):
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", value)

    def asset(match):  # a short fingerprint makes browsers fetch changed files at once
        file = ROOT / match[1]
        digest = hashlib.sha1(file.read_bytes()).hexdigest()[:8] if file.exists() else "missing"
        return f"{root}{match[1]}?v={digest}"

    return re.sub(r"\{\{asset:([^}]+)\}\}", asset, text).replace("{{root}}", root)


def load(slug):
    """An article is `key: value` lines between two --- lines, then HTML."""
    _, front, body = read(f"modules/{slug}/article.html").split("---\n", 2)
    meta = {k.strip(): v.strip() for k, v in (line.split(":", 1) for line in front.strip().splitlines())}
    return {"slug": slug, "body": body.strip(), **meta}


def cards(modules, root, eager):
    return "".join(
        fill(tpl("card").replace("{{slug}}", m["slug"]), root, title=esc(m["title"]),
             loading="" if eager else 'loading="lazy"')
        for m in modules)


def write_page(out, root, site, main, **values):
    defaults = {"head": "", "scripts": "", "og_type": "website", "site_title": esc(site["title"])}
    text = fill(tpl("base").replace("{{main}}", main), root, **{**defaults, **values})
    left = re.search(r"\{\{[^}]*\}\}", text)
    if left:
        raise ValueError(f"{out}: unfilled placeholder {left[0]}")
    (ROOT / out).write_text(text, encoding="utf-8")


def build():
    site = json.loads(read("site.json"))
    modules = [load(slug) for slug in site["modules"]]
    title, tagline = esc(site["title"]), esc(site["tagline"])

    def thumb(m):
        return f'{site["url"]}modules/{m["slug"]}/thumbnail.jpg'

    write_page("index.html", "./", site, page="home", page_title=title, og_title=title, description=tagline,
               url=site["url"], og_image=thumb(modules[0]),
               main=fill(tpl("home"), "./", tagline=tagline, cards=cards(modules, "./", True)))

    for m in modules:
        slug, root = m["slug"], "../../"
        css = ["assets/css/interactive.css", f"modules/{slug}/interactive.css"]
        names = [n.strip() for n in m.get("scripts", "interactive.js").split(",")]
        js = ["assets/js/interactive.js"] + [f"modules/{slug}/{n}" for n in names]
        body = m["body"].replace("<!-- interactive -->", tpl("interactive").replace("{{slug}}", slug).strip())
        write_page(f"modules/{slug}/index.html", root, site, page="module",
                   page_title=f'{esc(m["title"])} | {title}', og_title=esc(m["title"]), og_type="article",
                   description=esc(m["summary"]), url=f'{site["url"]}modules/{slug}/', og_image=thumb(m),
                   head="".join(f'<link rel="stylesheet" href="{{{{asset:{c}}}}}">\n' for c in css),
                   scripts="".join(f'<script src="{{{{asset:{j}}}}}" defer></script>\n' for j in js),
                   main=fill(tpl("module"), root, title=esc(m["title"]), body=body,
                             cards=cards([o for o in modules if o is not m], root, False)))
    print(f"built homepage and {len(modules)} modules")


def new(slug, title):
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", slug):
        sys.exit("The slug must be lowercase words joined by hyphens, such as dna-to-protein")
    folder = ROOT / "modules" / slug
    if folder.exists():
        sys.exit(f"modules/{slug} already exists")
    folder.mkdir(parents=True)
    for file in sorted((ROOT / "templates/new-module").iterdir()):
        text = file.read_text(encoding="utf-8").replace("{{slug}}", slug).replace("{{title}}", title)
        (folder / file.name).write_text(text, encoding="utf-8")
    site = json.loads(read("site.json"))
    site["modules"].insert(0, slug)
    (ROOT / "site.json").write_text(json.dumps(site, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"created modules/{slug}")


def serve():
    from functools import partial
    from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

    class Handler(SimpleHTTPRequestHandler):
        def end_headers(self):
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

        def log_message(self, *args):
            pass

    def stamp():  # latest change to any source file; generated pages are left out
        files = [ROOT / "site.json", *ROOT.glob("templates/**/*"), *ROOT.glob("assets/**/*"), *ROOT.glob("modules/*/*")]
        return max(f.stat().st_mtime for f in files if f.is_file() and f.name != "index.html")

    server = ThreadingHTTPServer(("127.0.0.1", PORT), partial(Handler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print(f"preview: http://localhost:{PORT}  (Ctrl+C to stop)", flush=True)
    seen = stamp()
    while True:
        time.sleep(.5)
        try:
            now = stamp()
            if now != seen:
                seen = now
                build()
        except Exception as error:  # keep serving while a file is half edited
            print("build failed:", error, flush=True)


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["--new"]:
        if len(args) != 3:
            sys.exit('usage: python3 build.py --new SLUG "Title"')
        new(args[1], args[2])
    build()
    if args[:1] == ["--serve"]:
        try:
            serve()
        except KeyboardInterrupt:
            pass
