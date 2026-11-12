from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit
import json

PROJECT = Path(__file__).resolve().parents[2]
ROOT = PROJECT / 'references' / '열교환기'

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.links.extend(value for name, value in attrs if name == 'href')

parser = Links()
parser.feed((ROOT / '00_자료열기.html').read_text(encoding='utf-8'))
local = [ROOT / unquote(urlsplit(href).path) for href in parser.links if not urlsplit(href).scheme]
missing = [str(path) for path in local if not path.exists()]
assert not missing, missing
assert (PROJECT / 'index.html').read_text(encoding='utf-8').count('references/열교환기/00_자료열기.html') == 1
assert not (PROJECT.parent / '근거 자료' / '00_자료열기.html').exists()
result = {'local_links_verified': len(local), 'missing': missing, 'project_home_link': True, 'old_evidence_entry_absent': True}
(Path(__file__).parent / 'project-heat-links-verification.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result))
