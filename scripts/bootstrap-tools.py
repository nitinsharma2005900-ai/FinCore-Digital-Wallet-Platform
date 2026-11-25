"""Install portable development binaries only inside the ignored workspace .tools directory."""
from pathlib import Path
import json, urllib.request, zipfile, re
ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / '.tools'
TOOLS.mkdir(exist_ok=True)
def download(url, target):
    if not target.exists():
        print('Downloading', url, flush=True)
        urllib.request.urlretrieve(url, target)
def release(repo, predicate, folder):
    data = json.load(urllib.request.urlopen('https://api.github.com/repos/'+repo+'/releases/latest'))
    item = next(a for a in data['assets'] if predicate(a['name']))
    archive = TOOLS / item['name']
    download(item['browser_download_url'], archive)
    with zipfile.ZipFile(archive) as z: z.extractall(TOOLS / folder)
    print(folder, data['tag_name'], flush=True)
if not (TOOLS / 'pgsql/bin/postgres.exe').exists():
    html = urllib.request.urlopen('https://www.enterprisedb.com/download-postgresql-binaries').read().decode()
    links = re.findall(r'https://get\.enterprisedb\.com/[^\s<>"\x27]+windows-x64-binaries\.zip', html)
    url = next((u for u in links if '17.' in u), None)
    if not url: raise RuntimeError('No PostgreSQL 17 binary archive link found')
    archive = TOOLS / 'postgres.zip'
    download(url, archive)
    with zipfile.ZipFile(archive) as z:
        for n in z.namelist():
            if n.startswith(('pgsql/bin/','pgsql/lib/','pgsql/share/')): z.extract(n, TOOLS)
if not list((TOOLS / 'redis').glob('**/redis-server.exe')):
    release('redis-windows/redis-windows', lambda n: n.endswith('.zip') and 'x64' in n.lower() and 'cygwin' in n.lower(), 'redis')
if not (TOOLS / 'mailpit/mailpit.exe').exists():
    release('axllent/mailpit', lambda n: n.endswith('windows-amd64.zip'), 'mailpit')
print('Portable tools ready', flush=True)
