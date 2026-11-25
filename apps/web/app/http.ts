/** Memory-only access token; concurrent expiry responses share one cookie rotation. */
export function createHttpClient(base:string,initialToken:string,onSession:(session:any)=>void,transport:typeof fetch=fetch){
 let token=initialToken;let rotating:Promise<any>|null=null;
 async function refresh(){
  if(!rotating)rotating=(async()=>{const r=await transport(base+'/auth/refresh',{method:'POST',credentials:'include'});const body=await r.json();if(!r.ok)throw Error(body.error?.message||'Please sign in again');token=body.data.accessToken;onSession(body.data);return token;})().finally(()=>{rotating=null;});
  return rotating;
 }
 async function envelope(path:string,method='GET',body?:any,extra:Record<string,string>={}){
  const usedToken=token;
  const send=()=>transport(base+path,{method,credentials:'include',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...extra},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  let r=await send();if(r.status===401&&usedToken&&!path.startsWith('/auth/')){if(token===usedToken)await refresh();r=await send();}
  const result=await r.json();if(!r.ok)throw Error(result.error?.message||'The request failed');return result;
 }
 return {setToken(value:string){token=value;},refresh,envelope,async data(path:string,method='GET',body?:any,headers?:Record<string,string>){return (await envelope(path,method,body,headers)).data;}};
}
