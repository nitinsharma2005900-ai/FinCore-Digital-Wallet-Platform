import {Queue,Worker} from 'bullmq';
import nodemailer from 'nodemailer';
import {db,log,audit} from '../../api/src/core';
import {config} from '../../api/src/config';
import {paymentProvider} from '../../api/src/providers';
import {atomic,postInTransaction} from '../../api/src/ledger';
import {createServer} from 'node:http';
const redis=new URL(config.REDIS_URL);
const connection={host:redis.hostname,port:Number(redis.port||6379),password:redis.password||undefined};
export const queue=new Queue('fincore-delivery',{connection});
const smtp=nodemailer.createTransport({host:process.env.SMTP_HOST||'127.0.0.1',port:Number(process.env.SMTP_PORT||1025),secure:process.env.SMTP_SECURE==='true',...(process.env.SMTP_USER?{auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}}:{}),connectionTimeout:5000,socketTimeout:5000});
export async function deliverNotification(id:string){
 const n=await db.notification.findUniqueOrThrow({where:{id}});if(n.deliveryStatus==='SENT')return;
 const user=await db.user.findUniqueOrThrow({where:{id:n.userId}});
 await db.notification.update({where:{id},data:{attempts:{increment:1},deliveryStatus:'PROCESSING'}});
 await smtp.sendMail({from:'FinCore Simulation <no-reply@fincore.test>',to:user.email,subject:n.title,text:`Simulation Only - No Real Money\n\n${n.message}`,messageId:`<${n.id}@fincore.test>`});
 // Twilio's magic test number validates sandbox API behavior; it does not send SMS.
 if(config.SMS_PROVIDER==='twilio'&&user.phone){
  if(process.env.TWILIO_TEST_MODE!=='true')throw Error('Only explicitly configured Twilio test credentials are accepted');
  const sid=process.env.TWILIO_ACCOUNT_SID!;const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,{method:'POST',headers:{Authorization:'Basic '+Buffer.from(sid+':'+process.env.TWILIO_AUTH_TOKEN).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({From:'+15005550006',To:'+15005550006',Body:'FinCore synthetic notification'}),signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('Twilio test request failed');
 }
 await db.notification.update({where:{id},data:{deliveryStatus:'SENT'}});
 await audit(null,'notification.delivered',id,'worker',{emailProvider:process.env.EMAIL_PROVIDER||'mailpit',smsProvider:config.SMS_PROVIDER});
}
export async function deliverRefund(id:string){
 const request=await db.externalRefund.findUniqueOrThrow({where:{id}});if(request.status==='COMPLETED')return;
 await db.externalRefund.update({where:{id},data:{attempts:{increment:1}}});
 const intent=await db.paymentIntent.findUniqueOrThrow({where:{transactionId:request.transactionId}});
 const providerId=await paymentProvider.refund(intent.providerId,'refund-'+request.id);
 await atomic(async c=>{
  await c.$queryRaw`SELECT id FROM "ExternalRefund" WHERE id=${id} FOR UPDATE`;
  const current=await c.externalRefund.findUniqueOrThrow({where:{id}});if(current.status==='COMPLETED')return;
  const original=await c.transaction.findUniqueOrThrow({where:{id:request.transactionId}});
  await c.hold.update({where:{id:request.holdId},data:{status:'RELEASED'}});
  const tx=await postInTransaction(c,{fromWalletId:original.toWalletId,toWalletId:original.fromWalletId,amount:original.amount.toFixed(2),currency:original.currency,kind:'REFUND',description:request.reason,userId:request.actorId,originalId:original.id,key:request.id,scope:'external-refund',requestId:'worker'});
  await c.refund.create({data:{transactionId:original.id,compensationId:tx.id,kind:'REFUND',reason:request.reason,providerId}});
  await c.externalRefund.update({where:{id},data:{status:'COMPLETED',providerId,compensationId:tx.id}});
 });
}
const worker=new Worker('fincore-delivery',async job=>job.name==='refund'?deliverRefund(job.data.id):deliverNotification(job.data.id),{connection,concurrency:3});
worker.on('failed',(job)=>{if(!job)return;log.warn({jobId:job.id,attempts:job.attemptsMade},'Delivery attempt failed');if(job.attemptsMade>=5){void (job.name==='refund'?db.externalRefund.update({where:{id:job.data.id},data:{status:'FAILED'}}):db.notification.update({where:{id:job.data.id},data:{deliveryStatus:'FAILED'}})).catch(()=>{});}});
let scanning=false;
async function scan(){if(scanning)return;scanning=true;try{
 const notifications=await db.notification.findMany({where:{deliveryStatus:{in:['PENDING','PROCESSING']}},take:100});
 for(const n of notifications)await queue.add('notification',{id:n.id},{jobId:'notification-'+n.id,attempts:5,backoff:{type:'exponential',delay:1000},removeOnComplete:500});
 for(const r of await db.externalRefund.findMany({where:{status:'PENDING'},take:100}))await queue.add('refund',{id:r.id},{jobId:'refund-'+r.id,attempts:5,backoff:{type:'exponential',delay:1000},removeOnComplete:500});
 }catch{log.warn('Notification outbox scan temporarily unavailable');}finally{scanning=false;}}
const timer=setInterval(()=>void scan(),3000);void scan();log.info('BullMQ worker started');
const health=createServer((_req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({service:'fincore-worker',status:'ok'}));}).listen(Number(process.env.WORKER_HEALTH_PORT||8081),process.env.HOST||'127.0.0.1');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(timer);health.close();void worker.close().then(()=>queue.close()).then(()=>db.$disconnect()).then(()=>process.exit(0));});
