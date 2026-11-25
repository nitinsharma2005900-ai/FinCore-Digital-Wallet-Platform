import json, uuid
from pathlib import Path
import httpx
root=Path(__file__).resolve().parents[1]
credentials=json.loads((root/'.runtime/demo-credentials.json').read_text())
base='http://127.0.0.1:4000/api/v1'
evidence=[]
def call(c,method,path,body=None,headers=None):
    r=c.request(method,base+path,json=body,headers=headers)
    assert r.is_success,(path,r.status_code,r.text)
    evidence.append({'method':method,'path':path,'status':r.status_code})
    return r.json()['data']
def login(email):
    c=httpx.Client(timeout=15)
    d=call(c,'POST','/auth/login',{'email':email,'password':credentials['password']})
    c.headers['Authorization']='Bearer '+d['accessToken']
    return c
c=login('customer@fincore.test');r=login('recipient@fincore.test')
wallet=call(c,'GET','/wallets')[0];recipient=call(r,'GET','/wallets')[0]
reauth=call(c,'POST','/auth/reauthenticate',{'password':credentials['password']})['reauthToken']
h={'X-Reauth-Token':reauth,'Idempotency-Key':str(uuid.uuid4())}
beneficiaries=call(c,'GET','/beneficiaries')
b=next((x for x in beneficiaries if x['walletId']==recipient['id']),None)
if not b:b=call(c,'POST','/beneficiaries',{'walletId':recipient['id'],'name':'Meera Kapoor'},h)
body={'fromWalletId':wallet['id'],'beneficiaryId':b['id'],'amount':'12.34','currency':'INR','description':'Verified synthetic smoke transfer','confirmation':True}
t=call(c,'POST','/transfers',body,h)
assert call(c,'POST','/transfers',body,h)['id']==t['id']
intent=call(c,'POST','/payment-intents',{'walletId':wallet['id'],'amount':'100.00'},{'Idempotency-Key':str(uuid.uuid4())})
call(c,'POST','/payment-intents/'+intent['id']+'/confirm',{'outcome':'success'})
call(c,'GET','/transactions/'+t['id'])
call(c,'POST','/disputes',{'transactionId':t['id'],'reason':'Synthetic dispute for verified demonstration'})
call(c,'GET','/statements?walletId='+wallet['id']+'&from=2026-01-01&to=2026-12-31')
ops=login('operations@fincore.test');call(ops,'POST','/reconciliation/run',{})
fin=login('finance@fincore.test');fh={'X-Reauth-Token':call(fin,'POST','/auth/reauthenticate',{'password':credentials['password']})['reauthToken'],'Idempotency-Key':str(uuid.uuid4())}
call(fin,'POST','/finance/compensations',{'transactionId':t['id'],'kind':'REVERSAL','reason':'Controlled synthetic reversal smoke check'},fh)
assert call(fin,'GET','/finance')['integrity']['balanced']
(root/'evidence/api-smoke.json').write_text(json.dumps(evidence,indent=2))
print('API smoke checks passed:',len(evidence))
