"""Inventory existing project files by purpose; never alter their contents."""
from pathlib import Path
from collections import Counter, defaultdict
import csv
import json

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent

def purpose(relative: str) -> str:
    if relative.startswith("apps/site/assets/"):
        return "활성 화면·공유 이미지"
    if relative.startswith("apps/") or relative in {"index.html", "package.json", "프로젝트 실행.cmd", "workspace/app.js", "workspace/styles.css", "workspace/module-registry.js", "workspace/icon.svg"}:
        return "실행 앱·메뉴·설정"
    if relative.startswith("references/"):
        return "주제별 원본·근거·모델링 판단 기록"
    if relative.startswith("근거 자료/"):
        return "도면 원본·검토 앱·미리보기·검토 DB"
    if relative.startswith("workspace/reviews/"):
        return "완료된 영상·도면 판독·화면 검증 산출물"
    if relative.startswith("workspace/verification-archive/"):
        return "날짜·주제별 과거 검사 로그"
    if relative.startswith("workspace/"):
        return "작업별 재현 도구·검토 기록"
    if relative.startswith("tooling/"):
        return "현재 실행·검사·공유 생성 도구"
    if relative.startswith("tests/"):
        return "회귀 검사·검사 고정자료"
    if relative.startswith("docs/") or relative == "README.md":
        return "사용·유지보수 안내·변경 이력"
    if relative.startswith("exports/"):
        return "배포용 공유 파일·생성 결과"
    if relative.startswith("sites/"):
        return "온라인 게시 소스·체크아웃 상태"
    if relative.startswith(".backups/"):
        return "변경 전 복구용 소스"
    if relative.startswith(".playwright-mcp/"):
        return "브라우저 도구 세션 산출물"
    if relative.startswith("tmp/"):
        return "현재 로컬 서버 상태·실행 중 임시자료"
    if relative.startswith("."):
        return "프로젝트 관리 설정"
    return "기타 보존 파일"

rows = []
totals = defaultdict(lambda: {"files": 0, "bytes": 0})
for file in sorted(ROOT.rglob("*")):
    if not file.is_file() or file.is_symlink():
        continue
    relative = file.relative_to(ROOT).as_posix()
    if relative.startswith("workspace/file-organization-20261112/project-file-"):
        continue
    role = purpose(relative)
    size = file.stat().st_size
    rows.append({"path": relative, "purpose": role, "bytes": size})
    totals[role]["files"] += 1
    totals[role]["bytes"] += size
with (OUT / "project-file-index.csv").open("w", newline="", encoding="utf-8-sig") as stream:
    writer = csv.DictWriter(stream, fieldnames=["path", "purpose", "bytes"])
    writer.writeheader()
    writer.writerows(rows)
summary = {"date": "2026-11-12", "scope": "정리 직후의 파일 경로·역할 스냅샷; 실행 중인 검토 산출물은 이후 늘어날 수 있음", "fileCount": len(rows), "bytes": sum(row["bytes"] for row in rows), "byPurpose": dict(totals)}
(OUT / "project-file-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Indexed {len(rows)} files by purpose.")
