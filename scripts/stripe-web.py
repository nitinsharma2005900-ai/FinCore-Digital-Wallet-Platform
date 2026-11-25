from pathlib import Path
p=Path('apps/web/app/page.tsx');s=p.read_text(encoding='utf-8')
s=s.replace("import {Records}","import {StripePayment} from './stripe-payment';\nimport {Records}")
s=s.replace("[collapsed,setCollapsed]=useState(false);","[collapsed,setCollapsed]=useState(false),[stripeIntent,setStripeIntent]=useState<any>(null);")
s=s.replace("return api('/payment-intents/'+intent.id+'/confirm','POST',{outcome:f.outcome});", "if(intent.provider==='stripe'){setStripeIntent(intent);return intent;}return api('/payment-intents/'+intent.id+'/confirm','POST',{outcome:f.outcome});")
s=s.replace(" {view==='Statements'&&", " {view==='Funding'&&stripeIntent?.clientSecret&&<StripePayment clientSecret={stripeIntent.clientSecret} onComplete={()=>{setSuccess('Test payment confirmed. Awaiting signed webhook settlement.');void cache.invalidateQueries();}}/>}\n {view==='Statements'&&")
p.write_text(s,encoding='utf-8')
