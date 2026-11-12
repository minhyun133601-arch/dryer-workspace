"""Repair only executable paths after moving completed review tools."""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
manifest = json.loads((HERE / "organization-manifest.json").read_text(encoding="utf-8"))
moved = {entry["currentPath"]: entry for entry in manifest["moves"]}
repairs = {
    "workspace/reviews/preparation-review-20261111/environment-audit.mjs": [
        ("../../apps/", "../../../apps/"),
    ],
    "workspace/reviews/wastewater-20261112/one-time-scripts/wastewater-ui-edit.mjs": [
        ("for (const file of", "const projectRoot = new URL('../../../../', import.meta.url);\nfor (const file of"),
        ("  let source=await readFile(file,'utf8');", "  const target = new URL(file, projectRoot);\n  let source=await readFile(target,'utf8');"),
        ("  await writeFile(file,source);", "  await writeFile(target,source);"),
    ],
    "workspace/reviews/dryer-burner-maintenance-20261112/scripts/render-burner-maintenance.py": [
        ("ROOT = Path(__file__).resolve().parents[1]", "ROOT = Path(__file__).resolve().parents[4]"),
    ],
    "workspace/reviews/boiler-review-20261111/scripts/finalize-boiler-evidence.py": [
        ("root = Path(__file__).resolve().parents[1]", "root = Path(__file__).resolve().parents[4]"),
    ],
    "workspace/reviews/preparation-review-20261111/extract-app-photos.py": [
        ("root=Path(__file__).resolve().parents[2]", "root=Path(__file__).resolve().parents[3]"),
    ],
    "workspace/reviews/preparation-review-20261111/clip-001/build-route-evidence.py": [
        ("ROOT = Path.cwd()", "ROOT = Path(__file__).resolve().parents[4]"),
        ("WORK = ROOT / 'tmp/preparation-review-20261111/clip-001'", "WORK = Path(__file__).resolve().parent"),
    ],
    "workspace/reviews/rear-stair-review-20261111/clip-001/build-evidence.py": [
        ("root = Path.cwd()", "root = Path(__file__).resolve().parents[4]"),
        ("work = root / 'tmp/rear-stair-review-20261111/clip-001'", "work = Path(__file__).resolve().parent"),
    ],
    "workspace/reviews/boiler-review-20261111/location-extract.py": [
        ("root = Path.cwd()", "root = Path(__file__).resolve().parents[3]"),
        ("review = root / 'tmp/boiler-review-20261111/clip-001'", "review = Path(__file__).resolve().parent / 'clip-001'"),
    ],
}
records = []
for relative, replacements in repairs.items():
    path = ROOT / relative
    before = path.read_bytes()
    before_hash = hashlib.sha256(before).hexdigest()
    if before_hash != moved[relative]["sha256"]:
        raise ValueError(f"Unexpected pre-repair script hash: {relative}")
    copy_path = HERE / "original-scripts" / (relative + ".original")
    copy_path.parent.mkdir(parents=True, exist_ok=True)
    copy_path.write_bytes(before)
    source = before.decode("utf-8")
    for old, new in replacements:
        if old not in source:
            raise ValueError(f"Missing expected executable path: {relative}: {old}")
        source = source.replace(old, new.replace("\n", "\r\n") if "\r\n" in source else new)
    after = source.encode("utf-8")
    path.write_bytes(after)
    records.append({
        "currentPath": relative, "originalMovedSha256": before_hash,
        "repairedSha256": hashlib.sha256(after).hexdigest(),
        "bytesBefore": len(before), "bytesAfter": len(after),
        "originalCopyPath": copy_path.relative_to(ROOT).as_posix(),
        "changes": [{"from": old, "to": new} for old, new in replacements],
    })
receipt = {"date": "2026-11-12", "purpose": "이동한 검토 도구의 프로젝트 루트·모듈 import·실행 입력 경로 보정", "historicalEvidenceJsonPathsChanged": False, "repairedScripts": records}
(HERE / "script-path-repairs.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Repaired executable paths in {len(records)} review scripts; original bytes retained separately.")
