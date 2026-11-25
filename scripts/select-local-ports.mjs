import {readFileSync,writeFileSync} from 'node:fs';
let env=readFileSync('.env','utf8').replace('FASTAPI_SERVICE_URL=http://127.0.0.1:8000','FASTAPI_SERVICE_URL=http://127.0.0.1:8001').replace('NEXT_PUBLIC_API_URL=http://127.0.0.1:4000','NEXT_PUBLIC_API_URL=http://127.0.0.1:4001');
if(!/^PORT=/m.test(env))env+='\nPORT=4001\n';else env=env.replace(/^PORT=.*$/m,'PORT=4001');
writeFileSync('.env',env);
const p=JSON.parse(readFileSync('package.json','utf8'));p.overrides={...(p.overrides||{}),effect:'3.22.5','deepmerge-ts':'8.0.2'};writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');
