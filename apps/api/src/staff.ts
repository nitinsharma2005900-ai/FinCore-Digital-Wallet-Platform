import {Router} from 'express';
import {z} from 'zod';
import {db,send,fail,audit} from './core';
import {allow,reauthenticated} from './auth';
import {atomic,postInTransaction,ledgerIntegrity,balance} from './ledger';
import Decimal from 'decimal.js';
import {analytics} from './analytics';
export const staff=Router();
staff.get('/risk-alerts',allow('OPERATIONS'),async(_req,res)=>send(res,await db.riskAlert.findMany({orderBy:{createdAt:'desc'},take:100})));
staff.patch('/risk-alerts/:id',allow('OPERATIONS'),async(req,res)=>{const body=z.object({resolution:z.string().min(10).max(1000)}).strict().parse(req.body);const alert=await db.riskAlert.update({where:{id:String(req.params.id)},data:{status:'RESOLVED',resolution:body.resolution}});await audit(req.actor!.id,'risk.resolved',alert.id,req.requestId);send(res,alert);});
staff.patch('/disputes/:id',allow('SUPPORT'),async(req,res)=>{
 const body=z.object({status:z.enum(['INVESTIGATING','RESOLVED','REJECTED']),resolution:z.string().min(10).max(1000)}).strict().parse(req.body);
 const result=await atomic(async c=>{await c.$queryRaw`SELECT id FROM "Dispute" WHERE id=${String(req.params.id)} FOR UPDATE`;const d=await c.dispute.findUniqueOrThrow({where:{id:String(req.params.id)}});if(['RESOLVED','REJECTED'].includes(d.status))fail(409,'INVALID_STATE','Dispute is already closed');const history=Array.isArray(d.history)?d.history:[];const updated=await c.dispute.update({where:{id:d.id},data:{...body,assignedTo:req.actor!.id,history:[...history,{status:body.status,actorId:req.actor!.id,at:new Date().toISOString(),resolution:body.resolution}]}});await audit(req.actor!.id,'dispute.updated',d.id,req.requestId,{},c);return updated;});send(res,result);
});
staff.get('/reconciliation',allow('OPERATIONS'),async(_req,res)=>send(res,await db.reconciliation.findMany({orderBy:{createdAt:'desc'},take:100})));
staff.post('/reconciliation/run',allow('OPERATIONS'),async(req,res)=>{
 const intents=await db.paymentIntent.findMany({take:1000,orderBy:{createdAt:'desc'}});const results=[];
 for(const intent of intents){const events=await db.providerEvent.findMany({where:{intentId:intent.id},orderBy:{createdAt:'desc'}});const settlement=await db.settlement.findUnique({where:{intentId:intent.id}});const result=await analytics('/reconcile',{expected:intent.amount.toFixed(2),observed:settlement?.amount.toFixed(2)||null,failed:settlement?.status==='FAILED',duplicateCount:await db.audit.count({where:{action:'webhook.duplicate',resourceId:intent.id}})});if(events.some(e=>e.status==='AMOUNT_MISMATCH'))result.status='AMOUNT_MISMATCH';results.push(await db.reconciliation.upsert({where:{intentId:intent.id},create:{intentId:intent.id,status:result.status,details:JSON.stringify(result)},update:{status:result.status,details:JSON.stringify(result)}}));}
 await audit(req.actor!.id,'reconciliation.run',null,req.requestId,{count:results.length});send(res,results);
});
staff.patch('/reconciliation/:id',allow('OPERATIONS'),async(req,res)=>{const b=z.object({resolution:z.string().min(10).max(1000)}).strict().parse(req.body);const result=await db.reconciliation.update({where:{id:String(req.params.id)},data:{resolvedBy:req.actor!.id,resolution:b.resolution}});await audit(req.actor!.id,'reconciliation.investigated',result.id,req.requestId);send(res,result);});
staff.get('/finance',allow('FINANCE'),async(_req,res)=>send(res,{integrity:await ledgerIntegrity(),refunds:await db.refund.findMany({take:100,orderBy:{createdAt:'desc'}}),externalRefunds:await db.externalRefund.findMany({take:100,orderBy:{createdAt:'desc'}}),settlements:await db.settlement.findMany({take:100,orderBy:{createdAt:'desc'}})}));
staff.post('/finance/compensations',allow('FINANCE'),reauthenticated,async(req,res)=>{
 const body=z.object({transactionId:z.string(),kind:z.enum(['REFUND','REVERSAL']),reason:z.string().min(10).max(200)}).strict().parse(req.body);const key=z.string().min(8).max(128).parse(req.headers['idempotency-key']);
 send(res,await atomic(async c=>{await c.$queryRaw`SELECT id FROM "Transaction" WHERE id=${body.transactionId} FOR UPDATE`;const original=await c.transaction.findUniqueOrThrow({where:{id:body.transactionId}});if(original.status!=='POSTED'||!['TRANSFER','FUNDING'].includes(original.kind))fail(409,'INVALID_STATE','Only posted transfers and funding can be compensated');const intent=await c.paymentIntent.findUnique({where:{transactionId:original.id}});if(intent?.provider==='stripe'){
 if(body.kind!=='REFUND')fail(422,'USE_REFUND','Use an external refund for Stripe funding');
 const existing=await c.externalRefund.findUnique({where:{transactionId:original.id}});
 if(existing){if(existing.reason!==body.reason)fail(409,'IDEMPOTENCY_CONFLICT','Refund reason differs from the original request');return existing;}
 await c.$queryRaw`SELECT id FROM "Wallet" WHERE id=${original.toWalletId} FOR UPDATE`;
 if(new Decimal((await balance(original.toWalletId,c)).available).lt(original.amount.toString()))fail(422,'INSUFFICIENT_FUNDS','Insufficient available funds for refund');
 const hold=await c.hold.create({data:{walletId:original.toWalletId,amount:original.amount,reason:'External refund reserve'}});
 const request=await c.externalRefund.create({data:{transactionId:original.id,holdId:hold.id,actorId:req.actor!.id,reason:body.reason}});
 await audit(req.actor!.id,'refund.queued',request.id,req.requestId,{},c);return request;
 }const previous=await c.refund.findUnique({where:{transactionId:original.id}});if(previous){if(previous.kind!==body.kind||previous.reason!==body.reason)fail(409,'IDEMPOTENCY_CONFLICT','Compensation already exists with different details');return previous;}const tx=await postInTransaction(c,{fromWalletId:original.toWalletId,toWalletId:original.fromWalletId,amount:original.amount.toFixed(2),currency:original.currency,kind:body.kind,description:body.reason,userId:req.actor!.id,originalId:original.id,key,scope:'compensation',requestId:req.requestId});return c.refund.create({data:{transactionId:original.id,compensationId:tx.id,kind:body.kind,reason:body.reason}});}));
});
staff.get('/admin/users',allow('ADMIN'),async(_req,res)=>send(res,await db.user.findMany({select:{id:true,name:true,email:true,role:true,disabled:true},take:100})));
staff.patch('/admin/users/:id',allow('ADMIN'),reauthenticated,async(req,res)=>{const b=z.object({role:z.enum(['CUSTOMER','SUPPORT','OPERATIONS','FINANCE','ADMIN']).optional(),disabled:z.boolean().optional()}).strict().parse(req.body);if(String(req.params.id)===req.actor!.id)fail(409,'SELF_CHANGE','An administrator cannot change their own access');const u=await db.user.update({where:{id:String(req.params.id)},data:b});await db.session.updateMany({where:{userId:u.id},data:{revokedAt:new Date()}});await audit(req.actor!.id,'admin.user_updated',u.id,req.requestId,b);send(res,{id:u.id,role:u.role,disabled:u.disabled});});
staff.get('/audit',allow('ADMIN'),async(_req,res)=>send(res,await db.audit.findMany({take:100,orderBy:{createdAt:'desc'}})));
staff.get('/system',allow('ADMIN'),async(_req,res)=>send(res,{integrity:await ledgerIntegrity(),uptimeSeconds:process.uptime(),memoryBytes:process.memoryUsage().rss}));

