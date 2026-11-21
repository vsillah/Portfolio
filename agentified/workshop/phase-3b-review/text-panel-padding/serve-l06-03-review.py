"""Read-only localhost review server with MP4 byte-range support."""

import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent / "l06-03-responsive-study"
HOST = "127.0.0.1"
PORT = 8770


class ReviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _media(self, head=False):
        relative = unquote(urlsplit(self.path).path).lstrip("/")
        path = (ROOT / relative).resolve()
        if not path.is_relative_to(ROOT.resolve()) or path.suffix != ".mp4" or not path.is_file():
            return False
        size = path.stat().st_size
        match = re.fullmatch(r"bytes=(\d+)-(\d*)", self.headers.get("Range", ""))
        start = int(match.group(1)) if match else 0
        end = int(match.group(2)) if match and match.group(2) else size - 1
        if start >= size or end < start:
            self.send_error(416, "Requested range not satisfiable")
            return True
        end = min(end, size - 1)
        self.send_response(206 if match else 200)
        self.send_header("Content-Type", "video/mp4")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        if match:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        if not head:
            with path.open("rb") as stream:
                stream.seek(start)
                remaining = end - start + 1
                while remaining:
                    chunk = stream.read(min(65536, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        return True

    def do_GET(self):
        if not self._media():
            super().do_GET()

    def do_HEAD(self):
        if not self._media(head=True):
            super().do_HEAD()


if __name__ == "__main__":
    print(f"Serving unbound L06-03 review only at http://{HOST}:{PORT}/review.html")
    ThreadingHTTPServer((HOST, PORT), ReviewHandler).serve_forever()
