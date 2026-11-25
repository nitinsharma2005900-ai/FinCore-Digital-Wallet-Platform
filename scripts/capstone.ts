import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {db} from '../apps/api/src/core';
import {post,balance,ledgerIntegrity,atomic,postInTransaction} from '../apps/api/src/ledger';
import {processEvent} from '../apps/api/src/payments';
import {analytics} from '../apps/api/src/analytics';
async function main(){
 const timeline:any[]=[];const mark=(incident:string,data:unknown)=>timeline.push({at:new Date().toISOString(),incident,data});
 const user=await db.user.create({data:{email:randomUUID()+'@capstone.test',name:'Synthetic Capstone',passwordHash:'no-login-credential'}});
 const source=await db.wallet.create({data:{userId:user.id,name:'Capstone source'}}),target=await db.wallet.create({data:{userId:user.id,name:'Capstone recipient'}}),treasury=await db.wallet.findFirstOrThrow({where:{type:'TREASURY'}});
 await post({fromWalletId:treasury.id,toWalletId:source.id,amount:'100.00',currency:'INR',kind:'FUNDING',description:'Capstone synthetic funds',userId:user.id,key:randomUUID(),scope:'capstone'});
 const before=await balance(source.id);
 const input={fromWalletId:source.id,toWalletId:target.id,amount:'80.00',currency:'INR',kind:'TRANSFER' as const,description:'Concurrent spend',userId:user.id,scope:'capstone'};
 const concurrent=await Promise.allSettled([post({...input,key:randomUUID()}),post({...input,key:randomUUID()})]);
 if(concurrent.filter(r=>r.status==='fulfilled').length!==1)throw Error('Concurrency invariant failed');
 const success=concurrent.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<any>;
 mark('concurrent-transfers',{fulfilled:1,rejected:1,source:await balance(source.id),recipient:await balance(target.id)});
 const intent=await db.paymentIntent.create({data:{userId:user.id,walletId:source.id,amount:'25.00',provider:'local',providerId:'local_capstone_'+randomUUID()}});
 const event={id:randomUUID(),providerId:intent.providerId,type:'payment.succeeded' as const,amount:'25.00'};
 await processEvent(event);const duplicate=await processEvent(event);if(!duplicate.duplicate)throw Error('Duplicate not detected');
 await processEvent({id:randomUUID(),providerId:intent.providerId,type:'payment.failed',amount:'25.00'});
 if((await db.paymentIntent.findUniqueOrThrow({where:{id:intent.id}})).status!=='SUCCEEDED')throw Error('Out-of-order event changed success');
 mark('duplicate-payment-events',{duplicate:true,outOfOrderIgnored:true,source:await balance(source.id)});
 const failed=await db.paymentIntent.create({data:{userId:user.id,walletId:source.id,amount:'30.00',provider:'local',providerId:'local_failed_'+randomUUID()}});
 await processEvent({id:randomUUID(),providerId:failed.providerId,type:'payment.failed',amount:'30.00'});
 if((await db.paymentIntent.findUniqueOrThrow({where:{id:failed.id}})).transactionId)throw Error('Failed settlement credited wallet');
 mark('failed-settlement',{credited:false});
 const mismatch=await db.paymentIntent.create({data:{userId:user.id,walletId:source.id,amount:'20.00',provider:'local',providerId:'local_mismatch_'+randomUUID()}});
 const mismatchResult=await processEvent({id:randomUUID(),providerId:mismatch.providerId,type:'payment.succeeded',amount:'19.00'});if(mismatchResult.status!=='AMOUNT_MISMATCH')throw Error('Mismatch accepted');mark('mismatched-provider-settlement',mismatchResult);
 const reversed=await atomic(c=>postInTransaction(c,{fromWalletId:target.id,toWalletId:source.id,amount:'80.00',currency:'INR',kind:'REVERSAL',description:'Capstone controlled reversal',userId:user.id,originalId:success.value.id,key:randomUUID(),scope:'capstone'}));
 mark('financial-reversal',{original:success.value.id,compensation:reversed.id});
 const count=await db.transaction.count();let unbalancedRejected=false;
 try{await atomic(async c=>{const t=await c.transaction.create({data:{userId:user.id,fromWalletId:source.id,toWalletId:target.id,amount:'1.00',kind:'TRANSFER',description:'Deliberately unbalanced incident'}});await c.ledgerEntry.create({data:{transactionId:t.id,walletId:source.id,direction:'DEBIT',amount:'1.00'}});await c.transaction.update({where:{id:t.id},data:{status:'POSTED'}});});}catch{unbalancedRejected=true;}
 if(!unbalancedRejected||await db.transaction.count()!==count)throw Error('Unbalanced operation did not roll back');mark('unbalanced-journal',{rejected:true,rolledBack:true});
 const originalUrl=process.env.FASTAPI_SERVICE_URL;
 const {config}=await import('../apps/api/src/config');const url=config.FASTAPI_SERVICE_URL;config.FASTAPI_SERVICE_URL='http://127.0.0.1:1';let outageRejected=false;try{await analytics('/risk',{amount:'1.00'});}catch{outageRejected=true;}finally{config.FASTAPI_SERVICE_URL=url;process.env.FASTAPI_SERVICE_URL=originalUrl;}
 if(!outageRejected)throw Error('Dependency failure not handled');mark('dependency-timeout',{safeFailure:true,recovered:await analytics('/fees',{amount:'1.00',rate:'0'})});
 const risk=await analytics('/risk',{amount:'150000',transfersLastHour:10,failedPaymentsLastHour:5,beneficiariesLastHour:4,transfersLastDay:25});
 await db.riskAlert.create({data:{userId:user.id,score:risk.score,level:risk.level,reasons:risk.reasons}});mark('suspicious-activity',risk);
 let immutable=false;const entry=await db.ledgerEntry.findFirstOrThrow({where:{walletId:source.id}});try{await db.ledgerEntry.update({where:{id:entry.id},data:{amount:'999'}});}catch{immutable=true;}if(!immutable)throw Error('Journal mutation allowed');
 const integrity=await ledgerIntegrity();if(!integrity.balanced)throw Error('Ledger is unbalanced');const after=await balance(source.id);if(after.available!=='125.00')throw Error('Unexpected final source balance');
 writeFileSync('evidence/capstone.json',JSON.stringify({before,after,recipient:await balance(target.id),integrity,immutable,timeline},null,2));console.log('Capstone and five incident categories verified');
}
main().finally(()=>db.$disconnect()).catch(e=>{console.error(e.message);process.exitCode=1;});
