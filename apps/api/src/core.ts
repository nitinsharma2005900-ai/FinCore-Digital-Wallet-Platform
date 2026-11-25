import { PrismaClient, Prisma } from '@prisma/client';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { Request,Response,NextFunction } from 'express';
import { config } from './config';
import pino from 'pino';
import { z } from 'zod';
export const db=new PrismaClient();
export const log=pino({redact:['password','token','authorization','cookie','secret'],level:process.env.LOG_LEVEL||'info'});
export type Actor={id:string;role:string;sessionId:string};
declare global {namespace Express {interface Request {actor?:Actor;requestId:string}}}
export class AppError extends Error {constructor(public status:number, public code:string,message:string){super(message);}}
export const fail=(status:number,code:string,message:string):never=>{throw new AppError(status,code,message);};
export const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
export const tokenHash=(s:string)=>createHmac('sha256',config.JWT_REFRESH_SECRET).update(s).digest('hex');
export const audit=(actorId:string|null,action:string,resourceId:string|null,requestId='system',metadata:Prisma.InputJsonValue={},client:Prisma.TransactionClient|PrismaClient=db)=>client.audit.create({data:{actorId,action,resourceId,requestId,metadata}});
export function page(query:Request['query']) {const p=z.coerce.number().int().min(1).max(100000).default(1).parse(query.page);const limit=z.coerce.number().int().min(1).max(100).default(20).parse(query.limit);return {page:p,limit,skip:(p-1)*limit};}
export function send(res:Response,data:unknown,meta?:unknown){return res.json({data,...(meta?{meta}:{}),requestId:res.locals.requestId});}
export function errors(error:unknown,req:Request,res:Response,_next:NextFunction){
 let status=500,code='INTERNAL_ERROR',message='The request could not be completed';
 if(error instanceof z.ZodError){status=422;code='VALIDATION_ERROR';message=error.issues.map(i=>`${i.path.join('.')||'input'}: ${i.message}`).join('; ');}
 else if(error instanceof AppError){({status,code,message}=error);}
 else if(error instanceof Prisma.PrismaClientKnownRequestError){
  if(error.code==='P2002'){status=409;code='CONFLICT';message='A record with these details already exists';}
  if(error.code==='P2025'){status=404;code='NOT_FOUND';message='Record not found';}
  if(error.code==='P2003'){status=422;code='INVALID_REFERENCE';message='Referenced record does not exist';}
 }
 log[status===500?'error':'warn']({requestId:req.requestId,status,code,errorType:error instanceof Error?error.name:'unknown'},'Request rejected');
 res.status(status).json({error:{code,message},requestId:req.requestId});
}
export const requestId=(req:Request,res:Response,next:NextFunction)=>{req.requestId=randomUUID();res.locals.requestId=req.requestId;res.setHeader('X-Request-ID',req.requestId);next();};
