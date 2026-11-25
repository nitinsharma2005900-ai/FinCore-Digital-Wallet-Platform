import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const password=process.env.DEMO_PASSWORD||JSON.parse(readFileSync('.runtime/demo-credentials.json','utf8')).password;
test('customer can discover and release their own reservation',async({page})=>{
 await page.goto('/');await page.getByLabel('Email address').fill('customer@fincore.test');await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in securely'}).click();await expect(page.getByRole('button',{name:'Sign out'})).toBeVisible();
 const walletResponse=page.waitForResponse(r=>r.url().endsWith('/wallets')&&r.request().method()==='GET');await page.getByRole('button',{name:'Manage',exact:true}).click();const wallet=(await (await walletResponse).json()).data[0];
 const reserve=page.locator('section').filter({has:page.getByRole('heading',{name:'Reserve funds',exact:true})});await reserve.getByLabel('Wallet ID').fill(wallet.id);await reserve.getByLabel('Amount INR').fill('1.00');await reserve.getByLabel('Reason').fill('Controlled browser reservation');await reserve.getByLabel('Confirm your password').fill(password);
 const created=page.waitForResponse(r=>r.url().endsWith('/holds')&&r.request().method()==='POST');await reserve.getByRole('button',{name:'Confirm action'}).click();const hold=await (await created).json();expect(hold.data.id).toBeTruthy();
 const release=page.locator('section').filter({has:page.getByRole('heading',{name:'Release a reservation',exact:true})});await release.getByLabel('Hold ID').fill(hold.data.id);await release.getByLabel('Confirm your password').fill(password);const removed=page.waitForResponse(r=>r.url().endsWith('/holds/'+hold.data.id)&&r.request().method()==='DELETE');await release.getByRole('button',{name:'Confirm action'}).click();expect((await removed).status()).toBe(200);await expect(release.getByRole('status')).toContainText('completed');
});
