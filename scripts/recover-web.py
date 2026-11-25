from pathlib import Path
import subprocess
Path('apps/web/app/page.tsx').write_bytes(subprocess.check_output(['git','show','HEAD:apps/web/app/page.tsx']))
p=Path('scripts/refine-web.py')
s=p.read_text(encoding='utf-8').replace('p.read_text()',"p.read_text(encoding='utf-8')").replace('p.write_text(s)',"p.write_text(s,encoding='utf-8')").replace('☰','Menu')
p.write_text(s,encoding='utf-8')
