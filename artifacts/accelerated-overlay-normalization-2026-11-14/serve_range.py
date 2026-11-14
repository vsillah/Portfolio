#!/usr/bin/env python3
"""Serve the local L01-L03 review with byte-range video seeking."""

import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        path = Path(self.translate_path(self.path))
        if not path.is_file():
            return super().send_head()
        size = path.stat().st_size
        requested = self.headers.get("Range")
        match = re.fullmatch(r"bytes=(\d+)-(\d*)", requested or "")
        if requested and not match:
            self.send_error(416)
            return None
        start = int(match.group(1)) if match else 0
        end = min(int(match.group(2)), size - 1) if match and match.group(2) else size - 1
        if start >= size or start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None
        self.send_response(206 if match else 200)
        self.send_header("Content-Type", self.guess_type(str(path)))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        if match:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        source = path.open("rb")
        source.seek(start)
        self._remaining = end - start + 1
        return source

    def copyfile(self, source, output):
        while self._remaining:
            chunk = source.read(min(65536, self._remaining))
            if not chunk:
                break
            output.write(chunk)
            self._remaining -= len(chunk)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8766), Handler)
    print("http://127.0.0.1:8766/", flush=True)
    server.serve_forever()
