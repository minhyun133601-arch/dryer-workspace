"""Prepare the furnace drawing sheets and field crops used by the site viewer.

Run from the project root:  python workspace/furnace-drawing-review/prepare_assets.py

The two KakaoTalk photographs are copied, unchanged, into references/화덕/도면/.
Upright sheets and small field crops are derived into apps/site/photos/furnace/.
File names stay lower-case letters so tooling/export-site.mjs embeds them.
"""
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
PHOTOS = ROOT / "references" / "화덕"
DRAWINGS = PHOTOS / "도면"
TARGET = ROOT / "apps" / "site" / "photos" / "furnace"

# The sheets were photographed turned a quarter turn. Boxes are in upright pixels.
SHEETS = {
    "sheetpiping.jpg": ("KakaoTalk_20261105_105315975.jpg", (120, 80, 2950, 2140)),
    "sheetburner.jpg": ("KakaoTalk_20261105_105315975_01.jpg", (80, 85, 3090, 2280)),
}
# Field crops: (source photo, crop box or None, what the crop is evidence for).
CROPS = {
    "regulator.jpg": ("20261104_110652.jpg", None, "Main regulator with stem and orange cap; pilot regulator in front."),
    "vmr.jpg": ("20261104_110535.jpg", None, "Elektrogas shut-off valve, nameplate VMR6-2 Rp2."),
    "modutrol.jpg": ("20261104_110533.jpg", None, "Honeywell Modutrol IV nameplate M7284A1004 and crank."),
    "switchhigh.jpg": ("20261104_110542.jpg", None, "Gauge over DUNGS GW 150 A6 pressure switch and ball valve."),
    "switchlow.jpg": ("20261104_110537.jpg", (1000, 350, 3100, 2300), "Gauge, DUNGS pressure switch and ball valve after the regulator."),
    "sight.jpg": ("20261104_110550.jpg", None, "Sight glass plate and the UV SCANNER, SPARK PLUG, PILOT GAS tags."),
    "manifold.jpg": ("20261104_110720.jpg", None, "40A stub, flange pair, elbow and flexible hose beside the wall."),
    "valve.jpg": ("20261104_110606.jpg", (0, 0, 3000, 1500), "Control valve dial, crank linkage and 50A flange pair."),
    "pilot.jpg": ("20261104_110650.jpg", None, "Pilot line running on the wall side of the main regulator."),
}
QUALITY = 80
PHOTO_LIMIT = 900


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    DRAWINGS.mkdir(parents=True, exist_ok=True)
    records = []
    for target, (source, box) in SHEETS.items():
        original = ROOT / source
        reference = DRAWINGS / source
        if not reference.exists():
            shutil.copy2(original, reference)
        assert sha256(original) == sha256(reference), f"Reference copy changed: {source}"
        sheet = ImageOps.exif_transpose(Image.open(reference)).rotate(90, expand=True).crop(box)
        sheet = ImageOps.autocontrast(sheet.convert("L"), cutoff=(0, 2))
        sheet.thumbnail((2400, 2400), Image.LANCZOS)
        sheet.save(TARGET / target, quality=QUALITY, optimize=True)
        records.append({"source": f"references/화덕/도면/{source}", "target": f"apps/site/photos/furnace/{target}",
                        "observations": "Upright grayscale sheet.", "source_sha256": sha256(reference),
                        "width": sheet.width, "height": sheet.height, "bytes": (TARGET / target).stat().st_size})
    for target, (source, box, observation) in CROPS.items():
        photo = ImageOps.exif_transpose(Image.open(PHOTOS / source)).convert("RGB")
        if box:
            photo = photo.crop(box)
        photo.thumbnail((PHOTO_LIMIT, PHOTO_LIMIT), Image.LANCZOS)
        photo.save(TARGET / target, quality=QUALITY, optimize=True)
        records.append({"source": f"references/화덕/{source}", "target": f"apps/site/photos/furnace/{target}",
                        "observations": observation, "source_sha256": sha256(PHOTOS / source),
                        "width": photo.width, "height": photo.height, "bytes": (TARGET / target).stat().st_size})
    manifest = Path(__file__).with_name("asset-map.json")
    manifest.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total = sum(record["bytes"] for record in records)
    print(f"{len(records)} assets, {total:,} bytes")


if __name__ == "__main__":
    main()
