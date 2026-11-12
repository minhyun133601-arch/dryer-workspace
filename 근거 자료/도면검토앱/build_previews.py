"""Build private, read-only drawing previews. Source documents are never modified.

Run with the workstation-tools (64-bit) Python, which provides PyMuPDF/Pillow/ezdxf.
The application itself has no dependency on these optional conversion packages.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import csv
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
import zipfile
from collections import Counter

APP = Path(__file__).resolve().parent
DEFAULT_ROOT = APP.parent / "건물3D 후보도면"
CAD_TOOLS = APP / "tools/libredwg"
OFFICE_SCRIPT = APP / "tools/convert-office.ps1"
MAX_SIDE = 3600
CAD_WARNING = "원본을 바탕으로 만든 2D 검토용 미리보기입니다. SHX 글꼴, 외부참조, 특수 객체, 3D 및 출력 축척은 원본 CAD와 다를 수 있습니다."


def atomic_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + "." + uuid.uuid4().hex + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    for attempt in range(20):
        try:
            tmp.replace(path)
            return
        except PermissionError:
            if attempt == 19:
                raise
            time.sleep(0.05)


def read_rows(root):
    with (root / "00_도면목록.csv").open(encoding="utf-8-sig", newline="") as fp:
        return list(csv.DictReader(fp))


def original_path(root, row):
    return root / (row.get("원본현재상대경로") or row["현재상대경로"])


def derived_pdf(root, row):
    rel = row.get("PDF상대경로")
    if rel and (root / rel).is_file():
        return root / rel
    # Earlier conversion was interrupted before its manifest update. Recover only
    # the exact SHA-named output, never an arbitrary similarly named document.
    matches = list((root / "PDF 도면").rglob("*__" + row["SHA256"][:12] + ".pdf"))
    return matches[0] if len(matches) == 1 else None


def page_record(cache_dir, index, width, height, label=None, filename=None):
    name = filename or f"page-{index:03d}.png"
    item = {"src": f"/cache/{cache_dir.name}/{name}", "width": width, "height": height}
    if label:
        item["label"] = label
    return item


def render_pdf(source, dest, label_prefix=""):
    import fitz
    result = []
    with fitz.open(source) as doc:
        if doc.needs_pass:
            raise ValueError("비밀번호가 설정되어 미리보기를 만들 수 없습니다.")
        for i, page in enumerate(doc):
            scale = min(5, MAX_SIDE / max(page.rect.width, page.rect.height))
            pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
            pix.save(dest / f"page-{i+1:03d}.png")
            result.append(page_record(dest, i+1, pix.width, pix.height, f"{label_prefix}{i+1}쪽"))
    if not result:
        raise ValueError("표시할 페이지가 없습니다.")
    return result


def render_image(source, dest, sha):
    from PIL import Image, ImageOps
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)
        # Copying large JPEGs is unnecessary: the application serves the immutable
        # source directly. TIFF/GIF/BMP are normalized for browser compatibility.
        if source.suffix.lower() in (".png", ".jpg", ".jpeg"):
            return [{"src": f"/original/{sha}", "width": image.width, "height": image.height, "label": "원본 이미지"}]
        image.thumbnail((MAX_SIDE, MAX_SIDE))
        image.convert("RGB").save(dest / "page-001.png")
        return [page_record(dest, 1, image.width, image.height)]


def saved_cad_preview(source, dest):
    from PIL import Image, ImageOps
    with tempfile.TemporaryDirectory(prefix="drawing-thumbnail-") as tmp:
        # dwgbmp reads the original without changing it; the explicit target is
        # confined to this conversion's private temporary directory.
        target = Path(tmp) / "preview.bmp"
        result = subprocess.run([str(CAD_TOOLS / "dwgbmp.exe"), str(source), str(target)],
                                capture_output=True, timeout=12, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        if not target.is_file():
            raise ValueError("이 CAD 원본에는 저장 미리보기가 없습니다. 상세 미리보기를 생성하거나 원본을 열어 주세요.")
        with Image.open(target) as image:
            image.load()
            image = ImageOps.exif_transpose(image).convert("RGB")
            if min(image.size) < 20:
                raise ValueError("CAD 저장 미리보기의 크기가 너무 작습니다.")
            image.save(dest / "page-001.png")
            return [page_record(dest, 1, image.width, image.height, "저장 미리보기 · 해상도 제한")]


def embedded_office_images(source, dest):
    """Extract immutable embedded pictures, never claim they are full pages."""
    from PIL import Image, ImageOps
    import hashlib
    pictures = []
    seen = set()
    def add(data, label):
        try:
            with Image.open(io.BytesIO(data)) as original:
                original.load()
                image = ImageOps.exif_transpose(original).convert("RGB")
                if image.width * image.height < 50000 or min(image.size) < 80:
                    return
                key = hashlib.sha256(image.tobytes()).hexdigest()
                if key in seen:
                    return
                seen.add(key)
                image.thumbnail((MAX_SIDE, MAX_SIDE))
                pictures.append((image.copy(), label))
        except Exception:
            pass
    if zipfile.is_zipfile(source):
        with zipfile.ZipFile(source) as archive:
            for member in archive.infolist():
                if "/media/" in member.filename and member.file_size < 80_000_000:
                    add(archive.read(member), member.filename.rsplit("/", 1)[-1])
    else:
        import olefile
        with olefile.OleFileIO(source) as ole:
            for stream_name in ole.listdir():
                data = ole.openstream(stream_name).read()
                # Office binary blips include ordinary PNG/JPEG payloads.
                for signature in (b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff", b"\xd7\xcd\xc6\x9a"):
                    position, attempts = 0, 0
                    while attempts < 100:
                        position = data.find(signature, position)
                        if position < 0:
                            break
                        add(data[position:], "/".join(stream_name))
                        position += len(signature)
                        attempts += 1
    pictures.sort(key=lambda pair: pair[0].width * pair[0].height, reverse=True)
    pages = []
    for index, (image, label) in enumerate(pictures[:40], 1):
        image.save(dest / f"page-{index:03d}.png")
        pages.append(page_record(dest, index, image.width, image.height, f"삽입그림 {index} · {label}"))
    if not pages:
        raise ValueError("추출할 수 있는 큰 삽입그림이 없습니다. 상세 미리보기 생성 또는 원본 열기로 확인해 주세요.")
    return pages


def render_cad(source, dest):
    import ezdxf
    from ezdxf import recover
    from ezdxf.addons.drawing import Frontend, RenderContext, config, layout, pymupdf
    from PIL import Image
    warnings = [CAD_WARNING]
    with tempfile.TemporaryDirectory(prefix="drawing-dxf-") as tmp:
        tmp = Path(tmp)
        copied = tmp / "source.dwg"
        shutil.copyfile(source, copied)
        dxf = tmp / "source.dxf"
        decoded = subprocess.run([str(CAD_TOOLS / "dwg2dxf.exe"), "-y", "-o", str(dxf), str(copied)], capture_output=True, timeout=80, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        if not dxf.exists() or dxf.stat().st_size < 100:
            raise ValueError("DWG 해석에 실패했습니다. 원본 CAD 프로그램에서 확인해 주세요.")
        if b"ERROR" in decoded.stderr or b"Warning" in decoded.stderr:
            warnings.append("도면 해석 중 일부 객체·참조에 관한 경고가 있었습니다. 원본과 대조해 주세요.")
        try:
            doc = ezdxf.readfile(dxf)
        except Exception:
            doc, auditor = recover.readfile(dxf)
            if auditor.has_errors:
                warnings.append("DXF 복구를 거쳐 표시했습니다. 일부 객체가 생략되었을 수 있습니다.")
        # Substitute missing proprietary SHX fonts with a readable Korean font.
        korean_font = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts/malgun.ttf"
        if korean_font.exists():
            for style in doc.styles:
                style.dxf.font = str(korean_font)
        ctx = RenderContext(doc)
        cfg = config.Configuration(background_policy=config.BackgroundPolicy.WHITE, color_policy=config.ColorPolicy.BLACK,
                                   min_lineweight=0.03, hatching_timeout=4, max_flattening_distance=0.05)
        pages = []
        layouts = [doc.modelspace()] + [doc.layouts.get(n) for n in doc.layout_names_in_taborder() if n.lower() != "model"]
        for drawing_layout in layouts:
            if len(drawing_layout) == 0:
                continue
            backend = pymupdf.PyMuPdfBackend()
            try:
                Frontend(ctx, backend, config=cfg).draw_layout(drawing_layout, finalize=True)
                # 381 mm at 240 dpi produces a 3600-pixel long side.
                image_bytes = backend.get_pixmap_bytes(layout.Page(0, 0, max_width=381, max_height=381, margins=layout.Margins.all(2)), fmt="png", dpi=240)
                with Image.open(io.BytesIO(image_bytes)) as image:
                    if image.width < 10 or image.height < 10:
                        continue
                    index = len(pages) + 1
                    (dest / f"page-{index:03d}.png").write_bytes(image_bytes)
                    pages.append(page_record(dest, index, image.width, image.height,
                                             "모형 공간" if drawing_layout.name.lower() == "model" else drawing_layout.name))
            except Exception as exc:
                warnings.append(f"{drawing_layout.name} 배치 미리보기 실패: {str(exc)[:120]}")
        if not pages:
            raise ValueError("도면에서 표시 가능한 2D 객체를 찾지 못했습니다.")
        return pages, warnings


def render_cad_node(source, dest):
    script = APP / "tools/cad-node/render.cjs"
    node = shutil.which("node")
    if not node or not script.is_file():
        raise ValueError("상세 도면 엔진을 찾지 못했습니다. Node.js와 tools/cad-node를 확인해 주세요.")
    output = dest / "detail-001.png"
    report = dest / "detailed-render.json"
    completed = subprocess.run([node, "--no-warnings", str(script), str(source), str(output), str(report)],
                               capture_output=True, timeout=120, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if completed.returncode or not report.is_file() or not output.is_file():
        error = completed.stderr.decode("utf-8", errors="replace")
        raise ValueError("상세 도면 미리보기를 만들지 못했습니다. " + error[-500:])
    data = json.loads(report.read_text(encoding="utf-8"))
    pages = [page_record(dest, 1, data["width"], data["height"],
                         "주영역 확대 · 모형 공간" if data.get("autoFocusUsed") else "모형 공간", output.name)]
    if data.get("overview"):
        overview = data["overview"]
        pages.append(page_record(dest, 2, overview["width"], overview["height"], "모형 공간 · 전체 범위", "detail-001-overview.png"))
    return pages, [CAD_WARNING] + data.get("warnings", [])


def cleanup_owned_office(job_dir):
    """Terminate only conversion-owned Office processes after a timeout."""
    ownership = job_dir / "ownership.json"
    if not ownership.exists():
        return
    try:
        import psutil
        data = json.loads(ownership.read_text(encoding="utf-8-sig"))
        for owned in data.get("ownedProcesses", []):
            if not owned.get("allowKill"):
                continue
            process = psutil.Process(int(owned["id"]))
            if process.name().lower().removesuffix(".exe") != owned["name"].lower():
                continue
            # .NET UTC ticks and UNIX creation time must identify the same process.
            expected = (int(owned["startTicks"]) - 621355968000000000) / 10000000
            if abs(process.create_time() - expected) < 1:
                process.terminate()
    except Exception:
        pass


def render_office(source, dest):
    ext = source.suffix.lower()
    mode = "excel" if ext in (".xls", ".xlsx") else "word" if ext in (".doc", ".docx") else "powerpoint"
    with tempfile.TemporaryDirectory(prefix="heechang-office-") as temp:
        job = Path(temp)
        shutil.copyfile(source, job / ("source" + ext))
        atomic_json(job / "job.json", {"sourceName": "source" + ext, "format": mode})
        try:
            completed = subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(OFFICE_SCRIPT), "-JobPath", str(job)],
                                       capture_output=True, timeout=100, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        except subprocess.TimeoutExpired:
            cleanup_owned_office(job)
            raise ValueError("Office 미리보기 변환 시간이 초과되었습니다.")
        output = job / "output.pdf"
        if not output.is_file():
            result = job / "result.json"
            detail = json.loads(result.read_text(encoding="utf-8-sig")) if result.exists() else {}
            raise ValueError("Office 미리보기를 만들지 못했습니다. " + str(detail.get("diagnostic", ""))[:180])
        return render_pdf(output, dest), ["원본 문서를 읽기 전용으로 열어 저장된 인쇄 영역에 따라 미리보기를 만들었습니다."]


def convert_one(root, cache, row, force=False, detailed=False, engine="node"):
    sha = row["SHA256"]
    dest = cache / sha
    dest.mkdir(parents=True, exist_ok=True)
    target = dest / "meta.json"
    previous = json.loads(target.read_text(encoding="utf-8")) if target.exists() else None
    if previous and not force and previous.get("status") == "ready":
        return previous
    ext = row["확장자"].lower()
    kind = "dwg" if ext in (".dwg", ".bak") else "pdf" if ext == ".pdf" else "image" if ext in (".png", ".jpg", ".jpeg", ".tif", ".bmp") else "office" if ext in (".xls", ".xlsx", ".doc", ".docx", ".ppt", ".pptx") else "archive" if ext == ".zip" else "document"
    result = {"id": sha, "kind": kind, "status": "processing", "pages": previous.get("pages", []) if previous else [], "warnings": [], "updated": time.time()}
    atomic_json(target, result)
    try:
        source = original_path(root, row)
        if not source.is_file():
            raise FileNotFoundError("원본 파일을 찾을 수 없습니다.")
        derived = derived_pdf(root, row) if kind == "dwg" else None
        if derived:
            result["pages"] = render_pdf(derived, dest)
            result["warnings"] = [CAD_WARNING, "기존에 생성된 검토용 PDF의 모든 페이지를 이미지로 보존했습니다."]
            result["derivedPdf"] = str(derived.relative_to(root)).replace("\\", "/")
            result["derivedPageCount"] = len(result["pages"])
        elif kind == "pdf":
            result["pages"] = render_pdf(source, dest)
        elif kind == "image":
            result["pages"] = render_image(source, dest, sha)
        elif kind == "dwg":
            if detailed:
                result["pages"], result["warnings"] = render_cad_node(source, dest) if engine == "node" else render_cad(source, dest)
                result["previewQuality"] = "detailed"
            else:
                result["pages"] = saved_cad_preview(source, dest)
                result["previewQuality"] = "saved"
                result["warnings"] = ["CAD 파일에 저장된 작은 미리보기입니다. 도면을 식별하는 용도이며 치수·작은 글자 확인에는 해상도가 부족합니다. 상세 미리보기를 생성하거나 원본을 열어 주세요."]
        elif kind == "office":
            if detailed:
                result["pages"], result["warnings"] = render_office(source, dest)
                result["previewQuality"] = "detailed"
            else:
                result["pages"] = embedded_office_images(source, dest)
                result["previewQuality"] = "embedded"
                result["warnings"] = ["문서에 삽입된 그림만 추출한 미리보기입니다. 시트·문서의 전체 페이지나 도형·텍스트 배치를 재현하지 않습니다. 전체 내용은 상세 미리보기를 생성하거나 원본을 열어 확인해 주세요."]
        else:
            result["status"] = "unsupported"
            result["warnings"] = ["압축 파일은 원본 다운로드로 확인해 주세요." if kind == "archive" else "이 형식은 원본 프로그램에서 열어 확인해 주세요."]
        if result["pages"]:
            result["status"] = "ready"
    except Exception as exc:
        if detailed and previous and previous.get("status") == "ready":
            result = previous
            result["detailedStatus"] = "failed"
            result["detailedError"] = str(exc)[:600]
            result["warnings"] = list(previous.get("warnings", [])) + ["상세 미리보기 생성 실패: " + str(exc)[:240]]
        else:
            result["status"] = "failed" if detailed or kind not in ("office", "dwg") else "unsupported"
            result["error"] = str(exc)[:600]
            result["warnings"] = [str(exc)[:300]]
    result["updated"] = time.time()
    # A launch-time quick scan can race an on-demand detailed conversion. Never
    # replace a finished detailed preview with a later saved/embedded thumbnail.
    if result.get("previewQuality") != "detailed" and target.exists():
        try:
            current = json.loads(target.read_text(encoding="utf-8"))
            if current.get("status") == "ready" and current.get("previewQuality") == "detailed":
                return current
        except (OSError, ValueError):
            pass
    atomic_json(target, result)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    parser.add_argument("--cache", type=Path, default=APP / "cache")
    parser.add_argument("--one")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--detailed", action="store_true", help="Generate full CAD geometry or Office print pages instead of saved/embedded previews")
    parser.add_argument("--engine", choices=["node", "ezdxf"], default="node")
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--verify-derived", action="store_true")
    parser.add_argument("--only", choices=["quick", "cad", "office", "all"], default="all")
    args = parser.parse_args()
    root, cache = args.root.resolve(), args.cache.resolve()
    cache.mkdir(parents=True, exist_ok=True)
    rows = read_rows(root)
    if args.verify_derived:
        import fitz
        from PIL import Image
        indexed = {r["SHA256"][:12]: r for r in rows}
        verified = []
        for pdf in (root / "PDF 도면").rglob("*.pdf"):
            short_sha = pdf.stem.rsplit("__", 1)[-1]
            row = indexed[short_sha]
            sha = row["SHA256"]
            meta = json.loads((cache / sha / "meta.json").read_text(encoding="utf-8"))
            with fitz.open(pdf) as doc:
                count = len(doc)
            assert meta["status"] == "ready" and len(meta["pages"]) == count, str(pdf)
            for page in meta["pages"]:
                image_path = cache / sha / page["src"].rsplit("/", 1)[-1]
                with Image.open(image_path) as image:
                    assert image.size == (page["width"], page["height"])
                    image.verify()
            verified.append({"pdf": pdf.relative_to(root).as_posix(), "id": sha, "pages": count, "verified": True})
        result = {"files": len(verified), "pages": sum(x["pages"] for x in verified), "items": verified}
        atomic_json(cache / "derived_verification.json", result)
        print(json.dumps({"verified": result["files"], "pages": result["pages"]}), flush=True)
        return
    if args.one:
        row = next(r for r in rows if r["SHA256"] == args.one)
        convert_one(root, cache, row, args.force, args.detailed, args.engine)
        return
    def lane(row):
        ext = row["확장자"].lower()
        if ext in (".xls", ".xlsx", ".doc", ".docx", ".ppt", ".pptx"):
            return "office"
        if ext in (".dwg", ".bak") and derived_pdf(root, row) is None:
            return "cad"
        return "quick"
    lanes = {r["SHA256"]: lane(r) for r in rows}
    selected = [r for r in rows if args.only == "all" or lanes[r["SHA256"]] == args.only]
    selected.sort(key=lambda r: ({"quick": 0, "cad": 1, "office": 2}[lanes[r["SHA256"]]], int(r.get("바이트") or 0) if args.detailed else 0))
    counts = Counter()
    processing = set()
    def progress():
        states = Counter()
        for r in rows:
            path = cache / r["SHA256"] / "meta.json"
            if path.exists():
                try:
                    states[json.loads(path.read_text(encoding="utf-8"))["status"]] += 1
                except Exception:
                    pass
        atomic_json(cache / "progress.json", {"ready": states["ready"], "total": len(rows), "processing": len(processing),
                                              "failed": states["failed"], "unsupported": states["unsupported"], "updated": time.time()})
    def job(row):
        sha = row["SHA256"]
        processing.add(sha)
        cmd = [sys.executable, str(Path(__file__).resolve()), "--root", str(root), "--cache", str(cache), "--one", sha]
        if args.force:
            cmd.append("--force")
        if args.detailed:
            cmd.append("--detailed")
            cmd.extend(["--engine", args.engine])
        try:
            with open(os.devnull, "wb") as discard:
                worker = subprocess.Popen(cmd, stdout=discard, stderr=discard, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
                try:
                    worker.wait(timeout=180)
                except subprocess.TimeoutExpired:
                    # venv python.exe launches its base interpreter. Kill this
                    # worker's whole process tree, never unrelated Python jobs.
                    subprocess.run(["taskkill.exe", "/PID", str(worker.pid), "/T", "/F"], stdout=discard, stderr=discard)
                    worker.wait(timeout=10)
                    raise
            p = cache / sha / "meta.json"
            result = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
            if result.get("status") == "processing":
                raise RuntimeError("미리보기 변환 프로세스를 완료하지 못했습니다.")
        except Exception as exc:
            atomic_json(cache / sha / "meta.json", {"id": sha, "kind": lanes[sha], "status": "failed", "pages": [], "warnings": ["미리보기 변환을 완료하지 못했습니다. 원본 파일을 확인해 주세요."], "error": str(exc), "updated": time.time()})
        finally:
            processing.discard(sha)
        return sha
    progress()
    # Excel/Word COM calls use a single lane so isolated sessions cannot conflict.
    for selected_lane in ("quick", "cad", "office"):
        group = [r for r in selected if lanes[r["SHA256"]] == selected_lane]
        with concurrent.futures.ThreadPoolExecutor(max_workers=1 if selected_lane == "office" and args.detailed else args.workers) as pool:
            futures = {pool.submit(job, row): row for row in group}
            pending = set(futures)
            while pending:
                done, pending = concurrent.futures.wait(pending, timeout=3, return_when=concurrent.futures.FIRST_COMPLETED)
                for future in done:
                    row = futures[future]
                    future.result()
                    state = json.loads((cache / row["SHA256"] / "meta.json").read_text(encoding="utf-8"))["status"]
                    counts[state] += 1
                    print(json.dumps({"completed": sum(counts.values()), "selected": len(selected), "state": state, "id": row["SHA256"][:12]}, ensure_ascii=True), flush=True)
                progress()
    progress()
    print(json.dumps(dict(counts)), flush=True)


if __name__ == "__main__":
    main()
