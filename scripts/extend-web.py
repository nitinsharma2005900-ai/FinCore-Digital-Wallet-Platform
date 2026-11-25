from pathlib import Path
p=Path('apps/web/app/page.tsx');s=p.read_text()
s=s.replace("import {Wallet,ShieldCheck,Sun,LogOut}","import {Workspace,DataTable} from './workspace';\nimport {Wallet,ShieldCheck,Sun,LogOut}")
s=s.replace("const navigation=['Overview','Wallets','Accounts','Beneficiaries','Transfer','Funding','Transactions','Statements','Disputes','Refunds','Notifications','Security'];", "const navigation=user?.role==='CUSTOMER'?['Overview','Wallets','Accounts','Beneficiaries','Transfer','Funding','Transactions','Statements','Disputes','Refunds','Notifications','Profile','Security','Manage']:['Overview',...({SUPPORT:['Support'],OPERATIONS:['Operations','Risk','Reconciliation'],FINANCE:['Finance'],ADMIN:['Platform','Settings','Audit','System']}[user?.role as string]||[]),'Notifications','Profile','Security'];\n const workViews=['Support','Operations','Risk','Reconciliation','Finance','Platform','Settings','Audit','System','Profile','Manage'];")
s=s.replace("{view==='Overview'&&dashboard.data&&", "{view==='Overview'&&user?.role==='CUSTOMER'&&dashboard.data&&")
s=s.replace(" {['Wallets','Accounts','Beneficiaries','Transfer','Funding','Disputes','Security'].includes(view)"," {(workViews.includes(view)||(view==='Overview'&&user?.role!=='CUSTOMER'))&&<Workspace view={view} role={user.role} api={api} user={user} onProfile={setUser}/>}\n {['Wallets','Accounts','Beneficiaries','Transfer','Funding','Disputes','Security'].includes(view)")
start=s.index('function Table(')
s=s[:start]+"function Table({rows}:{rows:any[]}){return <DataTable rows={rows}/>;}\n"
s=s.replace("'http://127.0.0.1:4000/api/v1';", "'http://127.0.0.1:4000/api/v1';")
p.write_text(s)
p=Path('apps/web/app/style.css');p.write_text(p.read_text()+'''
.column-sort{padding:0;background:transparent;color:inherit;border-radius:0;text-transform:capitalize}.pagination{display:flex;gap:16px;align-items:center;justify-content:flex-end;margin-top:20px;font-size:14px}td{max-width:240px;overflow-wrap:anywhere}details dl{min-width:260px;max-width:450px}dt{font-weight:600;margin-top:10px}dd{margin:4px 0;color:#607487;word-break:break-word}.skeleton{animation:pulse 1s infinite alternate}@keyframes pulse{to{opacity:.5}}
.dark{filter:none;background:#101d2d;color:#dbe6f1;min-height:100vh}.dark .card,.dark .auth{background:#172b40;border-color:#2d4155}.dark input,.dark select{background:#20354b;color:#f1f6fa;border-color:#41586c}.dark .muted,.dark th{color:#b6c7d6}.dark .secondary{background:#2b455e;color:#f3f7fa}.dark td,.dark th{border-color:#2e4257}.dark .notice,.dark .success{background:#123f35;color:#b5eedb}.dark .error{background:#542a37;color:#ffcfda}.dark a{color:#72d9bb}
''')
