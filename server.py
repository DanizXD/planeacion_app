#!/usr/bin/env python3
import http.server
import socketserver
import os
import sys

DEFAULT_PORT = 5175
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")

class SPANoCacheHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def translate_path(self, path):
        req_clean = path.split('?')[0].lstrip('/')
        full_path = os.path.join(PUBLIC_DIR, req_clean)
        if not os.path.exists(full_path) or os.path.isdir(full_path):
            return os.path.join(PUBLIC_DIR, "index.html")
        return full_path

def start_server():
    os.chdir(PUBLIC_DIR)
    port = DEFAULT_PORT
    max_attempts = 10
    
    for attempt in range(max_attempts):
        try:
            socketserver.TCPServer.allow_reuse_address = True
            with socketserver.TCPServer(("", port), SPANoCacheHTTPHandler) as httpd:
                print(f"\n=======================================================")
                print(f"🚀 Planeación DM (Tejeduría y Corte) corriendo en modo local")
                print(f"👉 URL: http://localhost:{port}")
                print(f"📁 Directorio raíz: {PUBLIC_DIR}")
                print(f"=======================================================\n")
                httpd.serve_forever()
                break
        except OSError as e:
            if e.errno == 98:  # Address already in use
                print(f"⚠️ El puerto {port} está ocupado, intentando con el puerto {port + 1}...")
                port += 1
            else:
                raise e

if __name__ == "__main__":
    try:
        start_server()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        sys.exit(0)
