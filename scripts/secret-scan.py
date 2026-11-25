from pathlib import Path
import urllib.request,json,zipfile,hashlib,subprocess
ROOT=Path(__file__).resolve().parents[1];tools=ROOT/'.tools/gitleaks';tools.mkdir(exist_ok=True)
binary=tools/'gitleaks.exe'
if not binary.exists():
    release=json.load(urllib.request.urlopen('https://api.github.com/repos/gitleaks/gitleaks/releases/latest'))
    asset=next(x for x in release['assets'] if x['name'].endswith('windows_x64.zip'))
    checksum=next(x for x in release['assets'] if 'checksums' in x['name'])
    archive=tools/asset['name'];urllib.request.urlretrieve(asset['browser_download_url'],archive)
    manifest=urllib.request.urlopen(checksum['browser_download_url']).read().decode()
    expected=next(line.split()[0] for line in manifest.splitlines() if line.endswith(asset['name']))
    assert hashlib.sha256(archive.read_bytes()).hexdigest()==expected,'Binary archive checksum mismatch'
    with zipfile.ZipFile(archive) as z:z.extractall(tools)
result=subprocess.run([str(binary),'git','--no-banner','--redact','--report-format','json','--report-path','evidence/gitleaks.json','.'],cwd=ROOT)
raise SystemExit(result.returncode)
