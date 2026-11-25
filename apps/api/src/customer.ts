import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { db,send,fail,page,audit } from './core';
import { allow,reauthenticated,publicUser } from './auth';
import { balance,ownWallet,post,atomic } from './ledger';
import { analytics } from './analytics';
import { money,transferSchema } from '../../../packages/shared/src';
export const customer=Router();
customer.get('/me',async(req,res)=>send(res,publicUser(await db.user.findUniqueOrThrow({where:{id:req.actor!.id}}))));
customer.patch('/me',async(req,res)=>{
 const body=z.object({name:z.string().trim().min(2).max(80),phone:z.string().regex(/^\+?[0-9]{10,15}$/).nullable().optional()}).strict().parse(req.body);
 send(res,publicUser(await db.user.update({where:{id:req.actor!.id},data:body})));await audit(req.actor!.id,'profile.updated',req.actor!.id,req.requestId);
});
customer.patch('/me/security',reauthenticated,async(req,res)=>{
 const body=z.object({mfaEnabled:z.boolean().optional(),password:z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).optional()}).strict().refine(v=>Object.keys(v).length>0).parse(req.body);
 if(body.mfaEnabled===true&&process.env.NODE_ENV==='production')fail(409,'SIMULATED_MFA_LOCAL_ONLY','Simulated MFA codes are available only in local development. Configure a secure MFA delivery adapter before production activation.');
 const user=await db.user.update({where:{id:req.actor!.id},data:{mfaEnabled:body.mfaEnabled,...(body.password?{passwordHash:await bcrypt.hash(body.password,12)}:{})}});
 if(body.password)await db.session.updateMany({where:{userId:user.id,id:{not:req.actor!.sessionId}},data:{revokedAt:new Date()}});
 await audit(user.id,'security.updated',user.id,req.requestId);send(res,publicUser(user));
});
customer.get('/sessions',async(req,res)=>send(res,await db.session.findMany({where:{userId:req.actor!.id,revokedAt:null},select:{id:true,createdAt:true,expiresAt:true},orderBy:{createdAt:'desc'},take:100})));
customer.delete('/sessions/:id',reauthenticated,async(req,res)=>{const r=await db.session.updateMany({where:{id:String(req.params.id),userId:req.actor!.id},data:{revokedAt:new Date()}});if(!r.count)fail(404,'NOT_FOUND','Session not found');await audit(req.actor!.id,'auth.session_revoked',String(req.params.id),req.requestId);send(res,{revoked:true});});
customer.get('/notifications',async(req,res)=>{const p=page(req.query);const where={userId:req.actor!.id};send(res,await db.notification.findMany({where,orderBy:{createdAt:'desc'},skip:p.skip,take:p.limit}),{...p,total:await db.notification.count({where})});});
customer.patch('/notifications/:id',async(req,res)=>{const r=await db.notification.updateMany({where:{id:String(req.params.id),userId:req.actor!.id},data:{read:true}});if(!r.count)fail(404,'NOT_FOUND','Notification not found');send(res,{read:true});});
customer.get('/dashboard',async(req,res)=>{
 const wallets=await db.wallet.findMany({where:{userId:req.actor!.id}});
 const decorated=await Promise.all(wallets.map(async w=>({...w,...await balance(w.id)})));
 const ids=wallets.map(w=>w.id);
 const transactions=await db.transaction.findMany({where:{OR:[{fromWalletId:{in:ids}},{toWalletId:{in:ids}}]},orderBy:{createdAt:'desc'},take:12});
 const month=new Date();month.setUTCDate(1);month.setUTCHours(0,0,0,0);
 const entries=await db.ledgerEntry.findMany({where:{walletId:{in:ids},createdAt:{gte:month}},orderBy:{createdAt:'asc'}});
 let incoming=new Decimal(0),outgoing=new Decimal(0);
 const series=new Map<string,{date:string;incoming:Decimal;outgoing:Decimal}>();
 for(const entry of entries){const date=entry.createdAt.toISOString().slice(0,10);const s=series.get(date)||{date,incoming:new Decimal(0),outgoing:new Decimal(0)};if(entry.direction==='CREDIT'){incoming=incoming.plus(entry.amount.toString());s.incoming=s.incoming.plus(entry.amount.toString());}else{outgoing=outgoing.plus(entry.amount.toString());s.outgoing=s.outgoing.plus(entry.amount.toString());}series.set(date,s);}
 const staff=req.actor!.role==='SUPPORT'?{openDisputes:await db.dispute.count({where:{status:{in:['OPEN','INVESTIGATING']}}})}:req.actor!.role==='OPERATIONS'?{openRiskAlerts:await db.riskAlert.count({where:{status:'OPEN'}}),mismatches:await db.reconciliation.count({where:{status:{not:'MATCHED'}}})}:req.actor!.role==='FINANCE'?{postedTransactions:await db.transaction.count({where:{status:'POSTED'}}),refunds:await db.refund.count()}:req.actor!.role==='ADMIN'?{users:await db.user.count(),activeSessions:await db.session.count({where:{revokedAt:null,expiresAt:{gt:new Date()}}})}:{};
 send(res,{wallets:decorated,available:decorated.reduce((s,w)=>s.plus(w.available),new Decimal(0)).toFixed(2),incoming:incoming.toFixed(2),outgoing:outgoing.toFixed(2),transactions,series:[...series.values()].map(s=>({date:s.date,incoming:s.incoming.toFixed(2),outgoing:s.outgoing.toFixed(2)})),staff,provider:process.env.PAYMENT_PROVIDER||'local'});
});
customer.get('/wallets',async(req,res)=>send(res,await Promise.all((await db.wallet.findMany({where:{userId:req.actor!.id},orderBy:{createdAt:'asc'}})).map(async w=>({...w,...await balance(w.id)})))));
customer.post('/wallets',allow('CUSTOMER'),async(req,res)=>{const body=z.object({name:z.string().trim().min(2).max(60)}).strict().parse(req.body);res.status(201);send(res,await db.wallet.create({data:{name:body.name,userId:req.actor!.id}}));});
customer.patch('/wallets/:id',allow('CUSTOMER'),reauthenticated,async(req,res)=>{
 const body=z.object({name:z.string().trim().min(2).max(60).optional(),status:z.enum(['ACTIVE','FROZEN']).optional()}).strict().refine(v=>Object.keys(v).length>0).parse(req.body);
 await ownWallet(String(req.params.id),req.actor!.id);send(res,await db.wallet.update({where:{id:String(req.params.id)},data:body}));await audit(req.actor!.id,'wallet.updated',String(req.params.id),req.requestId,body);
});
customer.get('/accounts',async(req,res)=>send(res,await db.account.findMany({where:{userId:req.actor!.id}})));
customer.post('/accounts',allow('CUSTOMER'),async(req,res)=>{const body=z.object({label:z.string().trim().min(2).max(60)}).strict().parse(req.body);res.status(201);send(res,await db.account.create({data:{userId:req.actor!.id,label:body.label,reference:'FC-'+randomBytes(8).toString('hex').toUpperCase()}}));});
customer.get('/directory',allow('CUSTOMER'),async(req,res)=>{
 const email=z.email().parse(req.query.email);const user=await db.user.findFirst({where:{email,role:'CUSTOMER',disabled:false}});
 if(!user)fail(404,'NOT_FOUND','No simulated recipient found for that email');
 const w=await db.wallet.findFirst({where:{userId:user!.id,type:'CUSTOMER',status:'ACTIVE'},orderBy:{createdAt:'asc'}});
 if(!w)fail(404,'NOT_FOUND','No active recipient wallet');send(res,{name:user!.name,walletId:w!.id});
});
customer.get('/beneficiaries',allow('CUSTOMER'),async(req,res)=>send(res,await db.beneficiary.findMany({where:{userId:req.actor!.id},orderBy:{createdAt:'desc'}})));
customer.post('/beneficiaries',allow('CUSTOMER'),reauthenticated,async(req,res)=>{
 const body=z.object({name:z.string().trim().min(2).max(80),walletId:z.string().min(1)}).strict().parse(req.body);
 const recipient=await db.wallet.findFirst({where:{id:body.walletId,status:'ACTIVE',type:'CUSTOMER',userId:{not:req.actor!.id}}});
 if(!recipient)fail(422,'INVALID_BENEFICIARY','Use another customer’s active wallet');
 const result=await db.beneficiary.create({data:{...body,userId:req.actor!.id}});await audit(req.actor!.id,'beneficiary.created',result.id,req.requestId);res.status(201);send(res,result);
});
customer.delete('/beneficiaries/:id',allow('CUSTOMER'),reauthenticated,async(req,res)=>{const r=await db.beneficiary.deleteMany({where:{id:String(req.params.id),userId:req.actor!.id}});if(!r.count)fail(404,'NOT_FOUND','Beneficiary not found');await audit(req.actor!.id,'beneficiary.deleted',String(req.params.id),req.requestId);send(res,{deleted:true});});
customer.post('/transfers/quote',allow('CUSTOMER'),async(req,res)=>{const body=z.object({amount:money}).strict().parse(req.body);send(res,await analytics('/fees',{amount:body.amount,rate:'0'}));});
customer.post('/transfers',allow('CUSTOMER'),reauthenticated,async(req,res)=>{
 const body=transferSchema.parse(req.body);await ownWallet(body.fromWalletId,req.actor!.id);
 const key=z.string().min(8).max(128).parse(req.headers['idempotency-key']);
 const previous=await db.idempotency.findUnique({where:{id:`transfer:${req.actor!.id}:${key}`}});
 if(previous){const original=await db.transaction.findUniqueOrThrow({where:{id:previous.transactionId}});const replay=await post({fromWalletId:body.fromWalletId,toWalletId:original.toWalletId,amount:body.amount,currency:body.currency,kind:'TRANSFER',description:body.description,userId:req.actor!.id,key,scope:`transfer:${req.actor!.id}`,requestId:req.requestId,fingerprint:body.beneficiaryId});res.status(201);return send(res,replay);}
 const beneficiary=await db.beneficiary.findFirst({where:{id:body.beneficiaryId,userId:req.actor!.id}});if(!beneficiary)fail(404,'NOT_FOUND','Beneficiary not found');
 const hour=new Date(Date.now()-3600000),day=new Date(Date.now()-86400000);
 const result=await analytics('/risk',{amount:body.amount,transfersLastHour:await db.transaction.count({where:{userId:req.actor!.id,kind:'TRANSFER',createdAt:{gte:hour}}}),transfersLastDay:await db.transaction.count({where:{userId:req.actor!.id,kind:'TRANSFER',createdAt:{gte:day}}}),failedPaymentsLastHour:await db.paymentIntent.count({where:{userId:req.actor!.id,status:'FAILED',createdAt:{gte:hour}}}),beneficiariesLastHour:await db.beneficiary.count({where:{userId:req.actor!.id,createdAt:{gte:hour}}})});
 const transaction=await post({fromWalletId:body.fromWalletId,toWalletId:beneficiary!.walletId,amount:body.amount,currency:body.currency,kind:'TRANSFER',description:body.description,userId:req.actor!.id,key,scope:`transfer:${req.actor!.id}`,requestId:req.requestId,fingerprint:body.beneficiaryId});
 if(result.score>=30)await db.riskAlert.create({data:{userId:req.actor!.id,score:result.score,level:result.level,reasons:result.reasons}});
 res.status(201);send(res,{...transaction,risk:result});
});
customer.get('/transactions',async(req,res)=>{
 const p=page(req.query);const wallets=await db.wallet.findMany({where:{userId:req.actor!.id},select:{id:true}});const ids=wallets.map(w=>w.id);
 const search=z.string().max(100).optional().parse(req.query.search);const kind=z.enum(['TRANSFER','FUNDING','REFUND','REVERSAL']).optional().parse(req.query.kind);
 const status=z.enum(['POSTED','PENDING','FAILED']).optional().parse(req.query.status);const sort=z.enum(['asc','desc']).default('desc').parse(req.query.sort);
 const where:Prisma.TransactionWhereInput={OR:[{fromWalletId:{in:ids}},{toWalletId:{in:ids}}],...(search?{description:{contains:search,mode:'insensitive'}}:{}),...(kind?{kind}:{}),...(status?{status}:{})};
 send(res,await db.transaction.findMany({where,orderBy:{createdAt:sort},skip:p.skip,take:p.limit}),{page:p.page,limit:p.limit,total:await db.transaction.count({where})});
});
export async function ownTransaction(id:string,userId:string){const wallets=await db.wallet.findMany({where:{userId},select:{id:true}});const ids=wallets.map(w=>w.id);const t=await db.transaction.findFirst({where:{id,OR:[{fromWalletId:{in:ids}},{toWalletId:{in:ids}}]}});return t||fail(404,'NOT_FOUND','Transaction not found');}
customer.get('/transactions/:id',async(req,res)=>{const t=await ownTransaction(String(req.params.id),req.actor!.id);send(res,{...t,entries:await db.ledgerEntry.findMany({where:{transactionId:t.id}}),compensation:await db.refund.findUnique({where:{transactionId:t.id}})});});
customer.get('/holds',async(req,res)=>{const wallets=await db.wallet.findMany({where:{userId:req.actor!.id},select:{id:true}});send(res,await db.hold.findMany({where:{walletId:{in:wallets.map(w=>w.id)}},orderBy:{createdAt:'desc'},take:100}));});
customer.post('/holds',allow('CUSTOMER'),reauthenticated,async(req,res)=>{
 const body=z.object({walletId:z.string(),amount:money,reason:z.string().min(3).max(200)}).strict().parse(req.body);
 const result=await atomic(async c=>{await c.$queryRaw`SELECT id FROM "Wallet" WHERE id=${body.walletId} FOR UPDATE`;const wallet=await ownWallet(body.walletId,req.actor!.id,c);if(wallet.status!=='ACTIVE')fail(422,'WALLET_UNAVAILABLE','Wallet is frozen');if(new Decimal((await balance(body.walletId,c)).available).lt(body.amount))fail(422,'INSUFFICIENT_FUNDS','Insufficient available funds');const h=await c.hold.create({data:body});await audit(req.actor!.id,'hold.created',h.id,req.requestId,{},c);return h;});res.status(201);send(res,result);
});
customer.delete('/holds/:id',allow('CUSTOMER'),reauthenticated,async(req,res)=>{const hold=await db.hold.findUnique({where:{id:String(req.params.id)}});if(!hold)fail(404,'NOT_FOUND','Hold not found');await ownWallet(hold!.walletId,req.actor!.id);await db.hold.update({where:{id:hold!.id},data:{status:'RELEASED'}});await audit(req.actor!.id,'hold.released',hold!.id,req.requestId);send(res,{released:true});});
customer.get('/disputes',allow('CUSTOMER','SUPPORT'),async(req,res)=>{const p=page(req.query),where=req.actor!.role==='CUSTOMER'?{userId:req.actor!.id}:{};send(res,await db.dispute.findMany({where,orderBy:{createdAt:'desc'},skip:p.skip,take:p.limit}),{page:p.page,limit:p.limit,total:await db.dispute.count({where})});});
customer.post('/disputes',allow('CUSTOMER'),async(req,res)=>{const body=z.object({transactionId:z.string(),reason:z.string().trim().min(10).max(1000)}).strict().parse(req.body);await ownTransaction(body.transactionId,req.actor!.id);const d=await db.dispute.create({data:{...body,userId:req.actor!.id,history:[{status:'OPEN',actorId:req.actor!.id,at:new Date().toISOString()}]}});await audit(req.actor!.id,'dispute.created',d.id,req.requestId);res.status(201);send(res,d);});
customer.get('/refunds',async(req,res)=>{const wallets=await db.wallet.findMany({where:{userId:req.actor!.id},select:{id:true}});const ts=await db.transaction.findMany({where:{OR:[{fromWalletId:{in:wallets.map(w=>w.id)}},{toWalletId:{in:wallets.map(w=>w.id)}}]},select:{id:true}});send(res,await db.refund.findMany({where:{transactionId:{in:ts.map(t=>t.id)}},orderBy:{createdAt:'desc'},take:100}));});
