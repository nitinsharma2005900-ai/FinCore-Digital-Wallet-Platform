import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const repo='nitinsharma2005900-ai/FinCore-Digital-Wallet-Platform';
const account=spawnSync('gh',['api','user','--jq','.id'],{encoding:'utf8',windowsHide:true});if(account.status!==0)throw Error('GitHub account lookup failed');const owner=Number(account.stdout.trim());
const results=[];for(const name of ['staging','production']){const body={wait_timer:0,prevent_self_review:name==='production',reviewers:name==='production'?[{type:'User',id:owner}]:[],deployment_branch_policy:{protected_branches:true,custom_branch_policies:false}};const r=spawnSync('gh',['api','--method','PUT',`repos/${repo}/environments/${name}`,'--input','-'],{input:JSON.stringify(body),encoding:'utf8',windowsHide:true,timeout:30000});let response;try{response=JSON.parse(r.stdout);}catch{response={message:r.stderr.trim()};}results.push({environment:name,exitCode:r.status,response});}
writeFileSync('evidence/github-environments.json',JSON.stringify(results,null,2));console.log(results.map(r=>({environment:r.environment,configured:r.exitCode===0})));
