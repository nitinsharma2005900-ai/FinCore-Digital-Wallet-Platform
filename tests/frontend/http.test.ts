import {it,expect} from 'vitest';
import {createHttpClient} from '../../apps/web/app/http';
it('rotates once for simultaneous expired requests and retries with the new access token',async()=>{
 let refreshes=0;const sessions:any[]=[];
 const transport=(async(url:string,options:any)=>{if(url.endsWith('/auth/refresh')){refreshes++;await new Promise(r=>setTimeout(r,10));return new Response(JSON.stringify({data:{accessToken:'new',user:{id:'test'}}}),{status:200});}return new Response(JSON.stringify(options.headers.Authorization==='Bearer new'?{data:{ok:true}}:{error:{message:'expired'}}),{status:options.headers.Authorization==='Bearer new'?200:401});}) as typeof fetch;
 const http=createHttpClient('http://test.invalid','expired',s=>sessions.push(s),transport);
 const result=await Promise.all([http.data('/wallets'),http.data('/transactions')]);expect(refreshes).toBe(1);expect(sessions).toHaveLength(1);expect(result.every(r=>r.ok)).toBe(true);
});
it('does not automatically retry a failed financial mutation',async()=>{let count=0;const http=createHttpClient('http://test.invalid','token',()=>{},(async()=>{count++;return new Response(JSON.stringify({error:{message:'Provider unavailable'}}),{status:503});}) as typeof fetch);await expect(http.data('/transfers','POST',{amount:'1.00'})).rejects.toThrow('Provider unavailable');expect(count).toBe(1);});
