import 'dotenv/config';
import {writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const api=new URL(process.env.NEXT_PUBLIC_API_URL).origin;
const endpoints={web:process.env.WEB_ORIGIN,api:api+'/health',ready:api+'/ready',swagger:api+'/api-docs/',analytics:process.env.FASTAPI_SERVICE_URL+'/health',worker:'http://127.0.0.1:8081',mailpit:'http://127.0.0.1:8025/api/v1/info'};
const results={};for(const [service,url] of Object.entries(endpoints)){const started=Date.now();try{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});results[service]={url,status:r.status,healthy:r.ok,elapsedMs:Date.now()-started};}catch(error){results[service]={url,healthy:false,errorType:error.name,elapsedMs:Date.now()-started};}}
let docker=spawnSync('docker',['info'],{encoding:'utf8',windowsHide:true,timeout:30000});let transport='native';
if(docker.error&&process.platform==='win32'){transport='WSL Ubuntu';docker=spawnSync('wsl',['-d','Ubuntu','-u','root','--','docker','info'],{encoding:'utf8',windowsHide:true,timeout:30000});}
writeFileSync('evidence/health.json',JSON.stringify({checkedAt:new Date().toISOString(),services:results,docker:{available:docker.status===0,transport,reason:docker.status===0?'Engine available':'Engine unavailable'}},null,2));
console.log(results);if(Object.values(results).some(r=>!r.healthy))process.exitCode=1;
