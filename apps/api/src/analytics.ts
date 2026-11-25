import { config } from './config';
import { AppError } from './core';
export async function analytics<T=any>(path:string,body:unknown):Promise<T>{
 try {
  const response=await fetch(config.FASTAPI_SERVICE_URL+path,{method:'POST',headers:{'Content-Type':'application/json','X-Internal-Secret':config.INTERNAL_SERVICE_SECRET},body:JSON.stringify(body),signal:AbortSignal.timeout(2500)});
  if(!response.ok) throw new Error('Analytics rejected request');
  return await response.json() as T;
 } catch {throw new AppError(503,'ANALYTICS_UNAVAILABLE','Financial analytics is temporarily unavailable. No funds have moved; retry with the same idempotency key.');}
}
