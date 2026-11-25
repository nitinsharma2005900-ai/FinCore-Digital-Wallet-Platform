import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('evidence',{recursive:true});
const checks=[];
for(const name of ['lint','typecheck','test','build','docs']){
 const started=Date.now();console.log('Running',name);
 const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run',name],{encoding:'utf8',shell:process.platform==='win32',windowsHide:true,maxBuffer:20*1024*1024});
 writeFileSync(`evidence/${name}-execution.txt`,(result.stdout||'')+(result.stderr||''));checks.push({name,exitCode:result.status,passed:result.status===0,elapsedSeconds:(Date.now()-started)/1000,completedAt:new Date().toISOString()});
 console.log(name,result.status===0?'PASS':'FAIL');
}
writeFileSync('evidence/checks.json',JSON.stringify(checks,null,2));if(checks.some(c=>!c.passed))process.exitCode=1;
