import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
const credentials=JSON.parse(readFileSync('.runtime/demo-credentials.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto('http://127.0.0.1:3000');await page.getByLabel('Email address').fill('customer@fincore.test');await page.getByLabel('Password',{exact:true}).fill(credentials.password);await page.getByRole('button',{name:'Sign in securely'}).click();await page.getByText('Total available balance').waitFor();await page.screenshot({path:'evidence/dashboard.png',fullPage:true});writeFileSync('evidence/browser-smoke.json',JSON.stringify({login:true,dashboard:true,url:page.url(),checkedAt:new Date().toISOString()},null,2));console.log('Browser login and dashboard passed');}finally{await browser.close();}
