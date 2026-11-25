const urls=['http://127.0.0.1:3000','http://127.0.0.1:4000/health','http://127.0.0.1:8000/health'];
for(const url of urls){let ready=false;for(let attempt=0;attempt<60;attempt++){try{ready=(await fetch(url,{signal:AbortSignal.timeout(1000)})).ok;}catch{/* Wait for service startup. */}if(ready)break;await new Promise(r=>setTimeout(r,1000));}if(!ready)throw Error('Service not ready: '+url);}
import {setTimeout} from 'node:timers';
