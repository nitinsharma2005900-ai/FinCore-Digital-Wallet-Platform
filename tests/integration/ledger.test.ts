import 'dotenv/config';
import {describe,it,expect,afterAll,beforeAll} from 'vitest';
import {randomUUID} from 'node:crypto';
// Refuse to run financial integrity tests against the demonstration database.
if(!process.env.TEST_DATABASE_URL?.includes('/fincore_test'))throw Error('Dedicated fincore_test PostgreSQL URL required');
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
let db:typeof import('../../apps/api/src/core').db;
let post:typeof import('../../apps/api/src/ledger').post,balance:typeof import('../../apps/api/src/ledger').balance,ledgerIntegrity:typeof import('../../apps/api/src/ledger').ledgerIntegrity;
let signLocal:typeof import('../../apps/api/src/providers').signLocal,verifyLocal:typeof import('../../apps/api/src/providers').verifyLocal;
beforeAll(async()=>{({db}=await import('../../apps/api/src/core'));({post,balance,ledgerIntegrity}=await import('../../apps/api/src/ledger'));({signLocal,verifyLocal}=await import('../../apps/api/src/providers'));});
afterAll(()=>db.$disconnect());
async function fixture(){const id=randomUUID();const u=await db.user.create({data:{email:id+'@test.invalid',name:'Synthetic Test',passwordHash:'unusable-test-hash'}});const w=await db.wallet.create({data:{userId:u.id,name:'source'}});const recipient=await db.wallet.create({data:{userId:u.id,name:'recipient'}});const treasury=await db.wallet.findFirstOrThrow({where:{type:'TREASURY'}});await post({fromWalletId:treasury.id,toWalletId:w.id,amount:'100.00',currency:'INR',kind:'FUNDING',description:'Test funding',userId:u.id,key:id,scope:'test'});return {u,w,recipient};}
describe('PostgreSQL financial integrity',()=>{
 it('posts once, detects conflicting reuse and preserves balances',async()=>{const {u,w,recipient}=await fixture();const input={fromWalletId:w.id,toWalletId:recipient.id,amount:'20.00',currency:'INR',kind:'TRANSFER' as const,description:'test',userId:u.id,key:randomUUID(),scope:'test'};const a=await post(input),b=await post(input);expect(a.id).toBe(b.id);await expect(post({...input,amount:'21.00'})).rejects.toThrow('different payload');expect((await balance(w.id)).available).toBe('80.00');});
 it('serializes competing spends and rolls back insufficient funds',async()=>{const {u,w,recipient}=await fixture();const input={fromWalletId:w.id,toWalletId:recipient.id,amount:'80.00',currency:'INR',kind:'TRANSFER' as const,description:'concurrency',userId:u.id,scope:'test'};const result=await Promise.allSettled([post({...input,key:randomUUID()}),post({...input,key:randomUUID()})]);expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await balance(w.id)).available).toBe('20.00');expect((await ledgerIntegrity()).balanced).toBe(true);});
 it('rejects invalid precision and protects journal records',async()=>{const {u,w,recipient}=await fixture();await expect(post({fromWalletId:w.id,toWalletId:recipient.id,amount:'0.001',currency:'INR',kind:'TRANSFER',description:'invalid',userId:u.id,key:randomUUID(),scope:'test'})).rejects.toThrow();const entry=await db.ledgerEntry.findFirstOrThrow({where:{walletId:w.id}});await expect(db.ledgerEntry.update({where:{id:entry.id},data:{amount:'99'}})).rejects.toThrow();});
 it('verifies signatures and rejects tampering',()=>{const body='{"test":true}';expect(()=>verifyLocal(body,signLocal(body))).not.toThrow();expect(()=>verifyLocal(body+' ',signLocal(body))).toThrow();});
});
