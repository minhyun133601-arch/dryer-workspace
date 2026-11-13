"""Verify app previews, then remove only identified DWG-derived PDFs.

Default is a read-only dry run. Apply explicitly with --apply using the 64-bit
workstation-tools Python (PyMuPDF and Pillow). No recursive deletion is used.
Original documents, including the 115 source PDFs, are never edited or removed.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import csv
from datetime import datetime, timezone
import hashlib
import html
import io
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit
import uuid


APP = Path(__file__).resolve().parent


def stamp():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def digest(path):
    result = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def inside(path, directory, label):
    resolved, boundary = path.resolve(), directory.resolve()
    require(resolved != boundary and resolved.is_relative_to(boundary), f"{label}: 지정한 폴더 밖 경로입니다: {path}")
    return resolved


def atomic_bytes(path, payload):
    temporary = path.with_name(path.name + "." + uuid.uuid4().hex + ".tmp")
    try:
        temporary.write_bytes(payload)
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()


def atomic_json(path, value):
    atomic_bytes(path, json.dumps(value, ensure_ascii=False, indent=2).encode("utf-8"))


def validate(root, cache, expected_count):
    """Validate every candidate before returning any actionable deletion plan."""
    import fitz
    from PIL import Image

    root, cache = root.resolve(), cache.resolve()
    pdf_root = inside(root / "PDF 도면", root, "파생 PDF 폴더")
    csv_path = root / "00_도면목록.csv"
    csv_bytes = csv_path.read_bytes()
    reader = csv.DictReader(io.StringIO(csv_bytes.decode("utf-8-sig"), newline=""))
    fields = reader.fieldnames
    rows = list(reader)
    require(fields is not None and len(rows) == 758, "원본 목록 758개를 확인할 수 없습니다.")
    identifiers = [r["SHA256"] for r in rows]
    require(len(set(identifiers)) == len(rows), "원본 SHA가 중복되어 대응을 확정할 수 없습니다.")
    require(all(re.fullmatch(r"[a-f0-9]{64}", sha) for sha in identifiers), "잘못된 원본 SHA 값이 있습니다.")
    require(sum(r["확장자"].lower() == ".pdf" for r in rows) == 115, "원본 PDF 115개를 확인할 수 없습니다.")
    dwg_by_prefix = defaultdict(list)
    for row in rows:
        original_rel = row.get("원본현재상대경로") or row["현재상대경로"]
        original = inside(root / original_rel, root, "원본")
        require(original.is_file(), f"원본이 없습니다: {original_rel}")
        if row["확장자"].lower() == ".dwg":
            dwg_by_prefix[row["SHA256"][:12]].append(row)
    candidates = sorted(pdf_root.rglob("*.pdf"))
    require(len(candidates) == expected_count,
            f"생성 PDF 수가 예상과 다릅니다: 실제 {len(candidates)} / 예상 {expected_count}. 삭제하지 않습니다.")
    plans, errors = [], []
    for candidate in candidates:
        try:
            pdf = inside(candidate, pdf_root, "삭제 대상 PDF")
            require(pdf.is_file() and pdf.suffix.lower() == ".pdf", f"PDF 파일이 아닙니다: {pdf}")
            match = re.search(r"__([a-f0-9]{12})$", pdf.stem)
            require(match is not None, f"SHA 이름이 없는 PDF입니다: {pdf.name}")
            matches = dwg_by_prefix.get(match[1], [])
            require(len(matches) == 1, f"원본 DWG가 유일하지 않습니다: {pdf.name}")
            row = matches[0]
            sha = row["SHA256"]
            original_rel = row.get("원본현재상대경로") or row["현재상대경로"]
            original = inside(root / original_rel, root, "원본 DWG")
            require(original.suffix.lower() == ".dwg", f"원본이 DWG가 아닙니다: {original}")
            require(digest(original) == sha, f"원본 DWG SHA가 다릅니다: {original.name}")
            cache_dir = inside(cache / sha, cache, "미리보기 폴더")
            meta_path = inside(cache_dir / "meta.json", cache_dir, "미리보기 메타")
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            require(meta.get("status") == "ready" and meta.get("id") == sha, f"미리보기가 준비되지 않았습니다: {sha}")
            derived_rel = meta.get("derivedPdf")
            require(isinstance(derived_rel, str) and derived_rel, f"PDF 유래 정보가 없습니다: {sha}")
            require(inside(root / derived_rel, pdf_root, "메타의 파생 PDF") == pdf, f"미리보기와 PDF 경로가 다릅니다: {sha}")
            with fitz.open(pdf) as document:
                require(document.is_pdf and not document.needs_pass, f"검증 가능한 PDF가 아닙니다: {pdf.name}")
                page_count = document.page_count
            require(page_count > 0, f"PDF 페이지가 없습니다: {pdf.name}")
            require(type(meta.get("derivedPageCount")) is int and meta["derivedPageCount"] == page_count,
                    f"PDF 페이지 수와 변환 기록이 다릅니다: {pdf.name}")
            pages = meta.get("pages")
            require(isinstance(pages, list) and len(pages) == page_count, f"전체 페이지 미리보기가 없습니다: {pdf.name}")
            images, image_paths = [], set()
            for page_number, page in enumerate(pages, 1):
                require(isinstance(page, dict), f"페이지 기록이 잘못되었습니다: {sha}/{page_number}")
                parsed = urlsplit(page.get("src", ""))
                prefix = f"/cache/{sha}/"
                decoded = unquote(parsed.path)
                require(not parsed.scheme and not parsed.netloc and not parsed.query and not parsed.fragment and decoded.startswith(prefix),
                        f"이미지 경로가 도면 캐시를 가리키지 않습니다: {sha}/{page_number}")
                image_path = inside(cache_dir / decoded[len(prefix):], cache_dir, "PNG 미리보기")
                require(image_path.suffix.lower() == ".png" and image_path.is_file(), f"PNG 미리보기가 없습니다: {image_path}")
                require(image_path not in image_paths, f"동일 PNG가 여러 페이지에 중복되었습니다: {image_path}")
                image_paths.add(image_path)
                require(type(page.get("width")) is int and type(page.get("height")) is int,
                        f"미리보기 크기 기록이 잘못되었습니다: {image_path}")
                with Image.open(image_path) as image:
                    require(image.format == "PNG", f"실제 PNG 형식이 아닙니다: {image_path}")
                    image.verify()
                with Image.open(image_path) as image:
                    image.load()
                    require(image.width > 0 and image.height > 0 and image.size == (page["width"], page["height"]),
                            f"PNG 실제 크기와 메타 크기가 다릅니다: {image_path}")
                    width, height = image.size
                images.append({"page": page_number, "path": str(image_path.relative_to(cache)).replace("\\", "/"),
                               "width": width, "height": height, "sha256": digest(image_path)})
            plans.append({"drawingId": sha, "originalPath": str(original.relative_to(root)).replace("\\", "/"),
                          "originalSha256": sha, "derivedPdf": str(pdf.relative_to(root)).replace("\\", "/"),
                          "pdfSha256": digest(pdf), "pdfBytes": pdf.stat().st_size, "pdfPageCount": page_count,
                          "previewCount": len(images), "previews": images,
                          "metaSha256": digest(meta_path), "warnings": meta.get("warnings", [])})
        except Exception as exc:
            errors.append(f"{candidate.name}: {exc}")
    require(not errors, "전체 삭제를 중단했습니다. 검증 실패:\n" + "\n".join(errors))
    require(len(plans) == expected_count and len({p["drawingId"] for p in plans}) == expected_count,
            "파생 PDF와 원본 DWG의 일대일 대응을 확인할 수 없습니다.")
    return {"root": str(root), "cache": str(cache), "generatedFolder": str(pdf_root),
            "originalCount": len(rows), "originalPdfCount": 115, "csvSha256": hashlib.sha256(csv_bytes).hexdigest(),
            "count": len(plans), "bytes": sum(p["pdfBytes"] for p in plans), "plan": plans}, fields, rows, csv_bytes


def replacement_files(root, fields, rows, count):
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=fields, lineterminator="\r\n")
    writer.writeheader()
    for original in rows:
        row = dict(original)
        if row["확장자"].lower() == ".dwg":
            row["현재상대경로"] = row["원본현재상대경로"]
            row["PDF상태"] = "앱 미리보기 사용"
            for field in ("PDF상대경로", "PDF_SHA256", "PDF페이지", "PDF오류"):
                row[field] = ""
            row["PDF주의사항"] = "도면 검토실 앱의 미리보기 경고와 원본 CAD를 확인하세요. 파생 PDF 정리 기록은 도면검토앱/data/pdf_cleanup_receipt.json에 보존했습니다."
        writer.writerow(row)
    html_page = """<!doctype html>
