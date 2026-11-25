from pathlib import Path
p=Path('apps/api/src/staff.ts')
s=p.read_text()
s=s.replace("if(intent?.provider==='stripe')fail(409,'EXTERNAL_REFUND_NOT_IMPLEMENTED','Stripe refund orchestration is not yet implemented; no ledger changes were made');", """if(intent?.provider==='stripe'){
 if(body.kind!=='REFUND')fail(422,'USE_REFUND','Use an external refund for Stripe funding');
 const existing=await c.externalRefund.findUnique({where:{transactionId:original.id}});
 if(existing){if(existing.reason!==body.reason)fail(409,'IDEMPOTENCY_CONFLICT','Refund reason differs from the original request');return existing;}
 await c.$queryRaw`SELECT id FROM "Wallet" WHERE id=${original.toWalletId} FOR UPDATE`;
 if(new Decimal((await balance(original.toWalletId,c)).available).lt(original.amount.toString()))fail(422,'INSUFFICIENT_FUNDS','Insufficient available funds for refund');
 const hold=await c.hold.create({data:{walletId:original.toWalletId,amount:original.amount,reason:'External refund reserve'}});
 const request=await c.externalRefund.create({data:{transactionId:original.id,holdId:hold.id,actorId:req.actor!.id,reason:body.reason}});
 await audit(req.actor!.id,'refund.queued',request.id,req.requestId,{},c);return request;
 }""")
s=s.replace('if(previous)return previous;',"if(previous){if(previous.kind!==body.kind||previous.reason!==body.reason)fail(409,'IDEMPOTENCY_CONFLICT','Compensation already exists with different details');return previous;}")
s+='''
staff.get('/admin/settings',allow('ADMIN'),async(_req,res)=>send(res,await db.setting.findMany()));
staff.put('/admin/settings/:key',allow('ADMIN'),reauthenticated,async(req,res)=>{const key=z.enum(['maintenanceBanner','supportEmail']).parse(req.params.key);const body=z.object({value:z.string().max(200)}).strict().parse(req.body);if(key==='supportEmail')z.email().parse(body.value);const result=await db.setting.upsert({where:{key},create:{key,value:body.value},update:{value:body.value}});await audit(req.actor!.id,'setting.updated',key,req.requestId);send(res,result);});
staff.post('/admin/jobs/retry',allow('ADMIN'),reauthenticated,async(req,res)=>{
 const body=z.object({id:z.string(),type:z.enum(['notification','refund'])}).strict().parse(req.body);
 const {Queue}=await import('bullmq');const redis=new URL(process.env.REDIS_URL!);const queue=new Queue('fincore-delivery',{connection:{host:redis.hostname,port:Number(redis.port||6379),password:redis.password||undefined}});
 try{const job=await queue.getJob(body.type+'-'+body.id);if(job&&await job.getState()==='failed')await job.remove();
 if(body.type==='notification')await db.notification.update({where:{id:body.id},data:{deliveryStatus:'PENDING'}});else await db.externalRefund.update({where:{id:body.id},data:{status:'PENDING'}});
 await audit(req.actor!.id,'job.retried',body.id,req.requestId,{type:body.type});send(res,{queued:true});}finally{await queue.close();}
});
'''
p.write_text(s)
