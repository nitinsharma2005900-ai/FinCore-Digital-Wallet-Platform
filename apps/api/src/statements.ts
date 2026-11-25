import { Router } from 'express';
import { z } from 'zod';
import Decimal from 'decimal.js';
import PDFDocument from 'pdfkit';
import { db,send,fail,audit } from './core';
import { ownWallet } from './ledger';
import { analytics } from './analytics';
export const statements=Router();
statements.get('/',async(req,res)=>{
 const q=z.object({walletId:z.string().min(1),from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),format:z.enum(['json','csv','pdf']).default('json')}).parse(req.query);
 const from=new Date(q.from+'T00:00:00Z'),end=new Date(q.to+'T23:59:59.999Z');
 if(Number.isNaN(+from)||Number.isNaN(+end)||from>end||+end-(+from)>366*86400000)fail(422,'INVALID_DATE_RANGE','Choose a valid range of at most 366 days');
 const wallet=await ownWallet(q.walletId,req.actor!.id);
 const old=await db.ledgerEntry.findMany({where:{walletId:wallet.id,createdAt:{lt:from}},select:{amount:true,direction:true}});
 const opening=old.reduce((sum,e)=>e.direction==='CREDIT'?sum.plus(e.amount.toString()):sum.minus(e.amount.toString()),new Decimal(0));
 const rows=await db.ledgerEntry.findMany({where:{walletId:wallet.id,createdAt:{gte:from,lte:end}},orderBy:{createdAt:'asc'},take:100001});
 if(rows.length>100000)fail(422,'STATEMENT_TOO_LARGE','Select a smaller date range');
 const summary=await analytics('/statement',{opening:opening.toFixed(2),entries:rows.map(e=>({amount:e.amount.toFixed(2),direction:e.direction}))});
 const transactions=await db.transaction.findMany({where:{id:{in:rows.map(r=>r.transactionId)}}});const lookup=new Map(transactions.map(t=>[t.id,t]));
 const details=rows.map(e=>({...e,amount:e.amount.toFixed(2),description:lookup.get(e.transactionId)?.description||'',kind:lookup.get(e.transactionId)?.kind}));
 await audit(req.actor!.id,'statement.generated',wallet.id,req.requestId,{from:q.from,to:q.to,format:q.format});
 if(q.format==='json')return send(res,{wallet,from:q.from,to:q.to,...summary,transactions:details});
 const filename=`FinCore-statement-${q.from}-${q.to}.${q.format}`;
 res.setHeader('Content-Disposition',`attachment; filename="${filename}"`);
 if(q.format==='csv'){
  const cell=(v:unknown)=>'"'+String(v).replace(/^[=+@-]/,"'").replaceAll('"','""')+'"';
  res.type('text/csv');return res.send([['FinCore Simulation Only — No Real Money'],['Wallet',wallet.name],['Period',q.from,q.to],...Object.entries(summary).map(([k,v])=>[k,v]),[],['Date','Reference','Description','Direction','Amount INR'],...details.map(e=>[e.createdAt.toISOString(),e.transactionId,e.description,e.direction,e.amount])].map(row=>row.map(cell).join(',')).join('\r\n'));
 }
 res.type('application/pdf');const pdf=new PDFDocument({margin:48,bufferPages:true});pdf.pipe(res);
 pdf.fillColor('#102941').fontSize(28).text('FinCore').fontSize(16).text('Account statement').moveDown();
 pdf.fillColor('#53677a').fontSize(10).text('SIMULATION ONLY - NO REAL MONEY').text(`Wallet: ${wallet.name}`).text(`${q.from} to ${q.to} (UTC)`).moveDown();
 for(const [k,v] of Object.entries(summary))pdf.fontSize(11).text(`${k}: ${v}`);
 pdf.moveDown().fillColor('#102941').fontSize(12).text('Posted journal activity').moveDown();
 for(const e of details){if(pdf.y>710)pdf.addPage();pdf.fontSize(9).text(`${e.createdAt.toISOString().slice(0,10)} | ${e.direction} | INR ${e.amount}`).fillColor('#53677a').text(e.description).text(e.transactionId).moveDown(.6).fillColor('#102941');}
 if(!details.length)pdf.text('No posted activity for this period.');pdf.end();
});
