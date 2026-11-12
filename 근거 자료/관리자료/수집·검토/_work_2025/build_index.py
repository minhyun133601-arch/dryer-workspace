"""Build a browser-local HTML index and an independently checked collection audit.

Usage: python -X utf8 build_index.py [--manifest download_manifest.json]
Use --collection-complete only after collection ends; unresolved records remain visible.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit
from zipfile import ZipFile

from organize_downloads import DEFAULT_OUTPUT, INDEX_NAME, VERIFY_NAME, decode_zip_name, normalized_name, sha256_file

WORK = Path(__file__).resolve().parent


def esc(value) -> str:
    return html.escape(str(value or ""), quote=True)


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def href(path: Path, parent: Path) -> str:
    return quote(path.relative_to(parent).as_posix(), safe="/")


def record_kind(record: dict) -> str:
    if record.get("kind"):
        return str(record["kind"])
    number = str(record.get("docNo") or "")
    for kind in ("기안서", "보고서", "물품구매서", "품의서"):
        if kind in number:
            return kind
    return "문서"


def related_doc_id(link: dict) -> str | None:
    if link.get("docId"):
        return str(link["docId"])
    for key in ("onclick", "href"):
        match = re.search(r"ViewBaseDoc\s*\(\s*['\"]([0-9]+)['\"]", str(link.get(key) or ""))
        if match:
            return match.group(1)
    return None


def stream_hash(stream) -> str:
    digest = hashlib.sha256()
    for block in iter(lambda: stream.read(1024 * 1024), b""):
        digest.update(block)
    return digest.hexdigest()


def audit_document(folder: Path, verification: dict, manifest_record: dict | None) -> dict:
    errors = []
    file_records = verification.get("files", [])
    expected_attachment_paths = {(folder / item["storedPath"]).resolve() for item in file_records if item.get("kind") == "attachment"}
    actual_attachment_paths = {path.resolve() for path in (folder / "첨부파일").rglob("*") if path.is_file()}
    extra_attachment_paths = sorted(str(path.relative_to(folder)) for path in actual_attachment_paths - expected_attachment_paths)
    missing_attachment_paths = sorted(str(path.relative_to(folder)) for path in expected_attachment_paths - actual_attachment_paths)
    if extra_attachment_paths or missing_attachment_paths:
        errors.append("실제 첨부 폴더 파일 목록과 보관 명세 불일치")
    original = next((item for item in file_records if item.get("kind") == "original_zip"), None)
    archive_members = []
    verified_attachments = 0
    verified_original_members = 0
    if not original:
        errors.append("원본 ZIP 기록 없음")
    else:
        archive_path = (folder / original["storedPath"]).resolve()
        if not archive_path.is_relative_to(folder.resolve()) or not archive_path.is_file():
            errors.append("원본 ZIP 파일 없음/잘못된 경로")
        else:
            if sha256_file(archive_path) != verification.get("zipSha256"):
                errors.append("원본 ZIP SHA256 불일치")
            try:
                with ZipFile(archive_path) as archive:
                    infos = [info for info in archive.infolist() if not info.is_dir()]
                    archive_members = [decode_zip_name(info) for info in infos]
                    preserved = [item for item in file_records if item.get("zipName")]
                    if Counter(archive_members) != Counter(item["zipName"] for item in preserved):
                        errors.append("ZIP 파일명 목록과 보관 명세 불일치")
                    info_by_name = {}
                    for info in infos:
                        info_by_name.setdefault(decode_zip_name(info), []).append(info)
                    for item in preserved:
                        candidates = info_by_name.get(item["zipName"], [])
                        if not candidates:
                            errors.append(f"ZIP 항목 없음: {item['zipName']}")
                            continue
                        info = candidates.pop(0)
                        with archive.open(info) as stream:
                            original_sha = stream_hash(stream)  # Reading to EOF also validates member CRC.
                        path = (folder / item["storedPath"]).resolve()
                        if not path.is_relative_to(folder.resolve()) or not path.is_file():
                            errors.append(f"보관 파일 없음/잘못된 경로: {item['storedPath']}")
                        elif sha256_file(path) != original_sha or original_sha != item.get("sha256"):
                            errors.append(f"원본/보관 파일 SHA256 불일치: {item['storedPath']}")
                        else:
                            verified_original_members += 1
                            verified_attachments += item.get("kind") == "attachment"
            except Exception as error:
                errors.append(f"ZIP/CRC 검증 오류: {error}")
    bodies = [item for item in file_records if item.get("kind") == "body"]
    pdfs = [item for item in file_records if item.get("kind") == "body_pdf"]
    if not bodies:
        errors.append("본문 파일 명세 없음")
    if pdfs:
        try:
            from pypdf import PdfReader
            pdf = folder / pdfs[0]["storedPath"]
            body = folder / bodies[0]["storedPath"]
            reader = PdfReader(pdf)
            raw = reader.pages[0]["/Resources"]["/XObject"]["/Im0"].get_object()._data
            if len(reader.pages) != 1 or raw != body.read_bytes() or sha256_file(pdf) != pdfs[0]["sha256"]:
                errors.append("본문 PDF의 원본 JPEG 스트림/해시 불일치")
        except Exception as error:
            errors.append(f"본문 PDF 검증 오류: {error}")
    expected_attachments = (manifest_record or {}).get("attachments") or []
    actual_attachment_names = {normalized_name(Path(item.get("expectedName") or item["storedPath"]).name)
                               for item in file_records if item.get("kind") == "attachment"}
    actual_attachment_names |= {normalized_name(Path(item["zipName"]).name)
                                for item in file_records if item.get("kind") == "attachment" and item.get("zipName")}
    missing_expected = []
    for expected in expected_attachments:
        name = expected if isinstance(expected, str) else expected.get("name")
        if name and normalized_name(Path(name).name) not in actual_attachment_names:
            missing_expected.append(name)
    if missing_expected:
        errors.append("화면 첨부명과 보관 파일 대응 미확인: " + ", ".join(missing_expected))
    return {"docId": str(verification.get("docId") or ""), "docNo": verification.get("docNo"),
            "status": verification.get("status"), "zipMembers": len(archive_members),
            "verifiedOriginalMembers": verified_original_members, "verifiedAttachments": verified_attachments,
            "bodyPDF": bool(pdfs), "missingExpectedAttachments": missing_expected,
            "actualAttachmentFiles": len(actual_attachment_paths), "extraAttachmentPaths": extra_attachment_paths,
            "missingAttachmentPaths": missing_attachment_paths,
            "zipNamesAndBytesMatch": not errors, "errors": errors}


def build(args) -> int:
    output = args.output.resolve()
    inventory_root = output.parent
    index = json.loads((output / INDEX_NAME).read_text(encoding="utf-8"))["documents"]
    manifest_document = json.loads(args.manifest.read_text(encoding="utf-8-sig"))
    manifest = manifest_document.get("documents") if isinstance(manifest_document, dict) else manifest_document
    captured = {str(record.get("docId") or ""): record for record in manifest}
    documents = []
    for entry in index:
        folder = (output / entry["folder"]).resolve()
        if not folder.is_relative_to(output):
            raise ValueError("색인 문서 경로가 수집 폴더를 벗어납니다.")
        verification = json.loads((folder / VERIFY_NAME).read_text(encoding="utf-8"))
        doc_id = str(verification.get("docId") or "")
        record = {**verification, **captured.get(doc_id, {})}
        documents.append({"id": doc_id, "folder": folder, "verification": verification,
                          "record": record, "kind": record_kind(record)})
    id_counts = Counter(document["id"] for document in documents)
    manifest_id_counts = Counter(str(record.get("docId") or "") for record in manifest)
    duplicates = {key: value for key, value in id_counts.items() if not key or value != 1}
    manifest_duplicates = {key: value for key, value in manifest_id_counts.items() if not key or value != 1}
    missing_ids = sorted(set(manifest_id_counts) - set(id_counts))
    by_id = {document["id"]: document for document in documents if id_counts[document["id"]] == 1}
    by_no = {normalized_name(document["record"].get("docNo", "")): document for document in documents}
    document_audits = [audit_document(document["folder"], document["verification"], captured.get(document["id"]))
                       for document in documents]
    audit_by_id = {item["docId"]: item for item in document_audits}
    unresolved = []
    related_counts = Counter()
    for document in documents:
        relations = []
        for link in document["record"].get("relatedLinks") or []:
            if isinstance(link, str):
                link = {"text": link}
            target_id = related_doc_id(link)
            target = by_id.get(target_id) if target_id else by_no.get(normalized_name(link.get("text", "")))
            label = link.get("text") or target_id or "관련 문서"
            if target:
                target_href = href(target["folder"], inventory_root) + "/"
                relations.append(f'<a href="{esc(target_href)}">{esc(label)}</a>')
                related_counts["resolved"] += 1
            else:
                relations.append(f'<span class="unresolved">{esc(label)} <small>미수집</small></span>')
                unresolved.append({"fromDocId": document["id"], "targetDocId": target_id, "text": label})
                related_counts["unresolved"] += 1
        document["relations"] = relations
    all_files_pass = all(not item["errors"] and item["status"] == "complete" for item in document_audits)
    all_manifest_present_once = not missing_ids and not duplicates and not manifest_duplicates
    is_complete = bool(args.collection_complete and all_files_pass and all_manifest_present_once and not unresolved)
    kinds = Counter(document["kind"] for document in documents)
    scope_path = WORK / "collection_scope.json"
    scope = json.loads(scope_path.read_text(encoding="utf-8")) if scope_path.exists() else []
    generated_at = datetime.now(timezone(timedelta(hours=9), name="KST")).isoformat(timespec="seconds")
    audit = {"generatedAtKST": generated_at, "collectionDeclaredComplete": bool(args.collection_complete),
             "collectionStatus": "complete" if is_complete else "in_progress",
             "manifestRecords": len(manifest), "manifestUniqueDocIds": len(manifest_id_counts),
             "inventoryDocuments": len(documents), "inventoryUniqueDocIds": len(id_counts),
             "allManifestDocumentsPresentOnce": all_manifest_present_once,
             "missingManifestDocIds": missing_ids, "duplicateInventoryDocIds": duplicates,
             "duplicateManifestDocIds": manifest_duplicates, "kindCounts": dict(kinds),
             "allZipNamesAndBytesMatch": all_files_pass,
             "originalMembersVerified": sum(item["verifiedOriginalMembers"] for item in document_audits),
             "attachmentsVerified": sum(item["verifiedAttachments"] for item in document_audits),
             "actualAttachmentFiles": sum(item["actualAttachmentFiles"] for item in document_audits),
             "actualOriginalZIPs": sum((document["folder"] / "문서 원본 백업.zip").is_file() for document in documents),
             "actualBodyJPGs": sum((document["folder"] / "문서 본문.jpg").is_file() for document in documents),
             "actualBodyPDFs": sum((document["folder"] / "문서 본문.pdf").is_file() for document in documents),
             "bodyPDFsVerified": sum(item["bodyPDF"] for item in document_audits),
             "resolvedRelatedLinks": related_counts["resolved"], "unresolvedRelatedLinks": unresolved,
             "observedCollectionScope": scope, "documents": document_audits}
    rows = []
    for document in sorted(documents, key=lambda doc: (str(doc["record"].get("date") or ""), str(doc["record"].get("docNo") or "")), reverse=True):
        record, folder, verification = document["record"], document["folder"], document["verification"]
        files = verification["files"]
        body = next((item for item in files if item["kind"] == "body_pdf"), None)
        if body is None:
            body = next((item for item in files if item["kind"] == "body"), None)
        backup = next((item for item in files if item["kind"] == "original_zip"), None)
        links = []
        if body:
            body_label = "본문 PDF" if Path(body["storedPath"]).suffix.casefold() == ".pdf" else "본문 원본"
            links.append(f'<a href="{esc(href(folder / body["storedPath"], inventory_root))}">{body_label}</a>')
        if backup:
            links.append(f'<a href="{esc(href(folder / backup["storedPath"], inventory_root))}">원본 ZIP</a>')
        attachment_count = sum(item["kind"] == "attachment" for item in files)
        if (folder / "첨부파일").is_dir():
            links.append(f'<a href="{esc(href(folder / "첨부파일", inventory_root))}/">첨부 {attachment_count}개</a>')
        links.append(f'<a href="{esc(href(folder, inventory_root))}/">문서 폴더</a>')
        search = f"{record.get('docNo','')} {record.get('date','')} {document['kind']} {record.get('title','')}"
        status = "보관 확인" if verification.get("status") == "complete" and not audit_by_id[document["id"]]["errors"] else "확인 필요"
        rows.append(f'<tr data-doc-id="{esc(document["id"])}" data-search="{esc(search)}"><td class="number">{esc(record.get("docNo"))}<small>ID {esc(document["id"])}</small></td><td>{esc(record.get("date"))}<small>{esc(document["kind"])}</small></td><td class="title">{esc(record.get("title"))}<small>{status}</small></td><td class="files">{" ".join(links)}</td><td class="related">{"".join(document["relations"]) or '<span class="muted">연결 문서 없음</span>'}</td></tr>')
    scope_note = " / ".join(f"{item.get('kind')} {item.get('count')}건" for item in scope)
    status_label = "수집 완료" if is_complete else "수집 진행 중"
    warning = (f"관련 근거문서 {len(unresolved)}개 연결은 아직 로컬 보관을 확인하지 못했습니다." if unresolved else "현재 수집된 문서의 관련 근거문서 링크가 모두 로컬 문서에 연결됩니다.")
    page = fr'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>2025년 자료 · 문서 목록</title>
<style>
:root{{--ink:#173b36;--muted:#687875;--line:#dce4df;--paper:#f4f7f2}}*{{box-sizing:border-box}}body{{margin:0;color:#263d37;background:#fff;font:14px/1.65 "Malgun Gothic",Arial,sans-serif}}main{{max-width:1500px;margin:0 auto;padding:35px 30px}}h1{{font-size:28px;margin:0 0 10px;color:var(--ink)}}p{{margin:5px 0}}.eyebrow{{font-size:12px;font-weight:700;color:#37705d;margin-bottom:8px}}.summary{{display:flex;gap:25px;flex-wrap:wrap;background:var(--paper);padding:17px 20px;margin:22px 0 15px;border-block:1px solid var(--line)}}.summary strong{{display:block;color:var(--ink);font-size:23px}}.summary span,.note,small,.muted{{font-size:11px;color:var(--muted)}}small{{display:block;line-height:1.6}}.status{{font-size:12px;color:#8a642d}}input{{font:inherit;width:min(100%,540px);padding:11px 14px;border:1px solid #b8cbc0;border-radius:5px;margin:18px 15px 18px 0}}.table-wrap{{overflow-x:auto;border-top:2px solid var(--ink)}}table{{border-collapse:collapse;width:100%;min-width:1050px;text-align:left;font-size:12px}}th{{padding:12px;background:var(--paper);font-size:11px;color:var(--ink)}}td{{padding:13px 12px;border-top:1px solid var(--line);vertical-align:top}}.number{{min-width:180px}}.title{{min-width:260px;font-weight:600}}.files{{min-width:200px}}a{{color:#216148;text-decoration:none}}a:hover{{text-decoration:underline}}.files a{{display:inline-block;white-space:nowrap;padding:3px 7px;border:1px solid #d8e4db;border-radius:4px;margin:0 3px 5px 0;font-size:10px}}.related a,.related .unresolved{{display:block;font-size:10px;margin-bottom:6px}}.unresolved{{color:#946521}}.unresolved small{{display:inline;color:#946521}}tr[hidden]{{display:none}}footer{{margin-top:20px;font-size:10px;color:var(--muted)}}@media(max-width:600px){{main{{padding:25px 18px}}h1{{font-size:25px}}.summary{{gap:12px 24px}}}}@media print{{input,.status{{display:none}}main{{padding:0}}table{{min-width:0;font-size:9px}}td,th{{padding:7px}}}}
</style></head><body><main>
<p class="eyebrow">희창 그룹웨어 · 로컬 보관 목록</p><h1>2025년 자료</h1><p class="status">{status_label} · {esc(generated_at[:19].replace('T',' '))} KST 기준</p>
<p>각 문서를 한 번씩 모았습니다. 본문·원본 ZIP·첨부파일과 관련 기안서를 이 목록에서 열 수 있습니다.</p>
<div class="summary"><div><span>보관 문서</span><strong>{len(documents)}건</strong></div><div><span>본문 PDF</span><strong>{audit['bodyPDFsVerified']}개</strong></div><div><span>첨부파일</span><strong>{audit['attachmentsVerified']}개</strong></div><div><span>관련 문서 연결</span><strong>{related_counts['resolved']}개</strong></div></div>
<p class="note">관찰한 목록 범위: {esc(scope_note or '수집 범위 확인 중')}</p><p class="note">{esc(warning)}</p><p class="note">관련 문서에 포함된 과거 연도 자료도 원문 날짜 그대로 표시합니다.{'' if is_complete else ' 수집 진행 중인 목록은 전체 수집 완료를 뜻하지 않습니다.'}</p>
<label><span class="note">문서번호·제목·종류 검색</span><br><input id="search" type="search" placeholder="예: 기안서, 냉동기, 공무환경팀-2025"></label><span id="count" class="note" aria-live="polite">{len(documents)}건 표시</span>
<div class="table-wrap"><table><thead><tr><th>문서번호</th><th>작성/상신일 · 종류</th><th>제목</th><th>보관 파일</th><th>관련 근거문서</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div>
<footer>본문 PDF는 원본 JPG의 JPEG 스트림을 재압축 없이 담은 열람용 사본입니다. 원본 ZIP과 첨부는 보관 검증 기록의 CRC·SHA256으로 대조했습니다.</footer>
</main><script>document.querySelector('#search').addEventListener('input',e=>{{const q=e.target.value.replace(/\s/g,'').toLocaleLowerCase();let n=0;document.querySelectorAll('tbody tr').forEach(r=>{{r.hidden=!r.dataset.search.replace(/\s/g,'').toLocaleLowerCase().includes(q);if(!r.hidden)n++}});document.querySelector('#count').textContent=n+'건 표시'}});</script></body></html>'''
    html_path = inventory_root / "자료목록.html"
    html_path.write_text(page, encoding="utf-8")
    class Rows(HTMLParser):
        def __init__(self):
            super().__init__()
            self.ids = []
            self.links = []
        def handle_starttag(self, tag, attrs):
            values = dict(attrs)
            if tag == "tr" and "data-doc-id" in values:
                self.ids.append(values["data-doc-id"])
            if tag == "a" and values.get("href"):
                self.links.append(values["href"])
    parser = Rows()
    parser.feed(page)
    audit["htmlDocumentRows"] = len(parser.ids)
    audit["htmlUniqueDocIds"] = len(set(parser.ids))
    audit["htmlRowsMatchInventory"] = Counter(parser.ids) == id_counts
    invalid_links = []
    for link in parser.links:
        parsed = urlsplit(link)
        target = (inventory_root / unquote(parsed.path)).resolve()
        if parsed.scheme or not target.is_relative_to(inventory_root.resolve()) or not target.exists():
            invalid_links.append(link)
    audit["localInventoryLinks"] = len(parser.links)
    audit["allLocalInventoryLinksExist"] = not invalid_links
    audit["invalidLocalInventoryLinks"] = invalid_links
    audit_path = args.audit.resolve()
    write_json(audit_path, audit)
    print(json.dumps({"html": str(html_path), "audit": str(audit_path), "inventoryDocuments": len(documents),
                      "allManifestDocumentsPresentOnce": all_manifest_present_once, "allZipNamesAndBytesMatch": all_files_pass,
                      "attachmentsVerified": audit["attachmentsVerified"], "unresolvedRelatedLinks": len(unresolved),
                      "collectionStatus": audit["collectionStatus"]}, ensure_ascii=False))
    return 1 if not all_manifest_present_once or not all_files_pass else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=WORK / "download_manifest.json")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--audit", type=Path, default=WORK / "collection_index_audit.json")
    parser.add_argument("--collection-complete", action="store_true")
    return build(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
