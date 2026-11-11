#!/usr/bin/env python3
"""Sheeens personal server: runs only on this computer (127.0.0.1).

- Serves the site (this folder) and the Cornell audio library (the parent folder).
- Proxies eBird and xeno-canto so the API keys stay in config.json and never reach the browser.
- Can refresh the Saudi bird data with Node.js (scripts/sync-birds.mjs).
"""
import json
import os
import shutil
import ssl
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("SHEEENS_PORT", "8765"))
APP_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(APP_DIR)  # the Cornell library folder
APP_URL = "/" + os.path.basename(APP_DIR) + "/"
CONFIG = os.path.join(APP_DIR, "config.json")
UA = "sheeens-personal/1.0"

_ctx = ssl.create_default_context()
if os.path.exists("/etc/ssl/cert.pem"):
    try:
        _ctx.load_verify_locations("/etc/ssl/cert.pem")
    except Exception:
        pass

_cache = {}
_update = {"running": False, "log": ""}


def load_config():
    try:
        with open(CONFIG, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_config(cfg):
    with open(CONFIG, "w", encoding="utf-8") as f:
        json.dump(cfg, f)
    try:
        os.chmod(CONFIG, 0o600)
    except Exception:
        pass


def fetch(url, headers=None, ttl=900):
    hit = _cache.get(url)
    if hit and time.time() - hit[0] < ttl:
        return 200, hit[1]
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    try:
        with urllib.request.urlopen(req, context=_ctx, timeout=30) as r:
            body = r.read()
            _cache[url] = (time.time(), body)
            return r.status, body
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:
        return 502, json.dumps({"error": str(e)}).encode()


def run_update():
    cfg = load_config()
    env = dict(os.environ)
    if cfg.get("ebird"):
        env["EBIRD_API_KEY"] = cfg["ebird"]
    if cfg.get("xc"):
        env["XENO_CANTO_API_KEY"] = cfg["xc"]
    _update.update(running=True, log="")
    try:
        p = subprocess.Popen(
            ["node", os.path.join(APP_DIR, "scripts", "sync-birds.mjs")],
            cwd=APP_DIR, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
        )
        for line in p.stdout:
            _update["log"] = (_update["log"] + line)[-6000:]
        p.wait()
        _update["log"] += "\n✓ انتهى التحديث" if p.returncode == 0 else f"\n✗ توقف التحديث (رمز {p.returncode})"
    except Exception as e:
        _update["log"] += f"\n✗ {e}"
    finally:
        _update["running"] = False


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        pass

    def send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_raw(self, code, body):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        if self.path.endswith((".json", ".js", ".css", ".html", "/")):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        path, _, query = self.path.partition("?")
        if path == "/":
            self.send_response(302)
            self.send_header("Location", APP_URL)
            self.end_headers()
            return
        if path.endswith(("config.json", ".py", ".log")):
            return self.send_json(404, {"error": "not found"})
        if path == "/api/status":
            cfg = load_config()
            return self.send_json(200, {
                "ebird": bool(cfg.get("ebird")),
                "xc": bool(cfg.get("xc")),
                "node": bool(shutil.which("node")),
                "updating": _update["running"],
                "updateLog": _update["log"],
            })
        if path.startswith("/api/ebird/"):
            key = load_config().get("ebird")
            if not key:
                return self.send_json(401, {"error": "no eBird key"})
            rest = path[len("/api/ebird/"):]
            url = "https://api.ebird.org/v2/" + rest + ("?" + query if query else "")
            code, body = fetch(url, {"X-eBirdApiToken": key}, ttl=900)
            return self.send_raw(code, body)
        if path == "/api/xc":
            key = load_config().get("xc")
            if not key:
                return self.send_json(401, {"error": "no xeno-canto key"})
            q = urllib.parse.parse_qs(query).get("query", [""])[0]
            url = "https://xeno-canto.org/api/3/recordings?" + urllib.parse.urlencode({"query": q, "key": key})
            code, body = fetch(url, ttl=86400)
            return self.send_raw(code, body)
        return super().do_GET()

    def do_POST(self):
        # Only accept requests coming from this site (blocks other web pages from changing settings).
        origin = self.headers.get("Origin", "")
        if origin and not origin.startswith((f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}")):
            return self.send_json(403, {"error": "forbidden"})
        if self.path == "/api/config":
            n = int(self.headers.get("Content-Length", "0") or 0)
            try:
                data = json.loads(self.rfile.read(n) or b"{}")
            except Exception:
                return self.send_json(400, {"error": "bad json"})
            cfg = load_config()
            for k in ("ebird", "xc"):
                v = str(data.get(k, "")).strip()
                if v:
                    cfg[k] = v
            save_config(cfg)
            _cache.clear()
            return self.send_json(200, {"ok": True})
        if self.path == "/api/update":
            if not shutil.which("node"):
                return self.send_json(400, {"error": "Node.js غير مثبت"})
            if not _update["running"]:
                threading.Thread(target=run_update, daemon=True).start()
            return self.send_json(200, {"ok": True})
        self.send_json(404, {"error": "not found"})


def main():
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        print(f"الموقع شغّال من قبل على المنفذ {PORT}، أفتحه لك الآن.")
        webbrowser.open(f"http://127.0.0.1:{PORT}{APP_URL}")
        return
    url = f"http://127.0.0.1:{PORT}{APP_URL}"
    print("شينز يعمل على جهازك فقط:", url)
    print("لإيقافه: أغلق هذه النافذة أو اضغط Ctrl+C")
    if not os.environ.get("SHEEENS_NO_BROWSER"):
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    sys.exit(main())
