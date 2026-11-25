from pathlib import Path
p=Path('apps/web/app/page.tsx');s=p.read_text(encoding='utf-8');s=s.replace("import {Workspace,DataTable}","import {Records} from './records';\nimport {Workspace,DataTable}")
s=s.replace("[dark,setDark]=useState(false);","[dark,setDark]=useState(false),[collapsed,setCollapsed]=useState(false);")
s=s.replace('<aside><h1>','<aside className={collapsed?"collapsed":""}><button className="secondary" aria-label={collapsed?"Expand navigation":"Collapse navigation"} onClick={()=>setCollapsed(!collapsed)}>{collapsed?"Menu":"Collapse navigation"}</button><h1>')
s=s.replace('<main><header>','<main className={collapsed?"nav-collapsed":""}><header>')
s=s.replace("{paths[view]&&view!=='Transfer'&&", "{['Transactions','Notifications','Disputes'].includes(view)&&<Records view={view} token={token} api={api} base={base}/>}\n {paths[view]&&!['Transfer','Transactions','Notifications','Disputes'].includes(view)&&")
p.write_text(s,encoding='utf-8')
p=Path('apps/web/app/style.css');p.write_text(p.read_text(encoding='utf-8')+'''\n aside{overflow-y:auto}aside.collapsed{width:170px;padding:24px 12px}main.nav-collapsed{margin-left:170px}aside h1{margin-top:20px}.column-sort{font-size:14px}input:focus-visible,button:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #20a889} @media(max-width:850px){aside.collapsed{width:100%}main.nav-collapsed{margin-left:0}}\n''')
