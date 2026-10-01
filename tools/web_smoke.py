"""Prove a browser game build boots before it goes to itch.io.

Serves <dir> over HTTP (wasm loaders refuse file://), opens index.html in
headless Chromium at 1280x720, clicks the canvas (many engines need a user
gesture to start), waits, then fails on: any uncaught page error, a console
line matching --fail-on (default: GDScript/engine errors), a missing
--expect console line, or a blank frame. Exit 0 = boots and renders.
--url checks an already-hosted build instead (the live itch embed URL, e.g.
https://html-classic.itch.zone/html/<upload>-<build>/index.html): the Xvfb
Helium that drives the itch page has no WebGL2, so the live "Run game" check
must run here, where SwiftShader provides it.

Run: uv run --with playwright python web_smoke.py <dir> [options]
     uv run --with playwright python web_smoke.py --url <url> --shot <png>
(first time: uv run --with playwright python -m playwright install chromium)
"""

from __future__ import annotations

import argparse
import http.server
import re
import statistics
import sys
import threading
from functools import partial
from pathlib import Path

from playwright.sync_api import sync_playwright

MIN_PIXEL_STDDEV = 8.0


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler without per-request logging."""

    def log_message(self, *_args: object) -> None:
        """Drop the access log."""
        return


def parse_args() -> argparse.Namespace:
    """Command-line options."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "dir", type=Path, nargs="?", help="exported build containing index.html"
    )
    parser.add_argument("--url", default="", help="hosted index.html to test instead")
    parser.add_argument(
        "--seconds", type=float, default=12.0, help="wait after the click"
    )
    parser.add_argument("--shot", type=Path, default=None, help="screenshot path")
    parser.add_argument("--expect", default="", help="console text that must appear")
    parser.add_argument(
        "--selector",
        default="#root",
        help="element to wait for and click (DOM games, e.g. '#root button')",
    )
    parser.add_argument(
        "--fail-on", default=r"SCRIPT ERROR|USER ERROR|Uncaught", help="regex"
    )
    return parser.parse_args()


def serve(dist: Path) -> http.server.ThreadingHTTPServer:
    """Serve the build on a free port in a daemon thread.

    Port 0, not a fixed one: several games release in parallel and a fixed
    port made the second smoke test die with EADDRINUSE (2026-10-01).
    """
    handler = partial(QuietHandler, directory=str(dist))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def run(
    args: argparse.Namespace, port: int, lines: list[str], errors: list[str]
) -> float:
    """Boot the page and return the final frame's byte spread."""
    shot = args.shot or (args.dir.parent if args.dir else Path.cwd()) / "web_smoke.png"
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            args=["--use-gl=angle", "--use-angle=swiftshader"]
        )
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.on("console", lambda msg: lines.append(msg.text))
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.goto(args.url or f"http://127.0.0.1:{port}/index.html")
        page.wait_for_selector(args.selector, timeout=60_000)
        page.wait_for_timeout(3000)
        page.locator(args.selector).first.click()
        page.wait_for_timeout(int(args.seconds * 1000))
        page.screenshot(path=str(shot))
        browser.close()
    data = shot.read_bytes()
    print(f"screenshot: {shot}")
    return statistics.pstdev(data[len(data) // 4 : len(data) // 4 + 20_000])


def main() -> int:
    """Run the smoke test; non-zero exit means do not publish."""
    args = parse_args()
    if not args.url and not (args.dir and (args.dir / "index.html").is_file()):
        print(f"no index.html in {args.dir} (or pass --url)", file=sys.stderr)
        return 2
    lines: list[str] = []
    errors: list[str] = []
    server = None if args.url else serve(args.dir)
    try:
        port = server.server_address[1] if server else 0
        spread = run(args, port, lines, errors)
    finally:
        if server:
            server.shutdown()
    bad = [line for line in lines if re.search(args.fail_on, line)]
    missing = bool(args.expect) and not any(args.expect in line for line in lines)
    expect = "MISSING" if missing else "ok"
    print(
        f"web smoke: frame stddev={spread:.1f} page errors={len(errors)} "
        f"console errors={len(bad)} expect={expect}"
    )
    for problem in errors + bad:
        print(f"  {problem}", file=sys.stderr)
    return 1 if errors or bad or missing or spread < MIN_PIXEL_STDDEV else 0


if __name__ == "__main__":
    sys.exit(main())
