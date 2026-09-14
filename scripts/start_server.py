"""启动本地服务器并打开浏览器预览网页书。

用法: python scripts/start_server.py
"""
import http.server
import socketserver
import os
import webbrowser
import threading
import time

PORT = 8000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def open_browser():
    time.sleep(1.5)
    webbrowser.open(f"http://localhost:{PORT}/")


if __name__ == "__main__":
    httpd = socketserver.TCPServer(("", PORT), Handler)
    httpd.allow_reuse_address = True
    threading.Thread(target=open_browser, daemon=True).start()
    print(f"服务器运行中: http://localhost:{PORT}/  (Ctrl+C 退出)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")