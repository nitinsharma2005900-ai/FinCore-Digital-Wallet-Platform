"""Encrypted synthetic backup and isolated restore drill. Never overwrites a database."""
from pathlib import Path
from urllib.parse import urlparse,unquote
import os,json,subprocess,time,uuid
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
ROOT=Path(__file__).resolve().parents[1]
env=dict(line.split('=',1) for line in (ROOT/'.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
url=urlparse(env['MIGRATION_DATABASE_URL']);bin=ROOT/'.tools/pgsql/bin'
process_env={**os.environ,'PGPASSWORD':unquote(url.password)}
args=['-h',url.hostname,'-p',str(url.port or 5432),'-U',url.username]
def run(name,extra,body=None):
    p=subprocess.run([str(bin/(name+'.exe' if os.name=='nt' else name)),*args,*extra],input=body,capture_output=True,env=process_env)
    if p.returncode:raise RuntimeError(name+' failed: '+p.stderr.decode(errors='replace')[:500])
    return p.stdout
check='''SELECT json_build_object('transactions',(SELECT count(*) FROM "Transaction"),'entries',(SELECT count(*) FROM "LedgerEntry"),'debits',(SELECT coalesce(sum(amount),0)::text FROM "LedgerEntry" WHERE direction='DEBIT'),'credits',(SELECT coalesce(sum(amount),0)::text FROM "LedgerEntry" WHERE direction='CREDIT'),'unbalanced',(SELECT count(*) FROM (SELECT t.id FROM "Transaction" t LEFT JOIN "LedgerEntry" e ON e."transactionId"=t.id WHERE t.status='POSTED' GROUP BY t.id HAVING count(e.id)<>2 OR sum(CASE WHEN e.direction='CREDIT' THEN e.amount ELSE -e.amount END)<>0) q))'''
def verify(db):return json.loads(run('psql',['-d',db,'-At','-c',check]).decode())
start=time.perf_counter();source=url.path[1:];before=verify(source)
dump=run('pg_dump',['-d',source,'-Fc','--no-owner'])
salt=os.urandom(16);nonce=os.urandom(12)
key=Scrypt(salt=salt,length=32,n=2**14,r=8,p=1).derive(env['BACKUP_SECRET'].encode())
cipher=AESGCM(key);encrypted=cipher.encrypt(nonce,dump,b'FinCore backup v1')
backup=ROOT/'.runtime/backups'/('fincore-'+uuid.uuid4().hex+'.enc');backup.parent.mkdir(exist_ok=True,parents=True)
backup.write_bytes(b'FCB1'+salt+nonce+encrypted)
blob=backup.read_bytes();restored=cipher.decrypt(blob[20:32],blob[32:],b'FinCore backup v1');assert restored==dump
target='fincore_restore_'+uuid.uuid4().hex[:10]
assert target.startswith('fincore_restore_') and target!=source
run('psql',['-d','postgres','-v','ON_ERROR_STOP=1','-c','CREATE DATABASE '+target])
try:
    run('pg_restore',['-d',target,'--no-owner','--exit-on-error'],restored)
    after=verify(target)
    assert before==after,(before,after)
    assert after['unbalanced']==0 and after['debits']==after['credits']
finally:run('psql',['-d','postgres','-c','DROP DATABASE '+target])
report={'encryption':'AES-256-GCM; scrypt-derived key; fresh salt and nonce','before':before,'after':after,'verified':True,'elapsedSeconds':time.perf_counter()-start,'backupPath':str(backup.relative_to(ROOT)),'restoredDatabaseDropped':True,'scope':'Synthetic local PostgreSQL database. Not a cloud backup or disaster recovery SLA.'}
(ROOT/'evidence/restore-drill.json').write_text(json.dumps(report,indent=2))
print('Encrypted backup and isolated restore drill passed')
