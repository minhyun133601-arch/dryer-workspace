# Production collection — completed 2026-11-04

The collection is complete. No copying, archive extraction, upload, or staging job remains active. Do not resume historical process IDs or rescan the full share.

- Source: authenticated Z: mapping to \\192.168.1.188\생산팀; source files and permissions were not changed.
- Local collection: C:/Users/user/Desktop/프로젝트/references/생산팀 수집자료
- Source/member aliases: 9,374, all verified and all origins retained.
- Exact SHA256 representatives: 4,295 files, 18,640,034,664 bytes. Identical bytes are stored once even when original extensions differ.
- Drive packages: 68 independent ZIPs, 16,596,704,483 bytes; 7 DWG, 38 related-material, 23 equipment-history packages.
- Actual three-folder Drive listing exactly matches all 68 unique ledger IDs, names, sizes, and categories.
- All 9,374 aliases map to exactly one archived SHA256 member; mapping errors and duplicate archived source hashes: 0.
- Maximum ZIP member path length: 119 characters.
- Initial standalone LS.dwg test upload is absent from the active Drive folder.
- Owned C ZIP staging: 0. Local canonical originals remain available.
- Root metadata: six documents published and ID/size/parent read back, including searchable HTML, complete source CSV, ZIP CSV, archive exceptions, status JSON, and README.

Drive folder:
https://drive.google.com/drive/folders/1Mz8dWqxT7sH2nqe36esr5LNqCPb0uRzb

## Verification receipts

- cloud-final-verification.json — complete final cross-check and metadata document IDs/URLs
- cloud-server-final-listing.json — observed three-folder listing
- cloud-upload-ledger.jsonl — verified package IDs, sizes, URLs, client SHA256
- cloud-metadata-published.json — six published metadata documents
- collection-final-summary.json — local finalization
- copy-records-strict-dedup-20261104-142232-126013-63c1d7.jsonl — final canonical source aliases

Client source/member/package SHA256 values were verified during copying and ZIP creation. Drive upload IDs, exact sizes, and parent folders were read back. No Drive server checksum comparison is claimed.

## Archive-listing limits

Bandizip recovered 29 of the original 33 unreadable archive listings. Four remain in 00_압축내부_확인불가.csv: three ZIP listing timeouts and one unrelated password-protected Windows OS RAR. No password was entered. Their unknown internal contents are not included in the claim that all selected aliases were collected.

The recovered archives added 12 PDF aliases representing three exact-content files. The final plan is 9,374 aliases / 28,923,095,261 logical source bytes.

## Safe future checks

Run python -X utf8 finalize_cloud_archive.py verify for a read-only consistency check using saved server listings. Fetch a fresh Drive listing before asserting current remote state on a later date. Do not delete cloud originals, local canonical collection copies, app caches, or runtime data as routine cleanup.
