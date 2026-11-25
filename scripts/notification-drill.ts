import 'dotenv/config';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {db} from '../apps/api/src/core';
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const user=await db.user.findUniqueOrThrow({where:{email:'customer@fincore.test'}});
 const pid=Number(readFileSync('.runtime/mailpit.pid','utf8'));if(!Number.isInteger(pid)||pid<=0)throw Error('Invalid owned Mailpit process');
 const before=await (await fetch('http://127.0.0.1:8025/api/v1/info')).json() as any;
 process.kill(pid);
 const n=await db.notification.create({data:{userId:user.id,title:'Controlled notification retry drill',message:'Synthetic recovery demonstration'}});
 let attempts=0;let restarted=false;
 const restart=()=>{const child=spawn(resolve('.tools/mailpit/mailpit.exe'),['--listen','127.0.0.1:8025','--smtp','127.0.0.1:1025','--database',resolve('.runtime/mailpit.db')],{detached:true,stdio:'ignore',windowsHide:true});child.unref();writeFileSync('.runtime/mailpit.pid',String(child.pid));restarted=true;};
 try{for(let i=0;i<15;i++){const current=await db.notification.findUniqueOrThrow({where:{id:n.id}});attempts=current.attempts;if(attempts>=2)break;await pause(1000);}restart();
 let current=await db.notification.findUniqueOrThrow({where:{id:n.id}});for(let i=0;i<30&&current.deliveryStatus!=='SENT';i++){await pause(1000);current=await db.notification.findUniqueOrThrow({where:{id:n.id}});}
 if(attempts<2||current.deliveryStatus!=='SENT')throw Error('Notification retry recovery not verified');
 const after=await (await fetch('http://127.0.0.1:8025/api/v1/info')).json() as any;
 writeFileSync('evidence/notification-recovery.json',JSON.stringify({notificationId:n.id,failedAttempts:attempts,finalAttempts:current.attempts,status:current.deliveryStatus,emailCaptured:after.Messages>before.Messages,provider:'Mailpit local SMTP',scope:'Controlled local SMTP outage; BullMQ retries and outbox recovery'},null,2));console.log('Notification outage and recovery verified');
 }finally{if(!restarted)restart();}
}
main().finally(()=>db.$disconnect()).catch(e=>{console.error(e.message);process.exitCode=1;});
