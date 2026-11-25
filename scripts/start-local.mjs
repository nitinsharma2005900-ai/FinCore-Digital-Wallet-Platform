import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,openSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')&&!x.startsWith('#')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
mkdirSync('.runtime',{recursive:true});
const services=[['analytics',resolve('.venv/Scripts/python.exe'),['-m','uvicorn','app:app','--app-dir','services/financial-analytics','--host','127.0.0.1','--port','8000']],['api',process.execPath,['--import','tsx','apps/api/src/server.ts']],['web',process.execPath,['apps/web/node_modules/next/dist/bin/next','dev','apps/web','--hostname','127.0.0.1']]];
for(const [name,exe,args] of services){const health={analytics:'http://127.0.0.1:8000/health',api:'http://127.0.0.1:4000/health',web:'http://127.0.0.1:3000'}[name];try{const response=await fetch(health,{signal:AbortSignal.timeout(2000)});if(response.ok){console.log('Already running',name);continue;}}catch{/* Start an unavailable local service. */}const output=openSync('.runtime/'+name+'.log','a');const child=spawn(exe,args,{env:{...process.env,...env},detached:true,windowsHide:true,stdio:['ignore',output,output]});child.unref();writeFileSync('.runtime/'+name+'.pid',String(child.pid));console.log('Started',name,child.pid);}
