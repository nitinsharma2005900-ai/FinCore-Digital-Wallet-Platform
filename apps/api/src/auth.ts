import { Router,Request,Response,NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes,randomInt,createHmac } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { config } from './config';
import { db,fail,send,tokenHash,audit,Actor,AppError } from './core';
import { loginSchema,registerSchema } from '../../../packages/shared/src';
export const auth=Router();
// Count failed credential attempts, not successful session refreshes or sensitive-action confirmations.
auth.use(rateLimit({windowMs:15*60*1000,limit:40,skipSuccessfulRequests:true,skip:req=>req.path==='/refresh'&&req.method==='POST'&&!req.cookies.fincore_refresh,standardHeaders:'draft-8',legacyHeaders:false,message:{error:{code:'AUTH_RATE_LIMIT',message:'Too many authentication attempts; try again later'}}}));
const mfaHash=(code:string)=>createHmac('sha256',config.MFA_SECRET).update(code).digest('hex');
const safeUser=(u:{id:string;name:string;email:string;role:string;mfaEnabled:boolean;phone:string|null})=>({id:u.id,name:u.name,email:u.email,role:u.role,mfaEnabled:u.mfaEnabled,phone:u.phone});
async function newSession(userId:string,familyId?:string){
 const raw=randomBytes(48).toString('base64url');
 const session=await db.session.create({data:{userId,familyId:familyId||randomBytes(24).toString('hex'),tokenHash:tokenHash(raw),expiresAt:new Date(Date.now()+7*86400000)}});
 const user=await db.user.findUniqueOrThrow({where:{id:userId}});
 return {raw,session,accessToken:jwt.sign({sub:userId,role:user.role,sid:session.id,type:'access'},config.JWT_ACCESS_SECRET,{expiresIn:'10m',issuer:'fincore',audience:'fincore-web'}),user:safeUser(user)};
}
function issue(res:Response,result:Awaited<ReturnType<typeof newSession>>){
 res.cookie('fincore_refresh',result.raw,{httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'strict',path:'/api/v1/auth',maxAge:7*86400000});
 return send(res,{accessToken:result.accessToken,user:result.user});
}
export async function authenticate(req:Request,_res:Response,next:NextFunction){
 try{
  const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if(!token) fail(401,'UNAUTHENTICATED','Sign in to continue');
  let payload:jwt.JwtPayload;
  try{payload=jwt.verify(token!,config.JWT_ACCESS_SECRET,{algorithms:['HS256'],issuer:'fincore',audience:'fincore-web'}) as jwt.JwtPayload;}
  catch{ return fail(401,'TOKEN_EXPIRED','Your session has expired');}
  if(payload.type!=='access'||typeof payload.sid!=='string'||typeof payload.sub!=='string') fail(401,'INVALID_TOKEN','Invalid session');
  const session=await db.session.findUnique({where:{id:payload.sid}});
  const user=session&&await db.user.findUnique({where:{id:session.userId}});
  if(!session||session.revokedAt||session.expiresAt<new Date()||!user||user.disabled||user.id!==payload.sub) fail(401,'SESSION_REVOKED','Sign in again to continue');
  req.actor={id:user!.id,role:user!.role,sessionId:session!.id};next();
 }catch(e){next(e);}
}
export const allow=(...roles:string[])=>(req:Request,_res:Response,next:NextFunction)=>{if(!req.actor||!roles.includes(req.actor.role)) return next(new AppError(403,'FORBIDDEN','Your role cannot perform this operation'));next();};
export function reauthenticated(req:Request,_res:Response,next:NextFunction){
 try{
  const token=req.headers['x-reauth-token'];
  if(typeof token!=='string') fail(403,'REAUTH_REQUIRED','Confirm your password before this sensitive action');
  const payload=jwt.verify(token as string,config.JWT_ACCESS_SECRET,{algorithms:['HS256'],issuer:'fincore',audience:'fincore-sensitive'}) as jwt.JwtPayload;
  if(payload.sub!==req.actor!.id||payload.sid!==req.actor!.sessionId||payload.type!=='reauth') fail(403,'REAUTH_REQUIRED','Confirm your password again');
  next();
 }catch{next(new AppError(403,'REAUTH_REQUIRED','Confirm your password before this sensitive action'));}
}
auth.post('/register',async(req,res)=>{
 const body=registerSchema.parse(req.body);
 const passwordHash=await bcrypt.hash(body.password,12);
 const user=await db.$transaction(async c=>{
  const user=await c.user.create({data:{email:body.email,name:body.name,passwordHash,role:'CUSTOMER'}});
  await c.wallet.create({data:{userId:user.id,name:'Everyday wallet'}});
  await c.account.create({data:{userId:user.id,label:'Personal account',reference:'FC-'+randomBytes(8).toString('hex').toUpperCase()}});
  await audit(user.id,'auth.registered',user.id,req.requestId,{},c);
  return user;
 });
 res.status(201);return issue(res,await newSession(user.id));
});
auth.post('/login',async(req,res)=>{
 const body=loginSchema.parse(req.body);
 const user=await db.user.findUnique({where:{email:body.email}});
 const valid=await bcrypt.compare(body.password,user?.passwordHash||'$2b$12$WXjvKk4ES8gFPwj4Wc64u.Aezc9p9hNPBkmxHgb9vjJTLN3v.XjRu');
 if(!user||!valid||user.disabled){await audit(user?.id||null,'auth.login_failed',null,req.requestId);fail(401,'INVALID_CREDENTIALS','Email or password is incorrect');}
 if(user!.mfaEnabled){
  const code=String(randomInt(100000,1000000));
  const challenge=await db.challenge.create({data:{userId:user!.id,codeHash:mfaHash(code),expiresAt:new Date(Date.now()+5*60000)}});
  await audit(user!.id,'auth.mfa_challenge',challenge.id,req.requestId);
  return send(res,{mfaRequired:true,challengeId:challenge.id,...(config.NODE_ENV!=='production'?{simulationCode:code}: {})});
 }
 await audit(user!.id,'auth.login',user!.id,req.requestId);
 return issue(res,await newSession(user!.id));
});
auth.post('/mfa',async(req,res)=>{
 const body=z.object({challengeId:z.string(),code:z.string().regex(/^\d{6}$/)}).strict().parse(req.body);
 const result=await db.$transaction(async c=>{
  await c.$queryRaw`SELECT id FROM "Challenge" WHERE id=${body.challengeId} FOR UPDATE`;
  const ch=await c.challenge.findUnique({where:{id:body.challengeId}});
  if(!ch||ch.used||ch.attempts>=5||ch.expiresAt<new Date()) return null;
  const valid=ch.codeHash===mfaHash(body.code);
  await c.challenge.update({where:{id:ch.id},data:{attempts:{increment:1},used:valid}});
  return valid?ch.userId:null;
 });
 if(!result) fail(401,'MFA_INVALID','Code is invalid, expired or has exceeded five attempts');
 const u=await db.user.findUniqueOrThrow({where:{id:result!}});
 if(u.disabled) fail(401,'INVALID_CREDENTIALS','Account disabled');
 await audit(result!,'auth.mfa_verified',null,req.requestId);
 return issue(res,await newSession(result!));
});
auth.post('/refresh',async(req,res)=>{
 if(req.headers.origin!==config.WEB_ORIGIN) fail(403,'CSRF_REJECTED','Trusted origin required');
 const raw=req.cookies.fincore_refresh;
 if(typeof raw!=='string') fail(401,'NO_REFRESH_TOKEN','Sign in to continue');
 const result=await db.$transaction(async c=>{
  const hashed=tokenHash(raw);
  await c.$queryRaw`SELECT id FROM "Session" WHERE "tokenHash"=${hashed} FOR UPDATE`;
  const session=await c.session.findUnique({where:{tokenHash:hashed}});
  if(!session) return null;
  if(session.revokedAt){await c.session.updateMany({where:{familyId:session.familyId},data:{revokedAt:new Date()}});await audit(session.userId,'auth.refresh_replay',session.id,req.requestId,{},c);return null;}
  if(session.expiresAt<new Date()) return null;
  const user=await c.user.findUniqueOrThrow({where:{id:session.userId}});
  if(user.disabled) return null;
  await c.session.update({where:{id:session.id},data:{revokedAt:new Date()}});
  const newRaw=randomBytes(48).toString('base64url');
  const newS=await c.session.create({data:{userId:user.id,familyId:session.familyId,tokenHash:tokenHash(newRaw),expiresAt:new Date(Date.now()+7*86400000)}});
  return {raw:newRaw,session:newS,user:safeUser(user),accessToken:jwt.sign({sub:user.id,role:user.role,sid:newS.id,type:'access'},config.JWT_ACCESS_SECRET,{expiresIn:'10m',issuer:'fincore',audience:'fincore-web'})};
 });
 if(!result) fail(401,'REFRESH_REVOKED','Sign in again to continue');
 return issue(res,result!);
});
auth.post('/logout',authenticate,async(req,res)=>{
 const session=await db.session.findUniqueOrThrow({where:{id:req.actor!.sessionId}});
 await db.session.updateMany({where:{familyId:session.familyId},data:{revokedAt:new Date()}});
 res.clearCookie('fincore_refresh',{path:'/api/v1/auth'});await audit(req.actor!.id,'auth.logout',null,req.requestId);send(res,{loggedOut:true});
});
auth.post('/reauthenticate',authenticate,async(req,res)=>{
 const body=z.object({password:z.string().min(1).max(128)}).strict().parse(req.body);
 const u=await db.user.findUniqueOrThrow({where:{id:req.actor!.id}});
 if(!await bcrypt.compare(body.password,u.passwordHash)) fail(401,'INVALID_CREDENTIALS','Password is incorrect');
 await audit(u.id,'auth.reauthenticated',null,req.requestId);
 send(res,{reauthToken:jwt.sign({sub:u.id,sid:req.actor!.sessionId,type:'reauth'},config.JWT_ACCESS_SECRET,{expiresIn:'5m',issuer:'fincore',audience:'fincore-sensitive'})});
});
export const publicUser=safeUser;
export const actor=(req:Request)=>req.actor as Actor;