<html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>도면 검토실 안내</title>
<style>body{margin:0;background:#f3f5f7;color:#172b3a;font:17px/1.8 'Malgun Gothic',sans-serif}main{max-width:720px;margin:10vh auto;padding:40px;background:white;border-radius:18px;box-shadow:0 12px 50px #172b3a12}h1{font-size:32px}a{color:#00695c}a.button{display:inline-block;padding:12px 22px;margin:12px 0;background:#00695c;color:white;text-decoration:none;border-radius:8px}code{background:#eff3f5;padding:3px 6px}li{margin:10px 0}</style>
<main><h1>도면 검토실</h1><p>도면을 하나씩 크게 보며 넘기고, 위치에 핀을 꽂아 의견을 기록하는 앱으로 이동했습니다.</p>
<a class="button" href="http://127.0.0.1:8767/">실행 중인 도면 검토실 열기</a>
<ol><li>처음 여는 경우 근거 자료 폴더의 <code>도면 검토 시작.cmd</code>를 더블클릭하세요. 앱 폴더 안의 같은 이름 파일로도 실행할 수 있습니다.</li>
<li>앱에서 검색·분류를 선택하고 이전/다음 버튼 또는 키보드 방향키로 도면을 확인하세요.</li>
<li>같은 사내망의 다른 분에게는 앱의 공유 버튼으로 표시되는 링크를 전달하세요. 이 PC와 앱이 켜져 있어야 합니다.</li></ol>
<p>원본 자료 758개와 원본 PDF 115개를 유지했습니다. DWG 변환 PDF COUNT개는 모든 페이지의 앱 미리보기와 원본 DWG를 검증한 뒤 정리했습니다. 원본 다운로드는 앱에서 가능합니다.</p>
<p>이전 목록 원문과 정리 기록은 <code>도면검토앱/data/</code>에 보존되어 있습니다.</p></main></html>
""".replace("COUNT", html.escape(str(count)))
    guide = f"""도면 검토실 안내

실행: 근거 자료 폴더의 '도면 검토 시작.cmd'를 더블클릭하세요.
앱 폴더: ../도면검토앱/ (앱 폴더 안 실행 파일로도 시작할 수 있습니다.)
실행 중인 앱: http://127.0.0.1:8767/

도면을 하나씩 크게 보고 이전/다음 버튼이나 키보드 방향키로 넘길 수 있습니다.
검색·공장·분류 필터, 즐겨찾기, 검토 상태, 위치 핀과 의견 기록을 지원합니다.
다른 분과 함께 보려면 앱의 공유 버튼에 표시되는 링크를 사용하세요.
같은 사내망에서 이 PC와 앱이 켜져 있어야 하며 방화벽에 따라 접속이 제한될 수 있습니다.

원본 자료 758개와 원본 PDF 115개는 유지했습니다.
원본 DWG/에는 원본 DWG 272개를 그대로 보관합니다.
PDF 도면/ 아래 생성 PDF {count}개는 대응 원본 DWG SHA-256과 PDF 전체 페이지의 PNG 미리보기를 검증한 뒤 정리했습니다.
PNG 미리보기, 페이지 수와 주의사항은 ../도면검토앱/cache/에 보존합니다.
이전 CSV·HTML 및 정리 기록은 ../도면검토앱/data/에 보존합니다.
00_도면목록.csv의 DWG 경로는 원본 DWG를 가리킵니다.

미리보기는 검토용입니다. CAD 글꼴, 외부참조, 특수 객체 및 출력 축척은 원본과 다를 수 있으니 앱의 경고와 원본을 함께 확인하세요.
분류와 공장·동 단서는 파일명과 출처에 따른 것이며 최신 준공 상태를 확정하지 않습니다.
안내 갱신: {stamp()}
"""
    return {root / "00_도면목록.csv": ("\ufeff" + output.getvalue()).encode("utf-8"),
            root / "00_도면목록.html": html_page.encode("utf-8"), root / "00_안내.txt": guide.encode("utf-8")}


def apply_plan(root, cache, data, validation, fields, rows, csv_bytes):
    """All potentially failing validation and backup checks precede deletions."""
    root, cache, data = root.resolve(), cache.resolve(), data.resolve()
    pdf_root = inside(root / "PDF 도면", root, "삭제 대상 폴더")
    require(not data.is_relative_to(root), "백업 폴더는 원본 자료 폴더 밖에 있어야 합니다.")
    backups = {data / "legacy_도면목록.csv": csv_bytes,
               data / "legacy_도면목록.html": (root / "00_도면목록.html").read_bytes(),
               data / "legacy_안내.txt": (root / "00_안내.txt").read_bytes()}
    for path, payload in backups.items():
        require(not path.exists() or path.read_bytes() == payload, f"다른 기존 백업이 있어 중단합니다: {path}")
    replacements = replacement_files(root, fields, rows, validation["count"])
    # Recheck all inputs immediately before mutations, preventing a stale plan.
    require(digest(root / "00_도면목록.csv") == validation["csvSha256"], "검증 후 원본 목록이 변경되었습니다.")
    current = {str(inside(p, pdf_root, "PDF 최종 확인")) for p in pdf_root.rglob("*.pdf")}
    expected = set()
    for item in validation["plan"]:
        pdf = inside(root / item["derivedPdf"], pdf_root, "PDF 최종 확인")
        expected.add(str(pdf))
        original = inside(root / item["originalPath"], root, "DWG 최종 확인")
        require(digest(original) == item["originalSha256"], f"검증 후 DWG가 변경되었습니다: {original.name}")
        require(digest(pdf) == item["pdfSha256"], f"검증 후 PDF가 변경되었습니다: {pdf.name}")
        cache_dir = inside(cache / item["drawingId"], cache, "캐시 최종 확인")
        require(digest(inside(cache_dir / "meta.json", cache_dir, "메타 최종 확인")) == item["metaSha256"], "검증 후 미리보기 기록이 변경되었습니다.")
        for image in item["previews"]:
            preview = inside(cache / image["path"], cache_dir, "PNG 최종 확인")
            require(digest(preview) == image["sha256"], f"검증 후 PNG가 변경되었습니다: {preview.name}")
    require(current == expected, "검증 후 생성 PDF 목록이 변경되었습니다.")
    data.mkdir(parents=True, exist_ok=True)
    for path, payload in backups.items():
        if not path.exists():
            with path.open("xb") as output:
                output.write(payload)
    receipt_path = data / "pdf_cleanup_receipt.json"
    receipt = {"status": "validated", "validatedAt": stamp(), **validation,
               "backups": [str(p) for p in backups], "deleted": [],
               "replacementHashes": {p.name: hashlib.sha256(b).hexdigest() for p, b in replacements.items()}}
    atomic_json(receipt_path, receipt)
    try:
        # Refresh entry points first. Failure here never deletes a source PDF.
        for path, payload in replacements.items():
            atomic_bytes(path, payload)
        receipt["status"] = "deleting"
        atomic_json(receipt_path, receipt)
        for item in validation["plan"]:
            # Explicit containment check immediately before each individual unlink.
            target = inside(root / item["derivedPdf"], pdf_root, "삭제 직전 PDF")
            require(target.suffix.lower() == ".pdf" and target.is_file(), "삭제 대상이 PDF 파일이 아닙니다.")
            target.unlink()
            receipt["deleted"].append(item["derivedPdf"])
            atomic_json(receipt_path, receipt)
        receipt["status"] = "completed"
        receipt["completedAt"] = stamp()
        atomic_json(receipt_path, receipt)
    except Exception as exc:
        receipt["status"] = "interrupted"
        receipt["error"] = str(exc)
        atomic_json(receipt_path, receipt)
        raise
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(os.environ.get("DRAWING_REVIEW_ROOT") or APP.parent / "건물3D 후보도면"))
    parser.add_argument("--cache", type=Path, default=Path(os.environ.get("DRAWING_REVIEW_CACHE") or APP / "cache"))
    parser.add_argument("--data", type=Path, default=Path(os.environ.get("DRAWING_REVIEW_DATA") or APP / "data"))
    parser.add_argument("--expected-count", type=int, default=70)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="읽기 전용 검증 (기본)")
    mode.add_argument("--apply", action="store_true", help="전체 검증 후 생성 PDF만 삭제")
    args = parser.parse_args()
    try:
        require(args.expected_count > 0, "예상 PDF 수는 양수여야 합니다.")
        validation, fields, rows, csv_bytes = validate(args.root, args.cache, args.expected_count)
        if args.apply:
            receipt = apply_plan(args.root, args.cache, args.data, validation, fields, rows, csv_bytes)
            print(json.dumps({"mode": "apply", "status": receipt["status"], "deleted": len(receipt["deleted"]),
                              "receipt": str(args.data.resolve() / "pdf_cleanup_receipt.json")}, ensure_ascii=True))
        else:
            print(json.dumps({"mode": "dry-run", "status": "validated", "count": validation["count"],
                              "bytes": validation["bytes"], "pages": sum(p["pdfPageCount"] for p in validation["plan"]),
                              "originalsPreserved": validation["originalCount"], "originalPdfsPreserved": 115}, ensure_ascii=True))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
