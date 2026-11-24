#!/usr/bin/env python3
"""Retakes module thumbnails from the live interactives (macOS, needs Google Chrome).

  python3 tools/thumbnails.py              all modules
  python3 tools/thumbnails.py forelimbs    just one

Each interactive decides its own picture in root.interactive.thumbnail().
"""
import functools, http.server, json, subprocess, sys, tempfile, threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PAGE = """<!doctype html><link rel="stylesheet" href="/assets/css/tokens.css"><link rel="stylesheet" href="/assets/css/interactive.css">
<link rel="stylesheet" href="/modules/SLUG/interactive.css">
<style>html,body{margin:0;overflow:hidden;background:#000}.ix-stage{width:1200px!important;height:750px!important;max-height:none!important;border:0!important;border-radius:0!important}.ix-stage::before{display:none!important}.ix-row,.ix-note{display:none!important}</style>
<div data-interactive="SLUG"></div><script src="/assets/js/interactive.js"></script>SCRIPTS
<script>setTimeout(function(){document.querySelector('[data-interactive]').interactive.thumbnail()},300)</script>"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if not self.path.startswith("/__thumb/"):
            return super().do_GET()
        slug = self.path.rsplit("/", 1)[1]
        front = (ROOT / f"modules/{slug}/article.html").read_text().split("---\n", 2)[1]
        line = next((l for l in front.splitlines() if l.startswith("scripts:")), "scripts: interactive.js")
        scripts = "".join(f'<script src="/modules/{slug}/{n.strip()}"></script>' for n in line.split(":", 1)[1].split(","))
        body = PAGE.replace("SLUG", slug).replace("SCRIPTS", scripts).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


slugs = sys.argv[1:] or json.loads((ROOT / "site.json").read_text())["modules"]
server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
for slug in slugs:
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / "shot.png"
        subprocess.run([CHROME, "--headless=new", f"--user-data-dir={tmp}/profile", "--no-first-run", "--hide-scrollbars",
                        "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--force-device-scale-factor=1",
                        "--window-size=1200,750", "--virtual-time-budget=4000", f"--screenshot={png}",
                        f"http://127.0.0.1:{server.server_port}/__thumb/{slug}"],
                       check=True, capture_output=True, timeout=120)
        out = ROOT / f"modules/{slug}/thumbnail.jpg"
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "78", "-z", "600", "960", str(png), "--out", str(out)],
                       check=True, capture_output=True)
        print(f"modules/{slug}/thumbnail.jpg  {out.stat().st_size // 1024} KB")
