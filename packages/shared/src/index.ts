import { z } from 'zod';
export const roles = ['CUSTOMER','SUPPORT','OPERATIONS','FINANCE','ADMIN'] as const;
export type Role = typeof roles[number];
export const money = z.string().regex(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/,'Use a positive INR amount with at most two decimal places').refine(v=>!/^0(?:\.0{1,2})?$/.test(v),'Amount must be positive');
export const transferSchema = z.object({fromWalletId:z.string().min(1),beneficiaryId:z.string().min(1),amount:money,currency:z.literal('INR').default('INR'),description:z.string().trim().min(1).max(200),confirmation:z.literal(true)}).strict();
export const loginSchema=z.object({email:z.email().toLowerCase(),password:z.string().min(1).max(128)}).strict();
export const registerSchema=loginSchema.extend({password:z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),name:z.string().trim().min(2).max(80)});
export const permissionMatrix:Record<Role,string[]>={CUSTOMER:['own:read','own:write'],SUPPORT:['disputes:read','disputes:write'],OPERATIONS:['risk:read','risk:write','reconciliation:read','reconciliation:write'],FINANCE:['finance:read','finance:write'],ADMIN:['admin:read','admin:write','audit:read','health:read']};
