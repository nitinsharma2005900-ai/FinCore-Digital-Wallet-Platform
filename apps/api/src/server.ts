import {app} from './app';
import {db,log} from './core';
const server=app.listen(Number(process.env.PORT||4000),process.env.HOST||'127.0.0.1',()=>log.info({port:Number(process.env.PORT||4000)},'FinCore API listening'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{void db.$disconnect().then(()=>process.exit(0));}));
