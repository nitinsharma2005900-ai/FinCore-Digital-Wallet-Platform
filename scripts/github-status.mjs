import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const repo='nitinsharma2005900-ai/FinCore-Digital-Wallet-Platform';
function gh(args){const r=spawnSync('gh',args,{encoding:'utf8',windowsHide:true,timeout:30000});return {exitCode:r.status,stdout:r.stdout||'',stderr:r.stderr||''};}
const runs=gh(['run','list','-R',repo,'--limit','5','--json','databaseId,name,status,conclusion,url']);
writeFileSync('evidence/github-status.json',JSON.stringify({repository:'https://github.com/'+repo,checkedAt:new Date().toISOString(),runs:runs.exitCode===0?JSON.parse(runs.stdout):[],lookupExitCode:runs.exitCode},null,2));
console.log(runs.stdout||runs.stderr);
