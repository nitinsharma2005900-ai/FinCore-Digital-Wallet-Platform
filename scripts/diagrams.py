"""Native vector documentation diagrams; no external API or AI dependency."""
from pathlib import Path
from reportlab.graphics.shapes import Drawing,Rect,String,Line,Polygon
from reportlab.graphics import renderSVG,renderPDF
from reportlab.lib import colors
ROOT=Path(__file__).resolve().parents[1]
def diagram(title,rows,links):
    d=Drawing(540,340);d.add(String(16,318,title,fontSize=16,fillColor=colors.HexColor('#102941')))
    nodes={}
    for row,items in enumerate(rows):
        for col,(key,label) in enumerate(items):
            x=20+col*170;y=240-row*80;nodes[key]=(x,y)
            d.add(Rect(x,y,148,44,rx=7,fillColor=colors.HexColor('#e3f3ed'),strokeColor=colors.HexColor('#087f68')))
            d.add(String(x+8,y+17,label,fontSize=10,fillColor=colors.HexColor('#102941')))
    for a,b in links:
        x,y=nodes[a];xx,yy=nodes[b];start=(x+74,y);end=(xx+74,yy+44)
        if y==yy:start=(x+148,y+22);end=(xx,yy+22)
        d.add(Line(*start,*end,strokeColor=colors.HexColor('#456680')))
        ex,ey=end;d.add(Polygon([ex,ey,ex-4,ey+7,ex+4,ey+7],fillColor=colors.HexColor('#456680'),strokeColor=None))
    d.add(String(16,8,'FinCore | Synthetic educational data | Simulation Only',fontSize=9,fillColor=colors.HexColor('#456680')))
    return d
architecture=diagram('Service architecture',[[('ui','Next.js browser UI'),('api','Express business API'),('py','FastAPI Decimal / risk')],[('pg','PostgreSQL journal'),('redis','Redis / BullMQ'),('provider','Stripe test / simulator')],[('worker','Durable delivery worker'),('mail','Mailpit / SMTP sandbox'),('sms','SMS test adapter')]], [('ui','api'),('api','py'),('api','pg'),('api','provider'),('worker','pg'),('worker','redis'),('worker','mail'),('worker','sms')])
entities=diagram('Financial entity relationships',[[('user','User / Session'),('wallet','Wallet / Account'),('intent','PaymentIntent')],[('tx','Transaction'),('journal','LedgerEntry / Hold'),('event','ProviderEvent / Settlement')],[('refund','Refund / ExternalRefund'),('dispute','Dispute / RiskAlert'),('audit','Audit / Notification')]], [('user','wallet'),('wallet','journal'),('tx','journal'),('intent','event'),('tx','refund'),('user','dispute'),('user','audit')])
sequence=diagram('Transfer and delivery data flow',[[('confirm','Confirm + JWT + reauth'),('risk','Decimal risk evaluation'),('lock','Ordered wallet locks')],[('post','Post balanced journal'),('commit','Deferred checks / commit'),('result','Idempotent API response')],[('outbox','Durable outbox scan'),('queue','BullMQ retry queue'),('email','Sandbox delivery')]], [('confirm','risk'),('risk','lock'),('lock','post'),('post','commit'),('commit','result'),('commit','outbox'),('outbox','queue'),('queue','email')])
if __name__=='__main__':
    target=ROOT/'docs/architecture';target.mkdir(exist_ok=True)
    for name,d in [('services',architecture),('entities',entities),('transaction-flow',sequence)]:renderSVG.drawToFile(d,str(target/(name+'.svg')));renderPDF.drawToFile(d,str(target/(name+'.pdf')))
