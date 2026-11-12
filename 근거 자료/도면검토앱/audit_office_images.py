"""Audit existing embedded-picture extraction without touching live cache."""
from collections import Counter
import csv
import json
from pathlib import Path
import time

from build_previews import atomic_json, embedded_office_images, original_path

APP = Path(__file__).resolve().parent
ROOT = APP.parent / "건물3D 후보도면"
DEST = APP / "office-images"


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    with (ROOT / "00_도면목록.csv").open(encoding="utf-8-sig", newline="") as stream:
        rows = [r for r in csv.DictReader(stream) if r["확장자"].lower() in
                {".xls", ".xlsx", ".doc", ".docx", ".ppt", ".pptx"}]
    records = []
    for index, row in enumerate(rows, 1):
        target = DEST / row["SHA256"]
        target.mkdir(parents=True, exist_ok=True)
        before = time.monotonic()
        item = {"id": row["SHA256"], "name": row["원본파일명"], "ext": row["확장자"], "pages": []}
        try:
            pages = embedded_office_images(original_path(ROOT, row), target)
            item["pages"] = [{**p, "localPath": str((target / p["src"].rsplit("/", 1)[-1]).relative_to(APP))} for p in pages]
            item["status"] = "embedded-images-only"
        except Exception as exc:
            item["status"] = "no-embedded-preview"
            item["error"] = str(exc)
        item["seconds"] = round(time.monotonic() - before, 3)
        records.append(item)
        atomic_json(target / "audit.json", item)
        atomic_json(DEST / "summary.json", {"processed": index, "total": len(rows),
            "warning": "문서에 저장된 삽입그림만 추출한 감사 결과입니다. 인쇄문서의 전체 페이지·도형·텍스트·셀 배치를 재현하지 않습니다.",
            "counts": dict(Counter(r["status"] for r in records)), "items": records})
        if index % 25 == 0 or index == len(rows):
            print(json.dumps({"processed": index, "total": len(rows), "counts": dict(Counter(r["status"] for r in records))}), flush=True)


if __name__ == "__main__":
    main()
