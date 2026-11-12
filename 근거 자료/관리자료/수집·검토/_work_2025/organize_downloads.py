"""Organize saved groupware backup ZIPs without browser/session access.

Usage: python organize_downloads.py manifest.json [--output OUTPUT_DIRECTORY]
Manifest: a JSON list of records with docId/date/docNo/title/sourceUrl/zipPath.
Optional attachments: names expected in the ZIP or {name, path} saved files.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import stat
import sys
import tempfile
import unicodedata
from collections import Counter
from pathlib import Path, PureWindowsPath
from zipfile import BadZipFile, ZipFile

WORKSPACE = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = WORKSPACE / "2025년 자료" / "문서별 폴더"
INDEX_NAME = "문서 색인.json"
VERIFY_NAME = "보관 검증.json"
INVALID = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
RESERVED = re.compile(r"^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)", re.I)
UUID_STEM = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def decode_zip_name(info) -> str:
    if info.flag_bits & 0x800:
        return info.filename
    try:
        return info.filename.encode("cp437").decode("cp949")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return info.filename


def safe_component(value: str, limit: int = 150) -> str:
    value = INVALID.sub("_", unicodedata.normalize("NFC", str(value)))
    value = re.sub(r"\s+", " ", value).strip().rstrip(". ")
    if not value or value in (".", ".."):
        value = "이름 없음"
    if RESERVED.match(value):
        value = "_" + value
    if len(value) > limit:
        suffix = Path(value).suffix
        tag = hashlib.sha256(value.encode("utf-8")).hexdigest()[:8]
        value = value[: max(1, limit - len(suffix) - len(tag) - 1)].rstrip(". ") + "_" + tag + suffix
    return value


def validate_member(info) -> tuple[str, list[str]]:
    name = decode_zip_name(info).replace("\\", "/")
    if name.startswith("/") or PureWindowsPath(name).drive:
        raise ValueError(f"ZIP 절대경로 항목 거부: {name}")
    parts = [part for part in name.split("/") if part not in ("", ".")]
    if any(part == ".." or ":" in part for part in parts):
        raise ValueError(f"ZIP 경로 이탈/대체 스트림 항목 거부: {name}")
    if stat.S_ISLNK(info.external_attr >> 16):
        raise ValueError(f"ZIP 심볼릭 링크 항목 거부: {name}")
    if info.flag_bits & 1:
        raise ValueError(f"암호화된 ZIP 항목: {name}")
    if not parts:
        raise ValueError("이름이 없는 ZIP 항목")
    return name, parts


def normalized_name(value: str) -> str:
    return re.sub(r"[\W_]+", "", unicodedata.normalize("NFC", str(value))).casefold()


def attachment_specs(record: dict, manifest_dir: Path) -> list[dict]:
    result = []
    for raw in record.get("attachments") or []:
        spec = {"name": raw} if isinstance(raw, str) else dict(raw)
        if spec.get("path"):
            path = Path(spec["path"])
            path = path if path.is_absolute() else manifest_dir / path
            spec["path"] = path.resolve()
            spec.setdefault("name", path.name)
        if not spec.get("name"):
            raise ValueError("첨부 명세에 name 또는 path가 필요합니다.")
        result.append(spec)
    return result


def select_body(record: dict, members: list[tuple], expected_attachments: list[dict]):
    explicit = record.get("bodyName") or record.get("bodyFile")
    if explicit:
        found = [i for i, (_, name, _) in enumerate(members) if name == explicit or Path(name).name == explicit]
        return found[0] if len(found) == 1 else None
    title = normalized_name(record.get("title", ""))
    matches = [i for i, (_, name, _) in enumerate(members)
               if Path(name).suffix.lower() in (".jpg", ".jpeg", ".png", ".pdf")
               and title and normalized_name(Path(name).stem) == title]
    if len(matches) == 1:
        return matches[0]
    attachment_names = {normalized_name(Path(s["name"]).name) for s in expected_attachments}
    candidates = [i for i, (_, name, parts) in enumerate(members)
                  if len(parts) == 1 and Path(name).suffix.lower() in (".jpg", ".jpeg")
                  and normalized_name(Path(name).name) not in attachment_names]
    return candidates[0] if len(candidates) == 1 else None


def attachment_aliases(specs: list[dict], names: list[str]) -> dict[str, tuple[str, str]]:
    """Resolve observed archiveName first, then an explicitly recorded 1:1 UUID fallback."""
    aliases = {}
    used = set()
    for spec in specs:
        if not spec.get("archiveName"):
            continue
        matches = [name for name in names if normalized_name(Path(name).name) == normalized_name(Path(spec["archiveName"]).name)]
        if len(matches) == 1:
            aliases[matches[0]] = (str(spec["name"]), "observed_archiveName")
            used.add(matches[0])
    present = {normalized_name(Path(name).name) for name in names}
    matched_friendly = {normalized_name(Path(alias[0]).name) for alias in aliases.values()}
    remaining_specs = [s for s in specs if normalized_name(Path(s["name"]).name) not in present | matched_friendly]
    for spec in remaining_specs:
        extension = Path(spec["name"]).suffix.casefold()
        expected = [s for s in remaining_specs if Path(s["name"]).suffix.casefold() == extension]
        candidates = [name for name in names if name not in used and Path(name).suffix.casefold() == extension
                      and UUID_STEM.fullmatch(Path(name).stem)]
        if len(expected) == len(candidates) == 1:
            aliases[candidates[0]] = (str(spec["name"]), "unique_extension_uuid_inference")
            used.add(candidates[0])
    return aliases


def create_lossless_jpeg_pdf(jpeg: Path, pdf: Path) -> dict:
    """Embed the original JPEG DCT stream as-is; do not resave/recompress pixels."""
    from PIL import Image
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import ArrayObject, DecodedStreamObject, DictionaryObject, EncodedStreamObject, NameObject, NumberObject
    raw = jpeg.read_bytes()
    with Image.open(jpeg) as image:
        if image.format != "JPEG" or image.mode not in ("L", "RGB", "CMYK"):
            raise ValueError("무재압축 PDF 변환은 L/RGB/CMYK JPEG 본문만 지원합니다.")
        width, height = image.size
        mode = image.mode
        adobe = image.info.get("adobe")
        orientation = image.getexif().get(274, 1)
    if orientation != 1:
        raise ValueError(f"EXIF 방향({orientation})이 있는 본문은 원본 JPG로 보관하고 PDF 변환을 확인해야 합니다.")
    page_width, page_height = 595.28, 595.28 * height / width
    writer = PdfWriter()
    page = writer.add_blank_page(width=page_width, height=page_height)
    image_stream = EncodedStreamObject()
    image_stream._data = raw
    image_stream.update({NameObject("/Type"): NameObject("/XObject"), NameObject("/Subtype"): NameObject("/Image"),
                         NameObject("/Width"): NumberObject(width), NameObject("/Height"): NumberObject(height),
                         NameObject("/BitsPerComponent"): NumberObject(8), NameObject("/Filter"): NameObject("/DCTDecode"),
                         NameObject("/ColorSpace"): NameObject({"L": "/DeviceGray", "RGB": "/DeviceRGB", "CMYK": "/DeviceCMYK"}[mode])})
    if mode == "CMYK" and adobe is not None:
        image_stream[NameObject("/Decode")] = ArrayObject([NumberObject(v) for v in (1, 0, 1, 0, 1, 0, 1, 0)])
    image_ref = writer._add_object(image_stream)
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/XObject"): DictionaryObject({NameObject("/Im0"): image_ref})})
    content = DecodedStreamObject()
    content.set_data(f"q {page_width:.8f} 0 0 {page_height:.8f} 0 0 cm /Im0 Do Q\n".encode("ascii"))
    page[NameObject("/Contents")] = writer._add_object(content)
    writer.add_metadata({"/Title": "희창 그룹웨어 문서 본문", "/Subject": "Original JPEG embedded without recompression"})
    with pdf.open("wb") as outgoing:
        writer.write(outgoing)
    reader = PdfReader(pdf)
    embedded = reader.pages[0]["/Resources"]["/XObject"]["/Im0"].get_object()
    if len(reader.pages) != 1 or embedded._data != raw:
        raise ValueError("본문 PDF의 원본 JPEG 스트림 검증에 실패했습니다.")
    return {"kind": "body_pdf", "storedPath": pdf.name, "bytes": pdf.stat().st_size, "sha256": sha256_file(pdf),
            "sourceJpegSha256": hashlib.sha256(raw).hexdigest(), "jpegStreamIdentical": True}


def write_document_metadata(folder: Path, record: dict, verification: dict) -> None:
    """Refresh metadata from the latest captured page without losing related-document IDs."""
    verification["completedDate"] = record.get("completedDate")
    verification["kind"] = record.get("kind")
    verification["relatedLinks"] = record.get("relatedLinks") or []
    lines = ["희창 그룹웨어 문서 보관", "", f"문서번호: {record.get('docNo') or '미확인'}",
             f"원본 문서 ID: {record.get('docId') or '미확인'}", f"문서종류: {record.get('kind') or '미기재'}",
             f"작성/상신일: {record.get('date') or '미확인'}", f"완료일: {record.get('completedDate') or '미확인'}",
             f"제목: {record.get('title') or '미확인'}", f"원본 URL: {record.get('sourceUrl') or '미기재'}", "",
             "보관 확인", f"상태: {verification['status']}", "원본 ZIP CRC: 통과",
             f"원본 ZIP SHA256: {verification['zipSha256']}", f"ZIP 파일 항목 수: {verification['zipMembers']}", "", "보관 파일"]
    lines += [f"{item['kind']}: {item['storedPath']} ({item['bytes']} bytes)" for item in verification["files"]]
    aliases = [item for item in verification["files"] if item.get("attachmentNameMatch")]
    if aliases:
        lines += ["", "첨부파일 이름 대응"]
        lines += [f"{item['zipName']} -> {item['storedPath']} ({item['attachmentNameMatch']})" for item in aliases]
    lines += ["", "관련 근거문서"]
    related = record.get("relatedLinks") or []
    for link in related:
        if isinstance(link, dict):
            lines.append(str(link.get("text") or "문서명 미기재"))
            lines += [f"  {key}: {link[key]}" for key in ("docId", "href", "onclick", "sourceUrl") if link.get(key)]
        else:
            lines.append(str(link))
    if not related:
        lines.append("화면에서 수집된 관련문서 링크 없음")
    if record.get("bodyText"):
        lines += ["", "원문 본문", str(record["bodyText"])]
    if record.get("pageText"):
        lines += ["", "문서 화면 원문 · 첨부 및 결재의견", str(record["pageText"])]
    if verification.get("warnings"):
        lines += ["", "미확인 사항", *verification["warnings"]]
    if any(item["kind"] == "body_pdf" for item in verification["files"]):
        lines += ["", "본문 PDF는 원본 JPG의 JPEG 스트림을 재압축 없이 포함한 사본입니다."]
    else:
        lines += ["", "원본 ZIP의 본문 및 첨부만 보관했습니다. 추가 본문 PDF 생성 여부는 보관 파일 목록을 참조하세요."]
    (folder / "문서 정보.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    write_json(folder / VERIFY_NAME, verification)


def resolve_manifest_path(raw, manifest_dir: Path) -> Path:
    path = Path(str(raw))
    return (path if path.is_absolute() else manifest_dir / path).resolve()


def verify_existing(folder: Path, backup_hash: str) -> bool:
    try:
        verification = json.loads((folder / VERIFY_NAME).read_text(encoding="utf-8"))
        if verification.get("zipSha256") != backup_hash:
            return False
        for item in verification["files"]:
            path = (folder / item["storedPath"]).resolve()
            if not path.is_relative_to(folder.resolve()) or not path.is_file() or sha256_file(path) != item["sha256"]:
                return False
        return True
    except (OSError, ValueError, KeyError, TypeError):
        return False


def refresh_saved_document(folder: Path, record: dict, verification: dict, specs: list[dict], make_body_pdf: bool) -> dict:
    """Upgrade an already hash-verified saved document, including prior UUID-name cases."""
    files = verification["files"]
    attachment_files = [item for item in files if item["kind"] == "attachment"]
    aliases = attachment_aliases(specs, [item["zipName"] for item in attachment_files if item.get("zipName")])
    for item in attachment_files:
        if item.get("zipName") not in aliases:
            continue
        friendly_name, method = aliases[item["zipName"]]
        current = (folder / item["storedPath"]).resolve()
        destination = (current.parent / safe_component(Path(friendly_name).name)).resolve()
        if not current.is_relative_to(folder.resolve()) or not destination.is_relative_to(folder.resolve()):
            raise ValueError("첨부 이름 복구 경로가 문서 보관 폴더를 벗어납니다.")
        if destination != current:
            if destination.exists():
                raise ValueError(f"첨부 표시명 복구 대상 파일이 이미 존재합니다: {destination.name}")
            current.rename(destination)
        item["storedPath"] = destination.relative_to(folder).as_posix()
        item["expectedName"] = friendly_name
        item["attachmentNameMatch"] = method
    present = {normalized_name(Path(item["storedPath"]).name) for item in attachment_files}
    present |= {normalized_name(Path(item["zipName"]).name) for item in attachment_files if item.get("zipName")}
    missing = [spec["name"] for spec in specs if normalized_name(Path(spec["name"]).name) not in present]
    warnings = []
    bodies = [item for item in files if item["kind"] == "body"]
    if not bodies:
        warnings.append("본문 파일을 확정하지 못했습니다. ZIP의 모든 파일은 첨부파일 폴더에 보관했습니다.")
    if missing:
        warnings.append("다운로드를 확인하지 못한 첨부: " + ", ".join(missing))
    if make_body_pdf and bodies and not any(item["kind"] == "body_pdf" for item in files):
        body = folder / bodies[0]["storedPath"]
        if body.suffix.lower() in (".jpg", ".jpeg"):
            files.append(create_lossless_jpeg_pdf(body, folder / "문서 본문.pdf"))
        elif body.suffix.lower() != ".pdf":
            warnings.append("본문 PDF 무재압축 변환을 지원하지 않는 이미지 형식입니다. 원본 본문은 보관했습니다.")
    verification["missingAttachments"] = missing
    verification["warnings"] = warnings
    verification["status"] = "incomplete" if warnings else "complete"
    write_document_metadata(folder, record, verification)
    return verification


def organize_record(record: dict, manifest_dir: Path, output: Path, index: list[dict], max_bytes: int, make_body_pdf: bool = False) -> dict:
    doc_id = str(record.get("docId") or "").strip()
    doc_no = str(record.get("docNo") or "").strip()
    identity = {"docId": doc_id or None, "docNo": doc_no or None}
    if not doc_id and not doc_no:
        raise ValueError("문서 식별용 docId 또는 docNo가 필요합니다.")
    if not record.get("zipPath"):
        raise ValueError("zipPath가 없습니다. 미다운로드 문서는 완료 처리하지 않습니다.")
    source = resolve_manifest_path(record["zipPath"], manifest_dir)
    if not source.is_file() or source.suffix.lower() != ".zip":
        raise ValueError(f"완료된 ZIP 파일을 찾을 수 없습니다: {source}")
    backup_hash = sha256_file(source)
    attachments = attachment_specs(record, manifest_dir)
    matches = [entry for entry in index if (doc_id and str(entry.get("docId") or "") == doc_id)
               or (doc_no and str(entry.get("docNo") or "") == doc_no)]
    if len({m["folder"] for m in matches}) > 1:
        raise ValueError("문서 ID/문서번호가 서로 다른 기존 폴더를 가리킵니다.")
    if matches:
        existing = matches[0]
        folder = (output / existing["folder"]).resolve()
        if not folder.is_relative_to(output.resolve()):
            raise ValueError("색인의 폴더 경로가 출력 디렉터리를 벗어납니다.")
        if verify_existing(folder, backup_hash):
            verification = refresh_saved_document(folder, record, json.loads((folder / VERIFY_NAME).read_text(encoding="utf-8")), attachments, make_body_pdf)
            prior_status = existing.get("status")
            existing["status"] = verification["status"]
            existing["warnings"] = verification["warnings"]
            result_status = "duplicate_skipped" if prior_status == verification["status"] == "complete" else verification["status"]
            return {**identity, "status": result_status, "folder": existing["folder"], "zipSha256": backup_hash,
                    "warnings": verification["warnings"]}
        raise ValueError("같은 문서가 있으나 ZIP 내용 또는 보관 파일이 다릅니다. 기존 자료를 덮어쓰지 않았습니다.")
    with ZipFile(source) as archive:
        infos = archive.infolist()
        if len(infos) > 10000 or sum(i.file_size for i in infos) > max_bytes:
            raise ValueError("ZIP 파일 수/압축해제 크기 한도를 초과했습니다.")
        members = []
        for info in infos:
            name, parts = validate_member(info)
            if not info.is_dir():
                members.append((info, name, parts))
        if not members:
            raise ValueError("ZIP에 저장할 파일이 없습니다.")
        bad_crc = archive.testzip()
        if bad_crc:
            raise ValueError(f"ZIP CRC 검증 실패: {bad_crc}")
        if all(len(parts) > 1 and parts[0].casefold() == "zipfile" for _, _, parts in members):
            members = [(info, name, parts[1:]) for info, name, parts in members]
        body_index = select_body(record, members, attachments)
        aliases = attachment_aliases(attachments, [name for i, (_, name, _) in enumerate(members) if i != body_index])
        date = str(record.get("date") or "날짜 미확인")[:10]
        title = str(record.get("title") or "제목 미확인")
        folder_name = safe_component(f"{date} {title} {doc_no or doc_id}", 155)
        folder = output / folder_name
        if folder.exists():
            folder_name = safe_component(folder_name + "_" + safe_component(doc_id or doc_no, 24), 180)
            folder = output / folder_name
        if folder.exists():
            raise ValueError(f"기존 폴더와 이름이 겹칩니다: {folder_name}")
        staging = Path(tempfile.mkdtemp(prefix="._organizing_", dir=output))
        try:
            backup = staging / "문서 원본 백업.zip"
            shutil.copy2(source, backup)
            files = [{"kind": "original_zip", "storedPath": backup.name, "bytes": backup.stat().st_size,
                      "sha256": sha256_file(backup)}]
            if files[0]["sha256"] != backup_hash:
                raise ValueError("ZIP 복사 해시가 원본과 다릅니다.")
            used = {backup.name.casefold()}
            for position, (info, original_name, parts) in enumerate(members):
                if position == body_index:
                    relative = Path("문서 본문" + Path(original_name).suffix.lower())
                    kind = "body"
                else:
                    friendly_parts = list(parts)
                    if original_name in aliases:
                        friendly_parts[-1] = Path(aliases[original_name][0]).name
                    relative = Path("첨부파일").joinpath(*(safe_component(part) for part in friendly_parts))
                    kind = "attachment"
                candidate = relative
                duplicate_number = 2
                while candidate.as_posix().casefold() in used:
                    candidate = relative.with_name(f"{relative.stem}_{duplicate_number}{relative.suffix}")
                    duplicate_number += 1
                relative = candidate
                used.add(relative.as_posix().casefold())
                target = (staging / relative).resolve()
                if not target.is_relative_to(staging.resolve()):
                    raise ValueError("압축해제 대상이 임시 보관 폴더를 벗어납니다.")
                target.parent.mkdir(parents=True, exist_ok=True)
                digest = hashlib.sha256()
                with archive.open(info) as incoming, target.open("wb") as outgoing:
                    for block in iter(lambda: incoming.read(1024 * 1024), b""):
                        outgoing.write(block)
                        digest.update(block)
                files.append({"kind": kind, "zipName": original_name, "storedPath": relative.as_posix(),
                              "bytes": target.stat().st_size, "crc32": f"{info.CRC:08x}", "sha256": digest.hexdigest()})
                if original_name in aliases:
                    files[-1]["expectedName"], files[-1]["attachmentNameMatch"] = aliases[original_name]
            missing_attachments = []
            zip_attachment_names = {normalized_name(Path(item.get("expectedName") or item["zipName"]).name)
                                    for item in files if item["kind"] == "attachment"}
            for spec in attachments:
                expected_name = normalized_name(Path(spec["name"]).name)
                if expected_name in zip_attachment_names:
                    continue
                if not spec.get("path") or not spec["path"].is_file():
                    missing_attachments.append(spec["name"])
                    continue
                incoming_path = spec["path"]
                relative = Path("첨부파일") / safe_component(spec["name"])
                target = staging / relative
                duplicate_number = 2
                while relative.as_posix().casefold() in used:
                    relative = Path("첨부파일") / f"{safe_component(Path(spec['name']).stem)}_{duplicate_number}{incoming_path.suffix}"
                    target = staging / relative
                    duplicate_number += 1
                used.add(relative.as_posix().casefold())
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(incoming_path, target)
                files.append({"kind": "attachment", "externalName": spec["name"], "storedPath": relative.as_posix(),
                              "bytes": target.stat().st_size, "sha256": sha256_file(target)})
            warnings = []
            if body_index is None:
                warnings.append("본문 파일을 확정하지 못했습니다. ZIP의 모든 파일은 첨부파일 폴더에 보관했습니다.")
            if missing_attachments:
                warnings.append("다운로드를 확인하지 못한 첨부: " + ", ".join(missing_attachments))
            status = "incomplete" if warnings else "complete"
            verification = {"schemaVersion": 1, **identity, "date": date, "title": title,
                            "sourceUrl": record.get("sourceUrl"), "status": status, "zipCrcPassed": True,
                            "zipSha256": backup_hash, "zipMembers": len(members), "files": files,
                            "missingAttachments": missing_attachments, "warnings": warnings}
            verification = refresh_saved_document(staging, record, verification, attachments, make_body_pdf)
            status, warnings = verification["status"], verification["warnings"]
            staging.rename(folder)
        except Exception:
            resolved_staging = staging.resolve()
            if resolved_staging.is_relative_to(output.resolve()) and resolved_staging.name.startswith("._organizing_"):
                shutil.rmtree(resolved_staging)
            raise
    entry = {**identity, "date": date, "title": title, "folder": folder_name, "zipSha256": backup_hash,
             "status": status, "zipMembers": len(members), "warnings": warnings}
    index.append(entry)
    return entry


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--verification", type=Path, help="Collection verification JSON path; defaults beside the manifest")
    parser.add_argument("--max-uncompressed-mb", type=int, default=2048)
    parser.add_argument("--body-pdf", action="store_true", help="Embed original JPEG body into PDF without recompression")
    args = parser.parse_args()
    manifest_path = args.manifest.resolve()
    document = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    records = document.get("documents") if isinstance(document, dict) else document
    if not isinstance(records, list) or any(not isinstance(item, dict) for item in records):
        raise ValueError("manifest는 문서 레코드 배열 또는 documents 배열을 담은 객체여야 합니다.")
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    index_path = output / INDEX_NAME
    index = json.loads(index_path.read_text(encoding="utf-8"))["documents"] if index_path.exists() else []
    # Recover identity records if a prior run saved folders but did not finish its index write.
    known_folders = {entry["folder"] for entry in index}
    for verification_path in output.glob("*/" + VERIFY_NAME):
        if verification_path.parent.name not in known_folders:
            saved = json.loads(verification_path.read_text(encoding="utf-8"))
            index.append({k: saved.get(k) for k in ("docId", "docNo", "date", "title", "zipSha256", "status")}
                         | {"folder": verification_path.parent.name})
    results = []
    for record in records:
        try:
            result = organize_record(record, manifest_path.parent, output, index, args.max_uncompressed_mb * 1024 * 1024, args.body_pdf)
        except (OSError, ValueError, BadZipFile, RuntimeError, KeyError) as error:
            result = {"docId": record.get("docId"), "docNo": record.get("docNo"), "status": "failed", "error": str(error)}
        results.append(result)
        write_json(index_path, {"schemaVersion": 1, "documents": index})
    counts = Counter(result["status"] for result in results)
    report = {"schemaVersion": 1, "manifest": str(manifest_path), "outputRoot": str(output),
              "recordsRequested": len(records), "statusCounts": dict(counts), "documents": results}
    verification_path = (args.verification or manifest_path.with_name(manifest_path.stem + ".verification.json")).resolve()
    write_json(verification_path, report)
    print(json.dumps({"recordsRequested": len(records), "statusCounts": dict(counts),
                      "outputRoot": str(output), "verification": str(verification_path)}, ensure_ascii=False))
    return 1 if counts.get("failed") or counts.get("incomplete") else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2)
