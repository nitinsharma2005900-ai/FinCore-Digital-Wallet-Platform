import Stripe from 'stripe';
import { createHmac,timingSafeEqual,randomUUID } from 'node:crypto';
import { config } from './config';
import { fail,AppError } from './core';
import Decimal from 'decimal.js';
export function requireSettledRefund(refund:{id:string;status:string|null}){if(refund.status!=='succeeded')throw new AppError(503,'REFUND_NOT_SETTLED','The test provider refund is not settled. The reservation remains in place for retry or investigation.');return refund.id;}
export const stripeMinorUnits=(amount:string)=>{const value=new Decimal(amount).mul(100);if(!value.isInteger()||value.lte(0)||value.gt(1000000000))fail(422,'INVALID_AMOUNT','Invalid test payment amount');return value.toNumber();};
export const stripe=config.PAYMENT_PROVIDER==='stripe'?new Stripe(process.env.STRIPE_SECRET_KEY!,{timeout:5000,maxNetworkRetries:2}):null;
export interface PaymentAdapter {name:string;create(amount:string,key:string):Promise<{id:string;clientSecret?:string}>;refund(providerId:string,key:string):Promise<string>}
export const paymentProvider:PaymentAdapter=stripe?{
 name:'stripe',
 async create(amount,key){const intent=await stripe.paymentIntents.create({amount:stripeMinorUnits(amount),currency:'inr',automatic_payment_methods:{enabled:true},metadata:{simulation:'FinCore test mode'}},{idempotencyKey:key});return {id:intent.id,clientSecret:intent.client_secret||undefined};},
 async refund(providerId,key){let refund=await stripe.refunds.create({payment_intent:providerId},{idempotencyKey:key});if(refund.status==='pending')refund=await stripe.refunds.retrieve(refund.id);return requireSettledRefund(refund);}
}:{name:'local',async create(){return {id:'local_pi_'+randomUUID()};},async refund(){return 'local_refund_'+randomUUID();}};
export function signLocal(body:string,timestamp=Math.floor(Date.now()/1000)){
 const signature=createHmac('sha256',config.LOCAL_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest('hex');
 return `t=${timestamp},v1=${signature}`;
}
export function verifyLocal(body:string,header:string){
 const match=header.match(/^t=(\d+),v1=([a-f0-9]{64})$/);
 if(!match||Math.abs(Date.now()/1000-Number(match[1]))>300) fail(400,'INVALID_SIGNATURE','Invalid or expired webhook signature');
 const expected=signLocal(body,Number(match![1])).split('v1=')[1];
 if(!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(match![2],'hex'))) fail(400,'INVALID_SIGNATURE','Invalid webhook signature');
}
export async function controlledProvider<T>(fn:()=>Promise<T>):Promise<T>{try{return await fn();}catch(e){if(e instanceof AppError)throw e;throw new AppError(503,'PROVIDER_UNAVAILABLE','The test provider is unavailable; retry using the same request key');}}
