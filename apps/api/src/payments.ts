import { Router,Request,Response } from 'express';
import { z } from 'zod';
import Decimal from 'decimal.js';
import { money } from '../../../packages/shared/src';
import { db,fail,send,audit,AppError } from './core';
import { ownWallet,atomic,postInTransaction } from './ledger';
import { paymentProvider,verifyLocal,stripe,controlledProvider } from './providers';
import { config } from './config';
export const payments=Router();
export const eventSchema=z.object({id:z.string().min(1).max(200),providerId:z.string().min(1).max(200),type:z.enum(['payment.succeeded','payment.failed']),amount:money}).strict();
export type ProviderMessage=z.infer<typeof eventSchema>;
export async function processEvent(event:ProviderMessage,requestId='webhook'){
 return atomic(async c=>{
  await c.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`event:${event.id}`},0))::text`;
  const previous=await c.providerEvent.findUnique({where:{id:event.id}});
  const intent=await c.paymentIntent.findUnique({where:{providerId:event.providerId}});
  if(!intent) fail(404,'INTENT_NOT_FOUND','Payment intent not found');
  if(previous){if(previous.intentId!==intent!.id||previous.type!==event.type||!new Decimal(previous.amount.toString()).eq(event.amount))fail(409,'EVENT_CONFLICT','Provider event ID reused with different data');await audit(null,'webhook.duplicate',intent!.id,requestId,{eventId:event.id},c);return {duplicate:true,status:previous.status};}
  await c.$queryRaw`SELECT id FROM "PaymentIntent" WHERE id=${intent!.id} FOR UPDATE`;
  const current=await c.paymentIntent.findUniqueOrThrow({where:{id:intent!.id}});
  const mismatch=!new Decimal(current.amount.toString()).eq(event.amount);
  const ignored=current.status==='SUCCEEDED';
  await c.providerEvent.create({data:{id:event.id,intentId:current.id,type:event.type,amount:event.amount,status:mismatch?'AMOUNT_MISMATCH':ignored?'IGNORED':'PROCESSED'}});
  if(mismatch){await audit(null,'webhook.amount_mismatch',current.id,requestId,{},c);return {duplicate:false,status:'AMOUNT_MISMATCH'};}
  if(ignored)return {duplicate:false,status:'IGNORED'};
  if(event.type==='payment.failed'){
   await c.paymentIntent.update({where:{id:current.id},data:{status:'FAILED'}});
   await c.settlement.upsert({where:{intentId:current.id},create:{intentId:current.id,providerEventId:event.id,amount:current.amount,status:'FAILED'},update:{providerEventId:event.id,status:'FAILED'}});
   await audit(null,'payment.failed',current.id,requestId,{},c);
   return {duplicate:false,status:'FAILED'};
  }
  const treasury=await c.wallet.findFirstOrThrow({where:{type:'TREASURY'}});
  const transaction=await postInTransaction(c,{fromWalletId:treasury.id,toWalletId:current.walletId,amount:current.amount.toFixed(2),currency:current.currency,kind:'FUNDING',description:`${current.provider} simulated wallet funding`,userId:current.userId,key:current.id,scope:'funding',requestId});
  await c.paymentIntent.update({where:{id:current.id},data:{status:'SUCCEEDED',transactionId:transaction.id}});
  await c.settlement.upsert({where:{intentId:current.id},create:{intentId:current.id,providerEventId:event.id,amount:current.amount,status:'MATCHED'},update:{providerEventId:event.id,status:'MATCHED',amount:current.amount}});
  return {duplicate:false,status:'SUCCEEDED',transactionId:transaction.id};
 });
}
payments.get('/',async(req,res)=>send(res,await db.paymentIntent.findMany({where:{userId:req.actor!.id},orderBy:{createdAt:'desc'},take:100})));
payments.post('/',async(req,res)=>{
 const body=z.object({walletId:z.string().min(1),amount:money}).strict().parse(req.body);
 await ownWallet(body.walletId,req.actor!.id);
 const amount=new Decimal(body.amount).toFixed(2);
 if(new Decimal(amount).gt(10000000))fail(422,'INVALID_AMOUNT','Maximum simulated funding is INR 10,000,000');
 const key=z.string().min(8).max(128).parse(req.headers['idempotency-key']);
 // Provider and local IDs are deterministically tied to this user/request key. No network
 // operation is retried without the provider's own idempotency support.
 const id=createIntentId(req.actor!.id,key);
 const existing=await db.paymentIntent.findUnique({where:{id}});
 if(existing){if(existing.walletId!==body.walletId||!new Decimal(existing.amount.toString()).eq(amount))fail(409,'IDEMPOTENCY_CONFLICT','Funding key reused with a different payload');return send(res,existing);}
 const provider=await controlledProvider(()=>paymentProvider.create(amount,id));
 let intent;
 try{intent=await db.paymentIntent.create({data:{id,userId:req.actor!.id,walletId:body.walletId,amount,provider:paymentProvider.name,providerId:provider.id}});}
 catch(e){intent=await db.paymentIntent.findUnique({where:{id}});if(!intent)throw e;if(intent.walletId!==body.walletId||!new Decimal(intent.amount.toString()).eq(amount))fail(409,'IDEMPOTENCY_CONFLICT','Funding key reused with a different payload');}
 await audit(req.actor!.id,'payment.intent_created',intent!.id,req.requestId,{provider:paymentProvider.name});
 res.status(201);send(res,{...intent,clientSecret:provider.clientSecret});
});
import { sha } from './core';
const createIntentId=(userId:string,key:string)=>'pi_'+sha(`${userId}:${key}`).slice(0,40);
payments.post('/:id/confirm',async(req,res)=>{
 const body=z.object({outcome:z.enum(['success','failed']).default('success')}).strict().parse(req.body);
 const intent=await db.paymentIntent.findFirst({where:{id:String(req.params.id),userId:req.actor!.id}});
 if(!intent)fail(404,'NOT_FOUND','Payment intent not found');
 if(intent!.provider!=='local')fail(409,'STRIPE_CONFIRMATION_REQUIRED','Use Stripe.js with a test payment method; signed Stripe webhooks settle the wallet');
 send(res,await processEvent({id:`local_${intent!.id}_${body.outcome}`,providerId:intent!.providerId,type:body.outcome==='success'?'payment.succeeded':'payment.failed',amount:intent!.amount.toFixed(2)},req.requestId));
});
export async function webhook(req:Request,res:Response){
 if(!Buffer.isBuffer(req.body)) throw new AppError(400,'INVALID_WEBHOOK','Expected raw JSON body');
 let event:ProviderMessage;
 if(config.PAYMENT_PROVIDER==='stripe'){
  let verified;
  try{verified=stripe!.webhooks.constructEvent(req.body,req.headers['stripe-signature'] as string,process.env.STRIPE_WEBHOOK_SECRET!);}catch{fail(400,'INVALID_SIGNATURE','Invalid Stripe webhook signature');}
  if(!['payment_intent.succeeded','payment_intent.payment_failed'].includes(verified!.type))return send(res,{ignored:true});
  const intent=verified!.data.object as {id:string;amount:number;livemode:boolean};
  if(intent.livemode)fail(400,'LIVE_MODE_REJECTED','Live money is prohibited');
  event={id:verified!.id,providerId:intent.id,type:verified!.type==='payment_intent.succeeded'?'payment.succeeded':'payment.failed',amount:new Decimal(intent.amount).div(100).toFixed(2)};
 }else{
  verifyLocal(req.body.toString('utf8'),String(req.headers['x-fincore-signature']||''));
  try{event=eventSchema.parse(JSON.parse(req.body.toString('utf8')));}catch{fail(400,'INVALID_WEBHOOK','Malformed payment event');}
 }
 send(res,await processEvent(event!,req.requestId));
}
