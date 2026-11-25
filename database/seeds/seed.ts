import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {db} from '../../apps/api/src/core';
import {post} from '../../apps/api/src/ledger';
import {mkdirSync,writeFileSync} from 'node:fs';
async function main(){
 if(process.env.NODE_ENV==='production'||process.env.SEED_DEMO!=='true')throw Error('Demo seed permitted only in explicitly enabled local environments');
 const password=process.env.DEMO_PASSWORD;if(!password)throw Error('Missing DEMO_PASSWORD');
 const hash=await bcrypt.hash(password,12);
 const treasury=await db.wallet.upsert({where:{id:'treasury'},create:{id:'treasury',name:'Simulation treasury',type:'TREASURY'},update:{}});
 for(const [role,email,name] of [['CUSTOMER','customer@fincore.test','Aarav Sharma'],['CUSTOMER','recipient@fincore.test','Meera Kapoor'],['SUPPORT','support@fincore.test','Support Agent'],['OPERATIONS','operations@fincore.test','Operations Analyst'],['FINANCE','finance@fincore.test','Finance Administrator'],['ADMIN','admin@fincore.test','Platform Administrator']]){
  const user=await db.user.upsert({where:{email},create:{email,name,role,passwordHash:hash},update:{}});
  if(role==='CUSTOMER'){
   let wallet=await db.wallet.findFirst({where:{userId:user.id}});if(!wallet)wallet=await db.wallet.create({data:{userId:user.id,name:'Everyday wallet'}});
   await db.account.upsert({where:{reference:'FC-DEMO-'+user.id},create:{reference:'FC-DEMO-'+user.id,label:'Personal account',userId:user.id},update:{}});
   await post({fromWalletId:treasury.id,toWalletId:wallet.id,amount:'25000.00',currency:'INR',kind:'FUNDING',description:'Synthetic opening funds',userId:user.id,key:user.id,scope:'seed'});
  }
 }
 mkdirSync('.runtime',{recursive:true});writeFileSync('.runtime/demo-credentials.json',JSON.stringify({password,emails:['customer','recipient','support','operations','finance','admin'].map(x=>x+'@fincore.test')},null,2));
 console.log('Synthetic accounts seeded. Credentials: .runtime/demo-credentials.json');
}
main().finally(()=>db.$disconnect()).catch(e=>{console.error(e.message);process.exitCode=1;});
