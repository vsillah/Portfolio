#!/usr/bin/env python3
"""Range-capable localhost server limited to the optional-caption placement proxy."""
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
FILES = {
    '/review.html': (ROOT / 'review.html', 'text/html; charset=utf-8'),
    '/lower-captions.vtt': (ROOT / 'lower-captions.vtt', 'text/vtt; charset=utf-8'),
    '/source-v13.mp4': (ROOT.parent / 'c01-c02-v13-playback-review/l01-c01-c02-v13-review.mp4', 'video/mp4'),
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        target = FILES.get(urlsplit(self.path).path)
        if target is None:
            self.send_error(404)
            return
        path, content_type = target
        size = path.stat().st_size
        start, end = 0, size - 1
        requested = self.headers.get('Range')
        if requested:
            match = re.fullmatch(r'bytes=(\d+)-(\d*)', requested)
            if not match:
                self.send_error(416)
                return
            start = int(match.group(1))
            end = min(int(match.group(2)), end) if match.group(2) else end
            if start >= size or start > end:
                self.send_response(416)
                self.send_header('Content-Range', f'bytes */{size}')
                self.end_headers()
                return
        self.send_response(206 if requested else 200)
        self.send_header('Content-Type', content_type)
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(end - start + 1))
        if requested:
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.end_headers()
        try:
            with path.open('rb') as source:
                source.seek(start)
                remaining = end - start + 1
                while remaining:
                    chunk = source.read(min(65536, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass


if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    print(f'http://127.0.0.1:{server.server_port}/review.html', flush=True)
    server.serve_forever()
