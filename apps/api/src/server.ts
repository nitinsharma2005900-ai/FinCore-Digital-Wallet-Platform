import {app} from './app';
import {db,log} from './core';
const server=app.listen(4000,'127.0.0.1',()=>log.info({port:4000},'FinCore API listening'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{void db.$disconnect().then(()=>process.exit(0));}));
