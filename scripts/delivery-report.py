from pathlib import Path
import zipfile
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from xml.sax.saxutils import escape
root=Path(__file__).resolve().parents[1]
names=['Financial customer frontend','Financial REST APIs','Double-entry ledger database','Financial identity and authorization','Python financial calculations','FastAPI risk analytics','Transfer consistency engine','Payment and notification integrations','Containerized financial stack','Git and change governance','Secure financial CI/CD','Ledger and payment testing','Financial API contracts','Secure deployment and recovery','Financial incident simulation']
rows=[]
for i,name in enumerate(names,1):
    status='COMPLETE AND VERIFIED' if i in (5,6) else 'NOT IMPLEMENTED' if i in (9,11,13,15) else 'IMPLEMENTED BUT NOT VERIFIED'
    limitation='8 Python tests passed; coverage report includes service and test code. No production capacity claim.' if i in (5,6) else 'Partial implementation; 4 ledger tests, 20 API requests and browser login passed. Full assessment verification remains incomplete; see README.'
    path=root/'docs/assessments'/f'{i:02d}.md';path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(f'# Assessment {i:02d}: {name}\n\nStatus: {status}\n\nObjective: {name}.\n\nImplementation: apps/api/src, apps/web/app, database, services/financial-analytics.\n\nTests: services/financial-analytics/test_app.py; tests/integration/ledger.test.ts (not yet executed).\n\nEvidence: evidence/python-tests.xml, evidence/python-coverage.xml, evidence/python-benchmark.json. Python evidence applies only to assessments 05 and 06.\n\nLimitation: {limitation}\n',encoding='utf8')
    rows.append(f'| {i:02d} | {name} | `{path.relative_to(root)}` | {status} | {limitation} |')
(root/'ASSESSMENT_MATRIX.md').write_text('# Assessment matrix\n\nThis is an interim status, not a completed submission.\n\n| Assessment | Requirement | Documentation | Status | Remaining limitation |\n|---|---|---|---|---|\n'+'\n'.join(rows),encoding='utf8')
styles=getSampleStyleSheet();story=[]
for name in ['README.md','ASSESSMENT_MATRIX.md','docs/IMPLEMENTATION_CHECKLIST.md']:
    story.append(Paragraph(escape(name),styles['Heading1']))
    for line in (root/name).read_text(encoding='utf8').splitlines():
        if line.strip():story.append(Paragraph(escape(line),styles['BodyText']));story.append(Spacer(1,5))
out=root/'docs/FinCore_Project_Report.pdf';SimpleDocTemplate(str(out)).build(story)
archive=root/'FinCore_Digital_Wallet_Platform.zip'
excluded={'.git','.env','.runtime','.tools','.venv','node_modules','.next','__pycache__','.pytest_cache','coverage','dist'}
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p in root.rglob('*'):
        rel=p.relative_to(root)
        if p.is_file() and not any(part in excluded for part in rel.parts) and p.suffix not in ('.zip','.log','.pyc') and not p.name.startswith('.env.') or False:
            z.write(p,str(rel))
    z.write(root/'.env.example','.env.example')
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert 'package.json' in z.namelist() and '.env' not in z.namelist()
print('Created report and verified interim source archive:',archive)
