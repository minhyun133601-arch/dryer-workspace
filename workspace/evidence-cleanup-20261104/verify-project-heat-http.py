from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen
import json

ROOT = Path(__file__).resolve().parents[2] / 'references' / '열교환기'
BASE = 'http://127.0.0.1:4173/references/%EC%97%B4%EA%B5%90%ED%99%98%EA%B8%B0/00_%EC%9E%90%EB%A3%8C%EC%97%B4%EA%B8%B0.html'

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.links.extend(value for name, value in attrs if name == 'href')

parser = Links()
parser.feed((ROOT / '00_자료열기.html').read_text(encoding='utf-8'))

def verify(href):
    url = urljoin(BASE, href)
    parts = urlsplit(url)
    url = urlunsplit((parts.scheme, parts.netloc, quote(parts.path, safe='/%'), parts.query, parts.fragment))
    with urlopen(Request(url, method='HEAD'), timeout=15) as response:
        assert response.status == 200, (href, response.status)
        return {'href': href, 'status': response.status, 'mime': response.headers['Content-Type']}

with ThreadPoolExecutor(max_workers=4) as pool:
    result = list(pool.map(verify, parser.links))
(Path(__file__).parent / 'project-heat-http-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'HTTP_links_verified': len(result), 'all_statuses': sorted({row['status'] for row in result})}))
