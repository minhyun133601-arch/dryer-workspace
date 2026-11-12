"""Local drawing review room. Optional Pillow produces small gallery thumbnails."""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor
import csv
import hashlib
import io
import ipaddress
import json
import mimetypes
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import sqlite3
import subprocess
import sys
import threading
import tempfile
import time
from datetime import datetime, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit
import uuid

APP = Path(__file__).resolve().parent
APPLICATION = "heechang-drawing-review"
STATUSES = {"unreviewed", "reviewed", "discuss", "hold"}


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def read_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + "." + uuid.uuid4().hex + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


class ReviewRoom:
    def __init__(self, root, data, cache, port):
        self.root, self.data, self.cache, self.port = root.resolve(), data.resolve(), cache.resolve(), port
        self.root_id = hashlib.sha256(str(self.root).encode("utf-8")).hexdigest()
        data, cache = self.data, self.cache
        data.mkdir(parents=True, exist_ok=True)
        cache.mkdir(parents=True, exist_ok=True)
        self.db = data / "review.sqlite3"
        self.token = read_json(data / "access.json", {}).get("token") or secrets.token_urlsafe(24)
        atomic_json(data / "access.json", {"token": self.token})
        with self.connect() as conn:
            conn.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS states (
                    drawing_id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'unreviewed',
                    starred INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS comments (
                    id TEXT PRIMARY KEY, drawing_id TEXT NOT NULL, author TEXT NOT NULL,
                    text TEXT NOT NULL, page INTEGER NOT NULL, x REAL, y REAL,
                    created_at TEXT NOT NULL, resolved INTEGER NOT NULL DEFAULT 0);
                CREATE INDEX IF NOT EXISTS comments_drawing ON comments(drawing_id,created_at);
            """)
        self.items, self.paths = [], {}
        with (root / "00_도면목록.csv").open(encoding="utf-8-sig", newline="") as stream:
            for row in csv.DictReader(stream):
                key = row["SHA256"]
                rel = row.get("원본현재상대경로") or row["현재상대경로"]
                path = (root / rel).resolve()
                if not path.is_relative_to(self.root):
                    raise ValueError("원본 경로가 도면 폴더 밖을 가리킵니다.")
                self.paths[key] = path
                self.items.append({
                    "id": key, "name": row["원본파일명"], "ext": row["확장자"].lower(),
                    "site": row["공장_경로단서"], "building": row["동_공간_경로단서"],
                    "category": row["분류"], "bytes": int(row["바이트"] or 0),
                    "sourceCount": int(row["원출처수"] or 1),
                    "warnings": row.get("주의", ""), "selection": row.get("선정근거", ""),
                    "sources": row.get("모든원출처", "").split("\n\n"),
                    "originalUrl": "/original/" + key,
                    "thumbnailUrl": "/thumbnail/" + key,
                })
        # Start discussions with the overall site, then buildings and floor plans.
        # These are reference candidates; this order does not assert as-built accuracy.
        priority = {"67b3916ee636": 0, "2aa0b5aa9187": 1, "0cd4ea0d0d1b": 2}
        self.items.sort(key=lambda item: (item["category"], priority.get(item["id"][:12], 10)))
        self.index = {item["id"]: item for item in self.items}
        self.detail_jobs = {}
        self.job_lock = threading.Lock()
        self.thumbnail_lock = threading.Lock()
        self.detail_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="drawing-detail")
        self.recovered_previews = self.recover_interrupted_previews()

    def recover_interrupted_previews(self):
        """A new server has no inherited jobs; retain completed previews and originals."""
        recovered = []
        for item in self.items:
            target = self.cache / item["id"] / "meta.json"
            meta = read_json(target, {})
            if meta.get("status") != "processing":
                continue
            warning = "이전 미리보기 작업이 종료되었습니다. 원본 파일을 확인하거나 이 자료만 상세 미리보기를 요청해 주세요."
            warnings = list(meta.get("warnings") or [])
            if warning not in warnings:
                warnings.append(warning)
            meta.update(status="ready" if meta.get("pages") else "unsupported", warnings=warnings,
                        interrupted=True, updated=time.time())
            atomic_json(target, meta)
            recovered.append(item["id"])
        return recovered

    def identity(self):
        return {"application": APPLICATION, "rootId": self.root_id, "catalogCount": len(self.items)}

    def thumbnail(self, key):
        """Use only a catalogued image; never convert CAD or modify source documents."""
        pages = self.preview(key).get("pages") or []
        if not pages:
            return None
        src = pages[0].get("src", "")
        if src.startswith(f"/cache/{key}/"):
            source = (self.cache / src[len("/cache/"):]).resolve()
            if not source.is_relative_to((self.cache / key).resolve()):
                return None
        elif src == "/original/" + key and self.index[key]["ext"] in {".png", ".jpg", ".jpeg", ".webp"}:
            source = self.paths[key]
        else:
            return None
        if not source.is_file() or source.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            return None
        stamp = source.stat()
        signature = hashlib.sha256(f"{src}|{stamp.st_mtime_ns}|{stamp.st_size}".encode("utf-8")).hexdigest()[:16]
        destination = self.cache / "thumbnails" / f"{key}-{signature}.jpg"
        if destination.is_file():
            return destination
        try:
            from PIL import Image, ImageOps
        except ImportError:
            return source
        try:
            with self.thumbnail_lock:
                if destination.is_file():
                    return destination
                destination.parent.mkdir(parents=True, exist_ok=True)
                with Image.open(source) as opened:
                    picture = ImageOps.exif_transpose(opened)
                    picture.thumbnail((320, 240))
                    if picture.mode in {"RGBA", "LA"} or "transparency" in picture.info:
                        rgba = picture.convert("RGBA")
                        image = Image.new("RGB", rgba.size, "white")
                        image.paste(rgba, mask=rgba.getchannel("A"))
                    else:
                        image = picture.convert("RGB")
                    temporary = destination.with_suffix("." + uuid.uuid4().hex + ".tmp")
                    try:
                        image.save(temporary, "JPEG", quality=80, optimize=True)
                        temporary.replace(destination)
                    finally:
                        temporary.unlink(missing_ok=True)
            return destination
        except (OSError, ValueError):
            return source

    @contextmanager
    def connect(self):
        conn = sqlite3.connect(self.db, timeout=15)
        conn.row_factory = sqlite3.Row
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def preview(self, key):
        return read_json(self.cache / key / "meta.json", {
            "status": "pending", "kind": self.index[key]["ext"].lstrip("."),
            "pages": [], "warnings": [],
        })

    def state(self, row=None):
        if row is None:
            return {"status": "unreviewed", "starred": False, "updatedAt": None}
        return {"status": row["status"], "starred": bool(row["starred"]), "updatedAt": row["updated_at"]}

    @staticmethod
    def comment(row):
        return {"id": row["id"], "author": row["author"], "text": row["text"],
                "page": row["page"], "x": row["x"], "y": row["y"],
                "createdAt": row["created_at"], "resolved": bool(row["resolved"])}

    def detail(self, key):
        with self.connect() as conn:
            state = self.state(conn.execute("SELECT * FROM states WHERE drawing_id=?", (key,)).fetchone())
            comments = [self.comment(r) for r in conn.execute(
                "SELECT * FROM comments WHERE drawing_id=? ORDER BY created_at,id", (key,))]
        with self.job_lock:
            job = dict(self.detail_jobs.get(key, {}))
        return {"preview": self.preview(key), "state": state, "comments": comments, "detailJob": job}

    def request_detail(self, key):
        if self.index[key]["ext"] not in {".dwg", ".bak", ".xls", ".xlsx", ".doc", ".docx", ".ppt", ".pptx"}:
            raise ValueError("이 자료는 현재 미리보기로 확인할 수 있습니다.")
        with self.job_lock:
            existing = self.detail_jobs.get(key, {})
            if existing.get("status") in {"queued", "running"}:
                return dict(existing)
            job = {"status": "queued", "requestedAt": now()}
            self.detail_jobs[key] = job
            self.detail_pool.submit(self.build_detail, key)
            return dict(job)

    def build_detail(self, key):
        with self.job_lock:
            self.detail_jobs[key] = {"status": "running", "requestedAt": now()}
        try:
            python = Path.home() / "venvs/workstation-tools/Scripts/python.exe"
            if not python.is_file():
                raise ValueError("상세 변환용 Python 환경을 찾을 수 없습니다.")
            # Build in isolation: the current preview remains visible throughout
            # conversion, and a failure never replaces a working stored preview.
            with tempfile.TemporaryDirectory(prefix="detail-", dir=self.cache) as tmp:
                temporary = Path(tmp)
                result = subprocess.run([str(python), str(APP / "build_previews.py"),
                    "--root", str(self.root), "--cache", str(temporary), "--one", key, "--force", "--detailed"],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=300,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
                meta = read_json(temporary / key / "meta.json", {})
                if meta.get("status") != "ready" or not meta.get("pages"):
                    raise ValueError(meta.get("error") or "상세 미리보기를 만들지 못했습니다. 원본 파일로 확인해 주세요.")
                dest = self.cache / key
                dest.mkdir(exist_ok=True)
                generation = uuid.uuid4().hex[:8]
                for i, page in enumerate(meta["pages"]):
                    src = temporary / key / Path(page["src"]).name
                    filename = f"detail-{generation}-{i+1:03d}{src.suffix}"
                    shutil.copyfile(src, dest / filename)
                    page["src"] = f"/cache/{key}/{filename}"
                meta["previewQuality"] = "detailed"
                atomic_json(dest / "meta.json", meta)
            with self.job_lock:
                self.detail_jobs[key] = {"status": "ready", "completedAt": now()}
        except Exception as exc:
            with self.job_lock:
                self.detail_jobs[key] = {"status": "failed", "error": str(exc)[:500], "completedAt": now()}

    def catalog(self):
        with self.connect() as conn:
            states = {r["drawing_id"]: self.state(r) for r in conn.execute("SELECT * FROM states")}
        items = [{**item, "preview": self.preview(item["id"])} for item in self.items]
        stats = {"total": len(items), "ready": 0, "unsupported": 0, "processing": 0,
                 "failed": 0, "pages": 0, "drawingTotal": 0, "drawingReady": 0}
        drawing_extensions = {".dwg", ".bak", ".pdf", ".png", ".jpg", ".jpeg", ".webp"}
        for item in items:
            preview = item["preview"]
            status = preview.get("status", "pending")
            stats[status if status in {"ready", "unsupported", "failed"} else "processing"] += 1
            stats["pages"] += len(preview.get("pages") or [])
            if item["ext"] in drawing_extensions:
                stats["drawingTotal"] += 1
                stats["drawingReady"] += status == "ready"
        return {"items": items, "states": states, "stats": stats}

    def progress(self):
        progress = {"ready": 0, "total": len(self.items), "processing": 0, "failed": 0, "unsupported": 0}
        for item in self.items:
            status = self.preview(item["id"]).get("status", "pending")
            if status in ("ready", "failed", "unsupported"):
                progress[status] += 1
            else:
                progress["processing"] += 1
        return progress

    def share(self):
        ips = set()
        try:
            for result in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
                address = ipaddress.ip_address(result[4][0])
                if address.is_private and not address.is_loopback:
                    ips.add(str(address))
        except OSError:
            pass
        return {"urls": [f"http://{ip}:{self.port}/#access={self.token}" for ip in sorted(ips)],
                "localUrl": f"http://127.0.0.1:{self.port}/", "code": self.token,
                "note": "같은 사내망에서 접속할 수 있습니다. 이 PC와 앱이 켜져 있어야 하며, 회사 방화벽 설정에 따라 접속이 제한될 수 있습니다. 링크를 받은 사람은 도면과 검토 의견을 확인하고 기록할 수 있습니다."}


class Handler(BaseHTTPRequestHandler):
    server_version = "DrawingReview/1.0"

    @property
    def room(self):
        return self.server.room

    def log_message(self, fmt, *args):
        if self.path.startswith("/api/") and args and str(args[1] if len(args) > 1 else "") == "200":
            return
        # Do not write access codes, query strings, or document names to logs.
        sys.stderr.write(f"[{now()}] {self.command} {urlsplit(self.path).path.split('/')[1:2]}\n")

    def loopback(self):
        return ipaddress.ip_address(self.client_address[0]).is_loopback

    def authenticated(self):
        supplied = self.headers.get("X-Review-Token", "")
        if not supplied:
            try:
                cookie = SimpleCookie(self.headers.get("Cookie", ""))
                supplied = cookie["drawing_access"].value if "drawing_access" in cookie else ""
            except Exception:
                supplied = ""
        return bool(supplied) and secrets.compare_digest(supplied, self.room.token)

    def send(self, code, payload, kind="application/json; charset=utf-8", cookie=False):
        if isinstance(payload, (dict, list)):
            payload = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        elif isinstance(payload, str):
            payload = payload.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        if cookie:
            self.send_header("Set-Cookie", f"drawing_access={self.room.token}; Path=/; HttpOnly; SameSite=Strict")
        self.end_headers()
        self.wfile.write(payload)

    def file(self, path, original=False):
        if not path.is_file():
            return self.send(404, {"error": "파일을 찾을 수 없습니다."})
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        if path.suffix.lower() == ".svg":
            mime = "image/svg+xml"
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(path.stat().st_size))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store" if path.suffix.lower() in {".html", ".css", ".js"} else ("private, max-age=86400" if not original else "private, no-cache"))
        if original:
            from urllib.parse import quote
            disposition = "inline" if mime.startswith("image/") or mime == "application/pdf" else "attachment"
            self.send_header("Content-Disposition", f"{disposition}; filename*=UTF-8''{quote(path.name)}")
        self.end_headers()
        with path.open("rb") as stream:
            while chunk := stream.read(256 * 1024):
                self.wfile.write(chunk)

    def do_GET(self):
        try:
            path = unquote(urlsplit(self.path).path)
            if path == "/api/bootstrap":
                return self.send(200, {**self.room.identity(), "remote": not self.loopback(), **({"token": self.room.token} if self.loopback() else {})}, cookie=self.loopback())
            if path in ("/", "/index.html", "/style.css", "/app.js"):
                return self.file(APP / "public" / ("index.html" if path == "/" else path[1:]))
            if path == "/favicon.ico":
                return self.send(204, b"", "image/x-icon")
            if not self.authenticated():
                return self.send(401, {"error": "공유 링크 또는 접근 코드를 입력해 주세요."})
            if path == "/api/catalog":
                return self.send(200, self.room.catalog(), cookie=True)
            if path == "/api/progress":
                return self.send(200, self.room.progress())
            if path == "/api/share":
                return self.send(200, self.room.share())
            if path == "/api/export.csv":
                return self.export_csv()
            if re.fullmatch(r"/api/drawings/[a-f0-9]{64}", path):
                key = path.rsplit("/", 1)[1]
                if key in self.room.index:
                    return self.send(200, self.room.detail(key))
            if re.fullmatch(r"/original/[a-f0-9]{64}", path):
                key = path.rsplit("/", 1)[1]
                if key in self.room.paths:
                    return self.file(self.room.paths[key], original=True)
            if re.fullmatch(r"/thumbnail/[a-f0-9]{64}", path):
                key = path.rsplit("/", 1)[1]
                if key in self.room.index:
                    thumbnail = self.room.thumbnail(key)
                    if thumbnail is not None:
                        return self.file(thumbnail)
            if path.startswith("/cache/"):
                target = (self.room.cache / path[len("/cache/"):]).resolve()
                if target.is_relative_to(self.room.cache.resolve()) and target.suffix.lower() in {".png", ".jpg", ".jpeg", ".svg", ".webp"}:
                    return self.file(target)
            self.send(404, {"error": "요청한 항목이 없습니다."})
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        except Exception as exc:
            self.send(500, {"error": "자료를 읽지 못했습니다. 잠시 후 다시 시도해 주세요."})
            sys.stderr.write(type(exc).__name__ + "\n")

    def do_POST(self):
        try:
            origin = self.headers.get("Origin")
            if origin and origin != "http://" + self.headers.get("Host", ""):
                return self.send(403, {"error": "앱 화면에서 다시 시도해 주세요."})
            if not self.authenticated():
                return self.send(401, {"error": "접근 코드가 필요합니다."})
            size = int(self.headers.get("Content-Length", "0"))
            if size < 1 or size > 64 * 1024:
                return self.send(400, {"error": "요청 크기를 확인해 주세요."})
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict):
                raise ValueError("입력값을 확인해 주세요.")
            path = urlsplit(self.path).path
            match = re.fullmatch(r"/api/drawings/([a-f0-9]{64})/(state|comments|preview)", path)
            if match and match[1] in self.room.index:
                key, action = match.groups()
                if action == "state":
                    return self.update_state(key, body)
                if action == "preview":
                    return self.send(202, self.room.request_detail(key))
                return self.add_comment(key, body)
            match = re.fullmatch(r"/api/comments/([a-f0-9]{32})/resolve", path)
            if match:
                if not isinstance(body.get("resolved"), bool):
                    raise ValueError("해결 상태를 확인해 주세요.")
                with self.room.connect() as conn:
                    row = conn.execute("SELECT * FROM comments WHERE id=?", (match[1],)).fetchone()
                    if not row:
                        return self.send(404, {"error": "의견이 없습니다."})
                    conn.execute("UPDATE comments SET resolved=? WHERE id=?", (int(body["resolved"]), match[1]))
                    row = conn.execute("SELECT * FROM comments WHERE id=?", (match[1],)).fetchone()
                return self.send(200, self.room.comment(row))
            self.send(404, {"error": "요청한 항목이 없습니다."})
        except (ValueError, TypeError, KeyError) as exc:
            self.send(400, {"error": str(exc) or "입력값을 확인해 주세요."})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as exc:
            self.send(500, {"error": "저장하지 못했습니다. 다시 시도해 주세요."})
            sys.stderr.write(type(exc).__name__ + "\n")

    def update_state(self, key, body):
        if "status" in body and body["status"] not in STATUSES:
            raise ValueError("검토 상태를 확인해 주세요.")
        if "starred" in body and not isinstance(body["starred"], bool):
            raise ValueError("즐겨찾기 값을 확인해 주세요.")
        with self.room.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            state = self.room.state(conn.execute("SELECT * FROM states WHERE drawing_id=?", (key,)).fetchone())
            state.update({k: body[k] for k in ("status", "starred") if k in body})
            stamp = now()
            conn.execute("INSERT INTO states VALUES (?,?,?,?) ON CONFLICT(drawing_id) DO UPDATE SET status=excluded.status,starred=excluded.starred,updated_at=excluded.updated_at",
                         (key, state["status"], int(state["starred"]), stamp))
            state["updatedAt"] = stamp
        return self.send(200, state)

    def add_comment(self, key, body):
        author, text = body.get("author", ""), body.get("text", "")
        if not isinstance(author, str) or not 1 <= len(author.strip()) <= 60:
            raise ValueError("작성자 이름을 1~60자로 입력해 주세요.")
        if not isinstance(text, str) or not 1 <= len(text.strip()) <= 5000:
            raise ValueError("의견을 1~5,000자로 입력해 주세요.")
        page = body.get("page", 1)
        if isinstance(page, bool) or not isinstance(page, int) or not 1 <= page <= 100000:
            raise ValueError("페이지 번호를 확인해 주세요.")
        x, y = body.get("x"), body.get("y")
        if (x is None) != (y is None):
            raise ValueError("핀 위치를 확인해 주세요.")
        if x is not None and (not isinstance(x, (int, float)) or not isinstance(y, (int, float)) or not (0 <= x <= 1 and 0 <= y <= 1)):
            raise ValueError("도면 안의 위치를 선택해 주세요.")
        identifier, stamp = uuid.uuid4().hex, now()
        with self.room.connect() as conn:
            conn.execute("INSERT INTO comments VALUES (?,?,?,?,?,?,?,?,0)", (identifier, key, author.strip(), text.strip(), page, x, y, stamp))
            row = conn.execute("SELECT * FROM comments WHERE id=?", (identifier,)).fetchone()
        return self.send(201, self.room.comment(row))

    def export_csv(self):
        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(["도면명", "공장 단서", "분류", "검토 상태", "즐겨찾기", "작성자", "의견", "페이지", "핀 X", "핀 Y", "해결", "작성시각", "원본 SHA256"])
        statuses = {"unreviewed": "미검토", "reviewed": "검토완료", "discuss": "논의필요", "hold": "보류"}
        def safe(value):
            value = str(value if value is not None else "")
            return "'" + value if value.lstrip().startswith(("=", "+", "-", "@")) else value
        with self.room.connect() as conn:
            for item in self.room.items:
                state = self.room.state(conn.execute("SELECT * FROM states WHERE drawing_id=?", (item["id"],)).fetchone())
                comments = list(conn.execute("SELECT * FROM comments WHERE drawing_id=? ORDER BY created_at", (item["id"],)))
                if not comments and state["status"] == "unreviewed" and not state["starred"]:
                    continue
                for c in comments or [None]:
                    writer.writerow([safe(v) for v in [item["name"], item["site"], item["category"], statuses[state["status"]],
                        "Y" if state["starred"] else "", c["author"] if c else "", c["text"] if c else "", c["page"] if c else "",
                        c["x"] if c else "", c["y"] if c else "", ("해결" if c["resolved"] else "미해결") if c else "", c["created_at"] if c else "", item["id"]]])
        self.send(200, "\ufeff" + output.getvalue(), "text/csv; charset=utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=APP.parent / "건물3D 후보도면")
    parser.add_argument("--data", type=Path, default=APP / "data")
    parser.add_argument("--cache", type=Path, default=APP / "cache")
    parser.add_argument("--port", type=int, default=0)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--ready-file", type=Path)
    args = parser.parse_args()
    room = ReviewRoom(args.root, args.data, args.cache, args.port)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.daemon_threads = True
    server.room = room
    room.port = server.server_address[1]
    metadata = {**room.identity(), "pid": os.getpid(), "host": args.host, "port": room.port,
                "startedAt": now(), "root": str(room.root), "progress": room.progress(),
                "recoveredPreviews": len(room.recovered_previews)}
    atomic_json(args.data / "server.json", metadata)
    if args.ready_file:
        atomic_json(args.ready_file.resolve(), metadata)
    print(json.dumps(metadata, ensure_ascii=True), flush=True)
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
