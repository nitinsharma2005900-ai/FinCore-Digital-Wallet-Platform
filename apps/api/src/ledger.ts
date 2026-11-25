import { Prisma, PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
import { randomUUID } from 'node:crypto';
import { db,fail,sha,audit } from './core';
Decimal.set({precision:40,rounding:Decimal.ROUND_HALF_EVEN});
export type Client=Prisma.TransactionClient;
export async function balance(walletId:string,client:Client|PrismaClient=db){
 const [row]=await client.$queryRaw<{settled:Prisma.Decimal;held:Prisma.Decimal}[]>`
 SELECT COALESCE((SELECT sum(CASE WHEN direction='CREDIT' THEN amount ELSE -amount END) FROM "LedgerEntry" WHERE "walletId"=${walletId}),0) AS settled,
 COALESCE((SELECT sum(amount) FROM "Hold" WHERE "walletId"=${walletId} AND status='ACTIVE'),0) AS held`;
 return {settled:new Decimal(row.settled.toString()).toFixed(2),held:new Decimal(row.held.toString()).toFixed(2),available:new Decimal(row.settled.toString()).minus(row.held.toString()).toFixed(2)};
}
export async function ownWallet(id:string,userId:string,client:Client|PrismaClient=db){
 const w=await client.wallet.findFirst({where:{id,userId,type:'CUSTOMER'}});
 return w || fail(404,'WALLET_NOT_FOUND','Wallet not found');
}
export type Posting={fromWalletId:string;toWalletId:string;amount:string;currency:string;kind:'TRANSFER'|'FUNDING'|'REFUND'|'REVERSAL';description:string;userId:string|null;originalId?:string;key:string;scope:string;requestId?:string;fingerprint?:string};
export async function postInTransaction(client:Client,input:Posting){
 const value=new Decimal(input.amount);
 if(!value.isFinite() || value.lte(0) || value.gt(10000000) || value.decimalPlaces()>2) fail(422,'INVALID_AMOUNT','Amount must be between INR 0.01 and 10,000,000.00');
 if(input.currency!=='INR' || input.fromWalletId===input.toWalletId) fail(422,'INVALID_TRANSFER','Use distinct INR wallets');
 const id=`${input.scope}:${input.key}`;
 const payloadHash=sha(JSON.stringify([input.fromWalletId,input.toWalletId,value.toFixed(2),input.currency,input.kind,input.description,input.originalId||null,input.fingerprint||null]));
 await client.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},0))::text`;
 const previous=await client.idempotency.findUnique({where:{id}});
 if(previous){if(previous.payloadHash!==payloadHash) fail(409,'IDEMPOTENCY_CONFLICT','This key has already been used with a different payload');return client.transaction.findUniqueOrThrow({where:{id:previous.transactionId}});}
 const ids=[input.fromWalletId,input.toWalletId].sort();
 await client.$queryRaw`SELECT id FROM "Wallet" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
 const wallets=await client.wallet.findMany({where:{id:{in:ids}}});
 if(wallets.length!==2 || wallets.some(w=>w.status!=='ACTIVE'||w.currency!==input.currency)) fail(422,'WALLET_UNAVAILABLE','Both wallets must be active and use the same currency');
 const source=wallets.find(w=>w.id===input.fromWalletId)!;
 if(source.type!=='TREASURY' && new Decimal((await balance(source.id,client)).available).lt(value)) fail(422,'INSUFFICIENT_FUNDS','The wallet has insufficient available funds');
 const transaction=await client.transaction.create({data:{id:randomUUID(),userId:input.userId,fromWalletId:input.fromWalletId,toWalletId:input.toWalletId,amount:value.toFixed(2),currency:input.currency,kind:input.kind,description:input.description,originalId:input.originalId,status:'PENDING'}});
 await client.ledgerEntry.createMany({data:[{transactionId:transaction.id,walletId:input.fromWalletId,direction:'DEBIT',amount:value.toFixed(2)},{transactionId:transaction.id,walletId:input.toWalletId,direction:'CREDIT',amount:value.toFixed(2)}]});
 const posted=await client.transaction.update({where:{id:transaction.id},data:{status:'POSTED'}});
 await client.idempotency.create({data:{id,payloadHash,transactionId:posted.id}});
 await audit(input.userId,'ledger.posted',posted.id,input.requestId,{kind:input.kind,amount:value.toFixed(2)},client);
 if(input.userId) await client.notification.create({data:{userId:input.userId,title:`${input.kind.toLowerCase()} completed`,message:`INR ${value.toFixed(2)} · ${input.description}`}});
 return posted;
}
// READ COMMITTED + sorted row locks keeps balance reads fresh after a lock wait.
// Only deadlock/serialization failures are retried; every retry has a durable key.
export async function atomic<T>(fn:(c:Client)=>Promise<T>):Promise<T>{
 for(let attempt=0;attempt<3;attempt++){
  try{return await db.$transaction(fn,{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted,timeout:15000,maxWait:10000});}
  catch(e){if(!(e instanceof Prisma.PrismaClientKnownRequestError && e.code==='P2034')||attempt===2) throw e;}
 }
 throw new Error('Unreachable');
}
export const post=(input:Posting)=>atomic(c=>postInTransaction(c,input));
export async function ledgerIntegrity(client:Client|PrismaClient=db){
 const invalid=await client.$queryRaw<{id:string}[]>`SELECT t.id FROM "Transaction" t LEFT JOIN "LedgerEntry" e ON e."transactionId"=t.id WHERE t.status='POSTED' GROUP BY t.id HAVING count(e.id)<>2 OR sum(CASE WHEN e.direction='CREDIT' THEN e.amount ELSE -e.amount END)<>0`;
 const [totals]=await client.$queryRaw<{debits:Prisma.Decimal;credits:Prisma.Decimal;entries:bigint}[]>`SELECT COALESCE(sum(amount) FILTER(WHERE direction='DEBIT'),0) AS debits,COALESCE(sum(amount) FILTER(WHERE direction='CREDIT'),0) AS credits,count(*) AS entries FROM "LedgerEntry"`;
 return {balanced:invalid.length===0,invalidTransactions:invalid,debits:totals.debits.toFixed(2),credits:totals.credits.toFixed(2),entries:Number(totals.entries)};
}
