import {existsSync,mkdirSync,readFileSync,writeFileSync,unlinkSync,readdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {resolve,join} from 'node:path';
import {spawnSync,spawn} from 'node:child_process';
const root=resolve('.');mkdirSync('.runtime',{recursive:true});mkdirSync('evidence',{recursive:true});
if(!existsSync('.env')){
 const owner=randomBytes(24).toString('hex'),app=randomBytes(24).toString('hex');
 let env=readFileSync('.env.example','utf8').replace('postgresql://fincore_app:REPLACE','postgresql://fincore_app:'+app).replace('postgresql://postgres:REPLACE','postgresql://postgres:'+owner);
 env=env.replace('postgresql://fincore_app:REPLACE','postgresql://fincore_app:'+app);
 env=env.replaceAll('GENERATE_WITH_SETUP',()=>randomBytes(40).toString('hex'));
 env=env.replace(/^DEMO_PASSWORD=.*$/m,'DEMO_PASSWORD=FC!'+randomBytes(12).toString('hex')+'a9');
 writeFileSync('.env',env);
}
const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')&&!x.startsWith('#')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
const admin=new URL(env.MIGRATION_DATABASE_URL),appUrl=new URL(env.DATABASE_URL);
function exec(binary,args,options={}){const r=spawnSync(binary,args,{encoding:'utf8',windowsHide:true,...options});if(r.status!==0)throw Error(r.stderr||r.stdout||r.error?.message);return r.stdout;}
const bin=resolve('.tools/pgsql/bin');
const data=resolve('.runtime/postgres');
if(!existsSync(join(data,'PG_VERSION'))){
 const pw=resolve('.runtime/init-password');writeFileSync(pw,decodeURIComponent(admin.password));
 try{console.log(exec(join(bin,'initdb.exe'),['-D',data,'-U',admin.username,'-A','scram-sha-256','--pwfile',pw,'--encoding=UTF8','--locale=C']));}finally{unlinkSync(pw);}
}
const pgctl=join(bin,'pg_ctl.exe');
const status=spawnSync(pgctl,['status','-D',data],{windowsHide:true});
if(status.status!==0)exec(pgctl,['start','-D',data,'-l',resolve('.runtime/postgres.log'),'-o','-h 127.0.0.1 -p '+(admin.port||5432),'-w'],{stdio:'ignore'});
function sql(text,db='postgres'){
 return exec(join(bin,'psql.exe'),['-h',admin.hostname,'-p',admin.port||'5432','-U',admin.username,'-d',db,'-v','ON_ERROR_STOP=1'],{input:text,env:{...process.env,PGPASSWORD:decodeURIComponent(admin.password)}});
}
if(!sql("SELECT rolname FROM pg_roles WHERE rolname='fincore_app'").includes('fincore_app'))sql(`CREATE ROLE fincore_app LOGIN PASSWORD '${decodeURIComponent(appUrl.password)}' NOSUPERUSER NOCREATEDB NOCREATEROLE;`);
for(const name of ['fincore','fincore_test'])if(!sql(`SELECT datname FROM pg_database WHERE datname='${name}'`).includes(name))sql(`CREATE DATABASE ${name};`);
function find(dir,name){for(const e of readdirSync(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isFile()&&e.name===name)return p;if(e.isDirectory()){const r=find(p,name);if(r)return r;}}}
function background(name,exe,args){
 const previous=existsSync('.runtime/'+name+'.pid')?Number(readFileSync('.runtime/'+name+'.pid','utf8')):0;
 if(previous){try{process.kill(previous,0);return;}catch{}}
 const child=spawn(exe,args,{cwd:root,detached:true,stdio:'ignore',windowsHide:true});child.unref();writeFileSync('.runtime/'+name+'.pid',String(child.pid));
}
background('redis',find(resolve('.tools/redis'),'redis-server.exe'),['--bind','127.0.0.1','--port','6379','--save','','--appendonly','yes','--dir',resolve('.runtime')]);
background('mailpit',resolve('.tools/mailpit/mailpit.exe'),['--listen','127.0.0.1:8025','--smtp','127.0.0.1:1025','--database',resolve('.runtime/mailpit.db')]);
console.log('PostgreSQL, Redis and Mailpit started on loopback. Local secrets saved in ignored .env.');
