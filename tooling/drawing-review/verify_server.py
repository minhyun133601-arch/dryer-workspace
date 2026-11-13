"""Feature smoke tests using only disposable data and cache directories.

Run: python verify_server.py
The drawing root is read-only input; the normal app database is never opened.
"""
from __future__ import annotations

import csv
import hashlib
import http.client
import io
import json
from pathlib import Path
import subprocess
import struct
import sys
import tempfile
import time
import unittest
import zlib


APP = Path(__file__).resolve().parent
ROOT = APP.parent / "건물3D 후보도면"
HOST = "127.0.0.1"


class ReviewServerSmoke(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="drawing-review-smoke-")
        cls.base = Path(cls.temp.name)
        cls.data, cls.cache = cls.base / "data", cls.base / "cache"
        cls.cache.mkdir()
        cls.ready_file = cls.base / "ready.json"
        cls.port = 0
        with (ROOT / "00_도면목록.csv").open(encoding="utf-8-sig", newline="") as stream:
            cls.interrupted_key = next(csv.DictReader(stream))["SHA256"]
        interrupted = cls.cache / cls.interrupted_key
        interrupted.mkdir()
        (interrupted / "meta.json").write_text(json.dumps({"status": "processing", "pages": [], "warnings": []}), encoding="utf-8")
        cls.log = (cls.base / "server.log").open("w", encoding="utf-8")
        cls.process = None
        try:
            cls.start_server()
            code, headers, bootstrap = cls.request("GET", "/api/bootstrap")
            assert code == 200, bootstrap
            cls.token = bootstrap["token"]
            cls.cookie = headers["set-cookie"].split(";", 1)[0]
            code, _, catalog = cls.request("GET", "/api/catalog", auth=True)
            assert code == 200, catalog
            cls.catalog = catalog
            cls.key = catalog["items"][0]["id"]
            # A tiny image fixture validates authenticated byte serving.
            def png_chunk(kind, data):
                return struct.pack("!I", len(data)) + kind + data + struct.pack("!I", zlib.crc32(kind + data) & 0xffffffff)
            cls.image_bytes = (b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", struct.pack("!2I5B", 600, 300, 8, 2, 0, 0, 0))
                               + png_chunk(b"IDAT", zlib.compress((b"\x00" + b"\x80\xa0\xc0" * 600) * 300)) + png_chunk(b"IEND", b""))
            target = cls.cache / cls.key
            target.mkdir(exist_ok=True)
            (target / "page-1.png").write_bytes(cls.image_bytes)
            (target / "meta.json").write_text(json.dumps({"status": "ready", "kind": "dwg", "pages": [
                {"src": f"/cache/{cls.key}/page-1.png", "width": 600, "height": 300}], "warnings": []}), encoding="utf-8")
            (cls.base / "outside.png").write_bytes(b"outside-cache-secret")
        except Exception:
            cls.stop_server()
            cls.log.close()
            cls.temp.cleanup()
            raise

    @classmethod
    def start_server(cls):
        cls.ready_file.unlink(missing_ok=True)
        cls.process = subprocess.Popen(
            [sys.executable, str(APP / "server.py"), "--root", str(ROOT),
             "--data", str(cls.data), "--cache", str(cls.cache),
             "--host", HOST, "--port", "0", "--ready-file", str(cls.ready_file)],
            stdin=subprocess.DEVNULL, stdout=cls.log, stderr=cls.log,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            if cls.process.poll() is not None:
                raise RuntimeError("Isolated server exited before startup")
            try:
                if not cls.ready_file.is_file():
                    time.sleep(0.1)
                    continue
                cls.ready = json.loads(cls.ready_file.read_text(encoding="utf-8"))
                cls.port = cls.ready["port"]
                code, _, _ = cls.request("GET", "/api/bootstrap")
                if code == 200:
                    return
            except (OSError, http.client.HTTPException):
                pass
            time.sleep(0.1)
        raise RuntimeError("Isolated server startup timed out")

    @classmethod
    def stop_server(cls):
        if cls.process is not None and cls.process.poll() is None:
            cls.process.terminate()
            try:
                cls.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                cls.process.kill()
                cls.process.wait(timeout=5)
        cls.process = None

    @classmethod
    def tearDownClass(cls):
        cls.stop_server()
        cls.log.close()
        cls.temp.cleanup()

    @classmethod
    def request(cls, method, path, payload=None, *, auth=False, cookie=False, headers=None):
        request_headers = dict(headers or {})
        if auth:
            request_headers["X-Review-Token"] = cls.token
        if cookie:
            request_headers["Cookie"] = cls.cookie
        body = None
        if payload is not None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            request_headers["Content-Type"] = "application/json"
        conn = http.client.HTTPConnection(HOST, cls.port, timeout=10)
        try:
            conn.request(method, path, body, request_headers)
            response = conn.getresponse()
            data = response.read()
            response_headers = {k.lower(): v for k, v in response.getheaders()}
            if "application/json" in response_headers.get("content-type", ""):
                data = json.loads(data.decode("utf-8"))
            return response.status, response_headers, data
        finally:
            conn.close()

    def test_01_catalog_contains_all_originals(self):
        with (ROOT / "00_도면목록.csv").open(encoding="utf-8-sig", newline="") as stream:
            originals = list(csv.DictReader(stream))
        self.assertEqual(len(originals), 758)
        self.assertEqual(self.catalog["stats"]["total"], 758)
        self.assertEqual({r["SHA256"] for r in originals}, {i["id"] for i in self.catalog["items"]})
        self.assertEqual(sum(i["ext"] == ".dwg" for i in self.catalog["items"]), 272)
        self.assertEqual(sum(i["ext"] == ".pdf" for i in self.catalog["items"]), 115)
        self.assertEqual(self.catalog["states"], {})

    def test_02_authentication_and_cookie_image(self):
        protected = ["/api/catalog", "/api/share", "/api/export.csv",
                     f"/api/drawings/{self.key}", f"/original/{self.key}",
                     f"/cache/{self.key}/page-1.png", f"/thumbnail/{self.key}"]
        for path in protected:
            with self.subTest(path=path):
                self.assertEqual(self.request("GET", path)[0], 401)
                self.assertEqual(self.request("GET", path, headers={"X-Review-Token": "wrong"})[0], 401)
        code, headers, image = self.request("GET", f"/cache/{self.key}/page-1.png", cookie=True)
        self.assertEqual(code, 200)
        self.assertEqual(headers["content-type"], "image/png")
        self.assertEqual(image, self.image_bytes)
        self.assertEqual(self.request("POST", f"/api/drawings/{self.key}/state", {"status": "reviewed"})[0], 401)
        self.assertEqual(self.request("POST", f"/api/drawings/{self.key}/state", {"status": "reviewed"}, auth=True,
                                      headers={"Origin": "http://unrelated.example"})[0], 403)

    def test_03_state_comments_pins_resolve_survive_restart(self):
        code, _, state = self.request("POST", f"/api/drawings/{self.key}/state",
                                      {"status": "discuss", "starred": True}, auth=True)
        self.assertEqual(code, 200)
        self.assertEqual((state["status"], state["starred"]), ("discuss", True))
        # Updating one field must preserve the other field.
        self.assertEqual(self.request("POST", f"/api/drawings/{self.key}/state", {"status": "reviewed"}, auth=True)[0], 200)
        code, _, comment = self.request("POST", f"/api/drawings/{self.key}/comments",
            {"author": "검토자", "text": "이 위치 현장 확인", "page": 2, "x": 0.25, "y": 0.75}, auth=True)
        self.assertEqual(code, 201)
        self.assertEqual((comment["page"], comment["x"], comment["y"]), (2, 0.25, 0.75))
        code, _, resolved = self.request("POST", f"/api/comments/{comment['id']}/resolve", {"resolved": True}, auth=True)
        self.assertEqual(code, 200)
        self.assertTrue(resolved["resolved"])
        token_before = self.token
        self.stop_server()
        self.start_server()
        code, _, bootstrap = self.request("GET", "/api/bootstrap")
        self.assertEqual(bootstrap["token"], token_before)
        code, _, detail = self.request("GET", f"/api/drawings/{self.key}", cookie=True)
        self.assertEqual(code, 200)
        self.assertEqual((detail["state"]["status"], detail["state"]["starred"]), ("reviewed", True))
        saved = next(c for c in detail["comments"] if c["id"] == comment["id"])
        self.assertEqual(saved["text"], "이 위치 현장 확인")
        self.assertEqual((saved["x"], saved["y"], saved["resolved"]), (0.25, 0.75, True))
        code, _, reopened = self.request("POST", f"/api/comments/{comment['id']}/resolve", {"resolved": False}, auth=True)
        self.assertEqual(code, 200)
        self.assertFalse(reopened["resolved"])

    def test_04_export_escapes_spreadsheet_formulas(self):
        for prefix in ("=", "+", "-", "@"):
            code, _, _ = self.request("POST", f"/api/drawings/{self.key}/comments",
                {"author": prefix + "author", "text": prefix + "formula", "page": 1}, auth=True)
            self.assertEqual(code, 201)
        code, headers, exported = self.request("GET", "/api/export.csv", auth=True)
        self.assertEqual(code, 200)
        self.assertIn("text/csv", headers["content-type"])
        self.assertTrue(exported.startswith(b"\xef\xbb\xbf"))
        rows = list(csv.DictReader(io.StringIO(exported.decode("utf-8-sig"))))
        for prefix in ("=", "+", "-", "@"):
            match = next(r for r in rows if r["의견"] == "'" + prefix + "formula")
            self.assertEqual(match["작성자"], "'" + prefix + "author")

    def test_05_unknown_ids_and_path_traversal(self):
        unknown = "0" * 64
        self.assertNotIn(unknown, {i["id"] for i in self.catalog["items"]})
        for path in (f"/api/drawings/{unknown}", f"/original/{unknown}",
                     "/cache/../outside.png", "/cache/%2e%2e/outside.png",
                     "/cache/..%5coutside.png", "/cache/%2e%2e%2foutside.png",
                     "/cache/../data/access.json", "/../server.py", "/%2e%2e/server.py"):
            with self.subTest(path=path):
                code, _, body = self.request("GET", path, auth=True)
                self.assertEqual(code, 404)
                self.assertNotEqual(body, b"outside-cache-secret")
        for suffix in ("state", "comments"):
            self.assertEqual(self.request("POST", f"/api/drawings/{unknown}/{suffix}", {"status": "reviewed"}, auth=True)[0], 404)
        self.assertEqual(self.request("POST", f"/api/comments/{'0' * 32}/resolve", {"resolved": True}, auth=True)[0], 404)

    def test_06_invalid_input_is_rejected_without_mutation(self):
        for payload in ({"status": "invalid"}, {"starred": "yes"}):
            self.assertEqual(self.request("POST", f"/api/drawings/{self.key}/state", payload, auth=True)[0], 400)
        base = {"author": "검토자", "text": "의견", "page": 1}
        for override in ({"author": ""}, {"text": " "}, {"page": True}, {"page": 0},
                         {"x": 0.1}, {"x": -0.1, "y": 0.5}, {"x": 0.5, "y": 1.1}):
            with self.subTest(override=override):
                self.assertEqual(self.request("POST", f"/api/drawings/{self.key}/comments", {**base, **override}, auth=True)[0], 400)

    def test_07_dynamic_readiness_and_interrupted_preview(self):
        code, _, bootstrap = self.request("GET", "/api/bootstrap")
        self.assertEqual(code, 200)
        self.assertEqual(bootstrap["application"], "heechang-drawing-review")
        self.assertEqual(bootstrap["catalogCount"], 758)
        self.assertEqual(bootstrap["rootId"], hashlib.sha256(str(ROOT.resolve()).encode("utf-8")).hexdigest())
        self.assertGreater(self.ready["port"], 0)
        self.assertEqual(self.ready["port"], self.port)
        metadata = json.loads((self.data / "server.json").read_text(encoding="utf-8"))
        self.assertEqual(metadata, self.ready)
        self.assertNotIn("token", metadata)
        code, _, detail = self.request("GET", f"/api/drawings/{self.interrupted_key}", auth=True)
        self.assertEqual(code, 200)
        self.assertEqual(detail["preview"]["status"], "unsupported")
        self.assertTrue(detail["preview"]["interrupted"])
        self.assertTrue(detail["preview"]["warnings"])

    def test_08_thumbnail_lazy_generation_and_confinement(self):
        code, headers, image = self.request("GET", f"/thumbnail/{self.key}", cookie=True)
        self.assertEqual(code, 200)
        self.assertIn(headers["content-type"], {"image/jpeg", "image/png"})
        if headers["content-type"] == "image/jpeg":
            self.assertTrue(image.startswith(b"\xff\xd8"))
            self.assertEqual(len(list((self.cache / "thumbnails").glob(self.key + "-*.jpg"))), 1)
        else:
            self.assertEqual(image, self.image_bytes)
        self.assertEqual(self.request("GET", f"/thumbnail/{'0' * 64}", auth=True)[0], 404)
        meta = self.cache / self.key / "meta.json"
        preserved = meta.read_bytes()
        try:
            meta.write_text(json.dumps({"status": "ready", "pages": [{"src": f"/cache/{self.key}/../../outside.png"}]}), encoding="utf-8")
            self.assertEqual(self.request("GET", f"/thumbnail/{self.key}", auth=True)[0], 404)
        finally:
            meta.write_bytes(preserved)


if __name__ == "__main__":
    unittest.main(verbosity=2)
