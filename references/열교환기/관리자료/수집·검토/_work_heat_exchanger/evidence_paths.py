"""Resolve the relocated heat-exchanger source tree without rewriting past receipts."""
from pathlib import Path, PureWindowsPath
import json

WORK = Path(__file__).resolve().parent
EVIDENCE_ROOT = next(parent for parent in WORK.parents if parent.name == '열교환기')
FINAL_DIR = EVIDENCE_ROOT / '최종자료'
APPROVALS = WORK.parent / '_work_approvals' / 'approval_review_data.json'


def relocated_path(value):
    """Map an old evidence-root path to the same relative path in this package."""
    if not isinstance(value, str):
        return value
    parts = PureWindowsPath(value).parts
    for index, part in enumerate(parts):
        if part == '근거 자료':
            return str(EVIDENCE_ROOT.joinpath(*parts[index + 1:]))
    return value


def _relocated_data(value):
    if isinstance(value, dict):
        return {key: _relocated_data(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_relocated_data(item) for item in value]
    return relocated_path(value)


def load_source_json(path):
    """Read historical metadata with current paths in memory; never write it back."""
    return _relocated_data(json.loads(Path(path).read_text(encoding='utf-8-sig')))
