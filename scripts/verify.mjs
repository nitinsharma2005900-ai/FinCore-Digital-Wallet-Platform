import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
mkdirSync('evidence',{recursive:true});
const requested=process.argv.slice(2);const names=requested.length?requested:['lint','typecheck','test','build','docs'];
const checks=requested.length&&existsSync('evidence/checks.json')?JSON.parse(readFileSync('evidence/checks.json','utf8')).filter(c=>!names.includes(c.name)):[];
for(const name of names){
 if(!['lint','typecheck','test','build','docs'].includes(name))throw Error('Unknown check');
 const started=Date.now();console.log('Running',name);
 const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run',name],{encoding:'utf8',shell:process.platform==='win32',windowsHide:true,maxBuffer:20*1024*1024});
 writeFileSync(`evidence/${name}-execution.txt`,(result.stdout||'')+(result.stderr||''));checks.push({name,exitCode:result.status,passed:result.status===0,elapsedSeconds:(Date.now()-started)/1000,completedAt:new Date().toISOString()});
 console.log(name,result.status===0?'PASS':'FAIL');
}
writeFileSync('evidence/checks.json',JSON.stringify(checks,null,2));if(checks.some(c=>!c.passed))process.exitCode=1;
