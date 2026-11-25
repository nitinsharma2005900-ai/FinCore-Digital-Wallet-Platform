import 'dotenv/config';
import { z } from 'zod';
const env=z.object({
 NODE_ENV:z.enum(['development','test','production']).default('development'),
 DATABASE_URL:z.string().min(1),REDIS_URL:z.string().url(),
 JWT_ACCESS_SECRET:z.string().min(32),JWT_REFRESH_SECRET:z.string().min(32),MFA_SECRET:z.string().min(32),INTERNAL_SERVICE_SECRET:z.string().min(32),LOCAL_WEBHOOK_SECRET:z.string().min(32),
 FASTAPI_SERVICE_URL:z.string().url(),WEB_ORIGIN:z.string().url().default('http://localhost:3000'),
 PAYMENT_PROVIDER:z.enum(['local','stripe']).default('local'),SMS_PROVIDER:z.enum(['local','twilio']).default('local')
}).parse(process.env);
if(env.PAYMENT_PROVIDER==='stripe' && (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || !process.env.STRIPE_WEBHOOK_SECRET)) throw new Error('Only Stripe test keys and a webhook secret are accepted');
if(env.SMS_PROVIDER==='twilio' && (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN)) throw new Error('Twilio sandbox configuration missing');
export const config=env;
