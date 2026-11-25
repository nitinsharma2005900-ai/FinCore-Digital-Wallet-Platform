'use client';
import {useState,useEffect} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {DataTable,ActionForm} from './workspace';
export function Records({view,token,api,base}:{view:string;token:string;api:(...args:any[])=>Promise<any>;base:string}){
 const [page,setPage]=useState(1),[search,setSearch]=useState(''),[sort,setSort]=useState('desc'),[selected,setSelected]=useState<any>(null),[kind,setKind]=useState('');const cache=useQueryClient();
 useEffect(()=>{setPage(1);setSelected(null);setSearch('');setKind('');},[view]);
 const paths:Record<string,string>={Transactions:'/transactions',Notifications:'/notifications',Disputes:'/disputes'};
 const query=new URLSearchParams({page:String(page),limit:'10',...(view==='Transactions'?{search,sort,...(kind?{kind}:{})}:{})});
 const rows=useQuery({queryKey:['records-paged',view,page,search,sort,kind,token],queryFn:async()=>{const response=await fetch(base+paths[view]+'?'+query,{headers:{Authorization:'Bearer '+token}});const result=await response.json();if(!response.ok)throw Error(result.error?.message||'Unable to load records');return result;},retry:false});
 const details=useQuery({queryKey:['transaction-details',selected?.id],queryFn:()=>api('/transactions/'+selected.id),enabled:view==='Transactions'&&!!selected});
 return <div className="card"><h3>{view}</h3>{view==='Transactions'&&<div className="grid"><label>Search all transactions<input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></label><label>Sort by date<select value={sort} onChange={e=>setSort(e.target.value)}><option value="desc">Newest first</option><option value="asc">Oldest first</option></select></label><label>Transaction type<select value={kind} onChange={e=>{setKind(e.target.value);setPage(1);}}><option value="">All types</option>{['TRANSFER','FUNDING','REFUND','REVERSAL'].map(k=><option key={k}>{k}</option>)}</select></label></div>}{rows.error&&<p className="error">{rows.error.message}</p>}{rows.isLoading?<p className="skeleton">Loading activity…</p>:<DataTable rows={rows.data?.data||[]} onSelect={setSelected}/>}<div className="pagination"><button className="secondary" disabled={page===1} onClick={()=>setPage(page-1)}>Previous results</button><span>Result page {page} · {rows.data?.meta?.total||0} total</span><button className="secondary" disabled={page*10>=(rows.data?.meta?.total||0)} onClick={()=>setPage(page+1)}>Next results</button></div>
 {view==='Transactions'&&details.data&&<section className="card"><h3>Transaction {details.data.id}</h3><p>{details.data.description} · {details.data.status} · INR {details.data.amount}</p><DataTable rows={details.data.entries||[]}/>{details.data.compensation&&<p>Compensation reference: {details.data.compensation.compensationId}</p>}</section>}
 {view==='Notifications'&&selected&&<ActionForm title="Mark notification read" fields={[]} onSubmit={async()=>{await api('/notifications/'+selected.id,'PATCH',{});await cache.invalidateQueries();}}/>}
 </div>;
}
