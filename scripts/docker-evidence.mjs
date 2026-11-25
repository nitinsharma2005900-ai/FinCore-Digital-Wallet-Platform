import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const args=['-d','Ubuntu','-u','root','--','docker','compose','--project-directory','/mnt/c/Users/amits/Documents/FinCore','-f','/mnt/c/Users/amits/Documents/FinCore/docker-compose.yml','-f','/mnt/c/Users/amits/Documents/FinCore/infrastructure/docker/compose.verify.yml','-p','fincore-verify','ps','--all','--format','json'];
const result=spawnSync('wsl',args,{encoding:'utf8',windowsHide:true,timeout:90000});
const containers=[];for(const line of (result.stdout||'').trim().split('\n')){if(!line.trim())continue;try{containers.push(JSON.parse(line));}catch{/* Preserve only valid status records. */}}
const services=containers.flat().map(c=>({service:c.Service,state:c.State,health:c.Health,exitCode:c.ExitCode}));
const verified=['web','api','analytics','postgres','redis','worker'].every(name=>services.some(s=>s.service===name&&s.state==='running'&&s.health==='healthy'));
writeFileSync('evidence/docker-runtime.json',JSON.stringify({checkedAt:new Date().toISOString(),engine:'Docker Engine in Ubuntu WSL',composeExitCode:result.status,services,verified},null,2));console.log({services,verified});
