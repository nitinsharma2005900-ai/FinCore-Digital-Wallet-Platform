import 'dotenv/config';
import {writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const api=new URL(process.env.NEXT_PUBLIC_API_URL).origin;
const endpoints={web:process.env.WEB_ORIGIN,api:api+'/health',ready:api+'/ready',swagger:api+'/api-docs/',analytics:process.env.FASTAPI_SERVICE_URL+'/health',worker:'http://127.0.0.1:8081',mailpit:'http://127.0.0.1:8025/api/v1/info'};
const results={};for(const [service,url] of Object.entries(endpoints)){try{const r=await fetch(url,{signal:AbortSignal.timeout(5000)});results[service]={url,status:r.status,healthy:r.ok};}catch{results[service]={url,healthy:false};}}
const docker=spawnSync('docker',['info'],{encoding:'utf8',windowsHide:true});
writeFileSync('evidence/health.json',JSON.stringify({checkedAt:new Date().toISOString(),services:results,docker:{available:docker.status===0,reason:docker.error?'Docker executable not installed':docker.status===0?'Engine available':'Engine unavailable'}},null,2));
console.log(results);if(Object.values(results).some(r=>!r.healthy))process.exitCode=1;
