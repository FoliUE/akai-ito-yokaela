from __future__ import annotations

import json
import socket
import threading
import webbrowser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from notes_core import (
    ROOT,
    bootstrap_payload,
    create_note_from_editor_payload,
    load_note_editor_payload,
    save_cover_upload,
    save_inline_image_upload,
    save_note_from_editor_payload,
)


class EditorRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, _format, *_args):
        return

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/bootstrap":
            self.send_json(bootstrap_payload())
            return

        if parsed.path.startswith("/api/notes/"):
            remainder = parsed.path.removeprefix("/api/notes/")
            collection = "nuevas"
            slug = remainder
            if "/" in remainder:
                collection, slug = remainder.split("/", 1)

            if len(slug) == 2 and slug.isdigit():
                try:
                    self.send_json(load_note_editor_payload(slug, collection))
                except FileNotFoundError:
                    self.send_error(HTTPStatus.NOT_FOUND, "No encontré esa nota.")
                except Exception as exc:  # pragma: no cover - ruta defensiva
                    self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))
                return

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/notes":
            payload = self.read_json_body()
            try:
                created = create_note_from_editor_payload(payload)
            except Exception as exc:
                self.send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
                return

            self.send_json(created, status=HTTPStatus.CREATED)
            return

        if parsed.path.startswith("/api/uploads/cover/"):
            remainder = parsed.path.removeprefix("/api/uploads/cover/")
            collection = "nuevas"
            slug = remainder
            if "/" in remainder:
                collection, slug = remainder.split("/", 1)
            payload = self.read_json_body()
            try:
                src = save_cover_upload(slug, str(payload.get("dataUrl") or ""), collection)
            except Exception as exc:
                self.send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
                return

            self.send_json({"src": src})
            return

        if parsed.path.startswith("/api/uploads/inline/"):
            remainder = parsed.path.removeprefix("/api/uploads/inline/")
            try:
                collection, slug, block_id = remainder.split("/", 2)
            except ValueError:
                try:
                    slug, block_id = remainder.split("/", 1)
                    collection = "nuevas"
                except ValueError:
                    self.send_json({"error": "Ruta inválida para la imagen."}, status=HTTPStatus.BAD_REQUEST)
                    return

            payload = self.read_json_body()
            try:
                src = save_inline_image_upload(slug, block_id, str(payload.get("dataUrl") or ""), collection)
            except Exception as exc:
                self.send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
                return

            self.send_json({"src": src})
            return

        self.send_error(HTTPStatus.NOT_FOUND)

    def do_PUT(self):
        parsed = urlparse(self.path)

        if parsed.path.startswith("/api/notes/"):
            remainder = parsed.path.removeprefix("/api/notes/")
            collection = "nuevas"
            slug = remainder
            if "/" in remainder:
                collection, slug = remainder.split("/", 1)
            payload = self.read_json_body()

            try:
                saved = save_note_from_editor_payload(slug, payload, collection)
            except Exception as exc:
                self.send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
                return

            self.send_json(saved)
            return

        self.send_error(HTTPStatus.NOT_FOUND)

    def read_json_body(self) -> dict[str, object]:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length) if content_length else b"{}"
        return json.loads(raw_body.decode("utf-8"))

    def send_json(self, payload: dict[str, object], *, status: HTTPStatus = HTTPStatus.OK):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def start_server() -> tuple[ThreadingHTTPServer, str]:
    port = find_free_port()
    server = ThreadingHTTPServer(("127.0.0.1", port), EditorRequestHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, f"http://127.0.0.1:{port}/tools/notes-manager/ui/editor.html"


def launch_visual_editor() -> int:
    server, url = start_server()

    try:
        try:
            import webview
        except ImportError:
            webbrowser.open(url)
            print("No encontré pywebview instalado.")
            print("Abrí el editor en el navegador por esta vez:")
            print(url)
            print("Dejá esta ventana abierta mientras usás el editor.")
            try:
                input("Cuando termines, presioná Enter para cerrar el servidor...")
            except KeyboardInterrupt:
                pass
            return 0

        webview.create_window(
            "Yokaela Notes Manager",
            url,
            width=1540,
            height=980,
            min_size=(1180, 760),
            text_select=True,
        )
        webview.start()
        return 0
    finally:
        server.shutdown()
        server.server_close()