staff.get('/admin/settings',allow('ADMIN'),async(_req,res)=>send(res,await db.setting.findMany()));
staff.put('/admin/settings/:key',allow('ADMIN'),reauthenticated,async(req,res)=>{const key=z.enum(['maintenanceBanner','supportEmail']).parse(req.params.key);const body=z.object({value:z.string().max(200)}).strict().parse(req.body);if(key==='supportEmail')z.email().parse(body.value);const result=await db.setting.upsert({where:{key},create:{key,value:body.value},update:{value:body.value}});await audit(req.actor!.id,'setting.updated',key,req.requestId);send(res,result);});
staff.post('/admin/jobs/retry',allow('ADMIN'),reauthenticated,async(req,res)=>{
 const body=z.object({id:z.string(),type:z.enum(['notification','refund'])}).strict().parse(req.body);
 const {Queue}=await import('bullmq');const redis=new URL(process.env.REDIS_URL!);const queue=new Queue('fincore-delivery',{connection:{host:redis.hostname,port:Number(redis.port||6379),password:redis.password||undefined}});
 try{const job=await queue.getJob(body.type+'-'+body.id);if(job&&await job.getState()==='failed')await job.remove();
 if(body.type==='notification')await db.notification.update({where:{id:body.id},data:{deliveryStatus:'PENDING'}});else await db.externalRefund.update({where:{id:body.id},data:{status:'PENDING'}});
 await audit(req.actor!.id,'job.retried',body.id,req.requestId,{type:body.type});send(res,{queued:true});}finally{await queue.close();}
});
