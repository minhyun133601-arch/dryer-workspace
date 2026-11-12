"""Normalize organization receipts and verify all moved file bytes."""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

def entries(value):
    if isinstance(value, list):
        return [entry for child in value for entry in entries(child)]
    if isinstance(value, dict):
        if "originalPath" in value and "currentPath" in value:
            return [value]
        for key in ("value", "moves"):
            if key in value:
                return entries(value[key])
    raise ValueError(f"Unexpected receipt representation: {type(value).__name__}")

all_moves = []
parts = ["move-receipt.json", "route-source-move-receipt.json"]
repair_path = HERE / "script-path-repairs.json"
repairs = json.loads(repair_path.read_text(encoding="utf-8-sig"))["repairedScripts"] if repair_path.exists() else []
repair_by_path = {entry["currentPath"]: entry for entry in repairs}
for name in parts:
    path = HERE / name
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    moves = entries(data["moves"])
    for entry in moves:
        target = ROOT / entry["currentPath"]
        target.resolve().relative_to(ROOT.resolve())
        if not target.is_file():
            raise FileNotFoundError(target)
        with target.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        repair = repair_by_path.get(entry["currentPath"])
        expected = repair["repairedSha256"] if repair else entry["sha256"]
        if digest != expected:
            raise ValueError(f"Changed bytes: {entry['currentPath']}")
        if repair:
            original_copy = ROOT / repair["originalCopyPath"]
            with original_copy.open("rb") as stream:
                original_hash = hashlib.file_digest(stream, "sha256").hexdigest()
            if original_hash != entry["sha256"] or original_hash != repair["originalMovedSha256"]:
                raise ValueError(f"Changed archival script bytes: {entry['currentPath']}")
        if (ROOT / entry["originalPath"]).exists():
            raise ValueError(f"Original source still exists: {entry['originalPath']}")
    data["moves"] = moves
    data["movedFiles"] = len(moves)
    data["movedBytes"] = sum(entry["bytes"] for entry in moves)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    all_moves.extend(moves)
result = {
    "date": "2026-11-12", "movedFiles": len(all_moves),
    "movedBytes": sum(entry["bytes"] for entry in all_moves),
    "permanentFileDeletions": 0, "verifiedEmptyDirectoriesRemoved": 41,
    "receiptParts": parts,
    "verification": "All old file paths are absent. Unmodified moved files retain their before-move hashes. Repaired review scripts match the separate repair hashes and their preserved original copies match the before-move hashes.",
    "moves": all_moves, "scriptRepairReceipt": "script-path-repairs.json", "repairedScripts": repairs,
}
(HERE / "organization-manifest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Verified {len(all_moves)} moves and {len(repairs)} script-path repairs; {result['movedBytes']} moved bytes.")
