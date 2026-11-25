import {readFileSync,writeFileSync} from 'node:fs';
const path='scripts/start-local.mjs';let text=readFileSync(path,'utf8');text=text.replace("'dev','apps/web','--hostname','127.0.0.1'","'dev','apps/web','--hostname','127.0.0.1','--port','3000'");writeFileSync(path,text);
