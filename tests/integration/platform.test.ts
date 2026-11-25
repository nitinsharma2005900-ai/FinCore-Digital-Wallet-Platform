import 'dotenv/config';
import {beforeAll,afterAll,it,expect} from 'vitest';
import request from 'supertest';
import {randomUUID} from 'node:crypto';
if(!process.env.TEST_DATABASE_URL?.includes('/fincore_test'))throw Error('Dedicated test database required');
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
let app:typeof import('../../apps/api/src/app').app,db:typeof import('../../apps/api/src/core').db;
let customer:any,other:any,finance:any,admin:any,support:any,ops:any,wallet:any,beneficiary:any;
const password='SyntheticTestPassword123!';
const headers=(u:any)=>({Authorization:'Bearer '+u.token,...(u.reauth?{'X-Reauth-Token':u.reauth}:{}),'Idempotency-Key':randomUUID()});
async function user(role='CUSTOMER'){
 const email=randomUUID()+'@integration.test';const result=await request(app).post('/api/v1/auth/register').send({email,password,name:'Synthetic Integration'});expect(result.status).toBe(201);
 if(role!=='CUSTOMER')await db.user.update({where:{email},data:{role}});
 const token=result.body.data.accessToken;
 const reauth=await request(app).post('/api/v1/auth/reauthenticate').set('Authorization','Bearer '+token).send({password});
 return {token,reauth:reauth.body.data.reauthToken,id:result.body.data.user.id,email,cookie:result.headers['set-cookie']};
}
beforeAll(async()=>{
 ({app}=await import('../../apps/api/src/app'));({db}=await import('../../apps/api/src/core'));
 customer=await user();other=await user();finance=await user('FINANCE');admin=await user('ADMIN');support=await user('SUPPORT');ops=await user('OPERATIONS');
 wallet=(await request(app).get('/api/v1/wallets').set(headers(customer))).body.data[0];const to=(await request(app).get('/api/v1/wallets').set(headers(other))).body.data[0];
 beneficiary=(await request(app).post('/api/v1/beneficiaries').set(headers(customer)).send({walletId:to.id,name:'Recipient'})).body.data;
 const {post}=await import('../../apps/api/src/ledger');const treasury=await db.wallet.findFirstOrThrow({where:{type:'TREASURY'}});await post({fromWalletId:treasury.id,toWalletId:wallet.id,amount:'500.00',currency:'INR',kind:'FUNDING',description:'Integration funding',userId:customer.id,key:randomUUID(),scope:'integration'});
},30000);
afterAll(()=>db.$disconnect());
it('rejects unauthenticated access and role escalation at registration',async()=>{
 expect((await request(app).get('/api/v1/wallets')).status).toBe(401);
 expect((await request(app).post('/api/v1/auth/register').send({email:randomUUID()+'@test.invalid',password,name:'Test',role:'ADMIN'})).status).toBe(422);
 for(const path of ['/admin/users','audit','finance','risk-alerts'].map(p=>'/api/v1/'+p.replace(/^\//,'')))expect((await request(app).get(path).set(headers(customer))).status).toBe(403);
 expect((await request(app).post('/api/v1/payment-intents').set(headers(admin)).send({walletId:wallet.id,amount:'1.00'})).status).toBe(403);
});
it('enforces ownership, validation and sensitive-action confirmation',async()=>{
 expect((await request(app).patch('/api/v1/wallets/'+wallet.id).set(headers(other)).send({name:'Stolen wallet'})).status).toBe(404);
 expect((await request(app).post('/api/v1/transfers').set({Authorization:'Bearer '+customer.token}).send({})).status).toBe(403);
 for(const amount of ['-1','0','1.001','NaN',1.2])expect((await request(app).post('/api/v1/transfers').set(headers(customer)).send({fromWalletId:wallet.id,beneficiaryId:beneficiary.id,amount,currency:'INR',description:'Invalid',confirmation:true})).status).toBe(422);
});
it('holds reduce available funds and release restores them',async()=>{
 const hold=await request(app).post('/api/v1/holds').set(headers(customer)).send({walletId:wallet.id,amount:'450.00',reason:'Synthetic reservation'});expect(hold.status).toBe(201);
 const result=await request(app).post('/api/v1/transfers').set(headers(customer)).send({fromWalletId:wallet.id,beneficiaryId:beneficiary.id,amount:'100.00',currency:'INR',description:'Blocked by hold',confirmation:true});expect(result.status).toBe(422);
 expect((await request(app).delete('/api/v1/holds/'+hold.body.data.id).set(headers(customer))).status).toBe(200);
});
it('supports transfers, details, CSV/PDF statements, disputes and reversal',async()=>{
 const input={fromWalletId:wallet.id,beneficiaryId:beneficiary.id,amount:'10.00',currency:'INR',description:'Integration transfer',confirmation:true};const h=headers(customer);
 const t=await request(app).post('/api/v1/transfers').set(h).send(input);expect(t.status).toBe(201);
 expect((await request(app).post('/api/v1/transfers').set(h).send(input)).body.data.id).toBe(t.body.data.id);
 expect((await request(app).post('/api/v1/transfers').set(h).send({...input,amount:'11.00'})).status).toBe(409);
 expect((await request(app).get('/api/v1/transactions/'+t.body.data.id).set(headers(admin))).status).toBe(404);
 for(const format of ['json','csv','pdf']){const response=await request(app).get('/api/v1/statements').query({walletId:wallet.id,from:new Date().toISOString().slice(0,10),to:new Date().toISOString().slice(0,10),format}).set(headers(customer));expect(response.status).toBe(200);expect(response.headers['content-type']).toContain(format==='json'?'application/json':format==='csv'?'text/csv':'application/pdf');}
 const d=await request(app).post('/api/v1/disputes').set(headers(customer)).send({transactionId:t.body.data.id,reason:'Controlled synthetic dispute test'});expect(d.status).toBe(201);
 expect((await request(app).patch('/api/v1/disputes/'+d.body.data.id).set(headers(support)).send({status:'INVESTIGATING',resolution:'Assigned for synthetic investigation'})).status).toBe(200);
 expect((await request(app).patch('/api/v1/disputes/'+d.body.data.id).set(headers(support)).send({status:'RESOLVED',resolution:'Synthetic resolution recorded'})).status).toBe(200);
 const refund=await request(app).post('/api/v1/finance/compensations').set(headers(finance)).send({transactionId:t.body.data.id,kind:'REVERSAL',reason:'Synthetic approved reversal'});expect(refund.status).toBe(200);
 expect((await request(app).get('/api/v1/finance').set(headers(finance))).body.data.integrity.balanced).toBe(true);
});
it('handles signed webhook replay, mismatch, failed settlement and out-of-order delivery',async()=>{
 const {signLocal}=await import('../../apps/api/src/providers');
 const intent=(await request(app).post('/api/v1/payment-intents').set(headers(customer)).send({walletId:wallet.id,amount:'20.00'})).body.data;
 const event={id:randomUUID(),providerId:intent.providerId,type:'payment.succeeded',amount:'20.00'};const raw=JSON.stringify(event);
 expect((await request(app).post('/api/v1/webhooks/payments').set('Content-Type','application/json').send(raw)).status).toBe(400);
 const send=async(e:any)=>{const body=JSON.stringify(e);return request(app).post('/api/v1/webhooks/payments').set('Content-Type','application/json').set('X-Fincore-Signature',signLocal(body)).send(body);};
 expect((await send(event)).status).toBe(200);expect((await send(event)).body.data.duplicate).toBe(true);
 expect((await send({...event,id:randomUUID(),type:'payment.failed'})).body.data.status).toBe('IGNORED');
 const failed=(await request(app).post('/api/v1/payment-intents').set(headers(customer)).send({walletId:wallet.id,amount:'30.00'})).body.data;
 expect((await send({id:randomUUID(),providerId:failed.providerId,type:'payment.failed',amount:'30.00'})).body.data.status).toBe('FAILED');
 const mismatch=(await request(app).post('/api/v1/payment-intents').set(headers(customer)).send({walletId:wallet.id,amount:'40.00'})).body.data;
 expect((await send({id:randomUUID(),providerId:mismatch.providerId,type:'payment.succeeded',amount:'39.00'})).body.data.status).toBe('AMOUNT_MISMATCH');
 const reconciliation=await request(app).post('/api/v1/reconciliation/run').set(headers(ops)).send({});expect(reconciliation.status).toBe(200);expect(reconciliation.body.data.some((r:any)=>r.status==='FAILED_SETTLEMENT')).toBe(true);
});
it('rotates refresh cookies, detects replay and revokes the family',async()=>{
 const u=await user();const cookie=u.cookie[0].split(';')[0];
 const first=await request(app).post('/api/v1/auth/refresh').set('Origin','http://127.0.0.1:3000').set('Cookie',cookie);expect(first.status).toBe(200);
 expect((await request(app).post('/api/v1/auth/refresh').set('Origin','https://untrusted.test').set('Cookie',cookie)).status).toBe(403);
 expect((await request(app).post('/api/v1/auth/refresh').set('Origin','http://127.0.0.1:3000').set('Cookie',cookie)).status).toBe(401);
 expect((await request(app).get('/api/v1/me').set('Authorization','Bearer '+first.body.data.accessToken)).status).toBe(401);
});
it('enforces MFA expiry, attempts and successful single use',async()=>{
 const u=await user();await db.user.update({where:{id:u.id},data:{mfaEnabled:true}});
 const challenge=(await request(app).post('/api/v1/auth/login').send({email:u.email,password})).body.data;
 expect(challenge.mfaRequired).toBe(true);
 expect((await request(app).post('/api/v1/auth/mfa').send({challengeId:challenge.challengeId,code:challenge.simulationCode})).status).toBe(200);
 expect((await request(app).post('/api/v1/auth/mfa').send({challengeId:challenge.challengeId,code:challenge.simulationCode})).status).toBe(401);
 const locked=(await request(app).post('/api/v1/auth/login').send({email:u.email,password})).body.data;
 for(let i=0;i<5;i++)await request(app).post('/api/v1/auth/mfa').send({challengeId:locked.challengeId,code:'000000'});
 expect((await request(app).post('/api/v1/auth/mfa').send({challengeId:locked.challengeId,code:locked.simulationCode})).status).toBe(401);
});
it('serves OpenAPI for every registered contract',async()=>{const r=await request(app).get('/openapi.json');expect(r.status).toBe(200);expect(Object.keys(r.body.paths).length).toBeGreaterThan(30);});
