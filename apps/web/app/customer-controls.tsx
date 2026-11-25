'use client';
import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {DataTable,ActionForm} from './workspace';
export function CustomerControls({view,api}:{view:string;api:(...args:any[])=>Promise<any>}){
 const cache=useQueryClient();const [selected,setSelected]=useState('');const resource=view==='Security'?'/sessions':'/holds';
 const records=useQuery({queryKey:['customer-controls',view],queryFn:()=>api(resource),retry:false});
 const beneficiaries=useQuery({queryKey:['control-beneficiaries'],queryFn:()=>api('/beneficiaries'),enabled:view==='Manage',retry:false});
 async function remove(path:string,password:string){const {reauthToken}=await api('/auth/reauthenticate','POST',{password});await api(path,'DELETE',undefined,{'X-Reauth-Token':reauthToken});await cache.invalidateQueries();}
 return <><div className="card"><h3>{view==='Security'?'Manage active sessions':'Your reservations'}</h3>{records.error?<p role="alert" className="error">{records.error.message}</p>:<DataTable rows={records.data||[]} onSelect={r=>setSelected(r.id)}/>}</div><ActionForm title={view==='Security'?'Revoke a session':'Release a reservation'} fields={[{name:'id',label:view==='Security'?'Session ID':'Hold ID',value:selected},{name:'password',label:'Confirm your password',type:'password'}]} onSubmit={f=>remove(resource+'/'+f.id,f.password)}/>{view==='Manage'&&<div className="card"><h3>Saved recipient references</h3><DataTable rows={beneficiaries.data||[]}/></div>}</>;
}
