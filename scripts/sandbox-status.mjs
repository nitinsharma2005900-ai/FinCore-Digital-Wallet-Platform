import 'dotenv/config';
import {writeFileSync} from 'node:fs';
const stripe=process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')&&process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_')&&process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_');
const twilio=!!process.env.TWILIO_ACCOUNT_SID&&!!process.env.TWILIO_AUTH_TOKEN&&process.env.TWILIO_TEST_MODE==='true';
const report={checkedAt:new Date().toISOString(),paymentProvider:process.env.PAYMENT_PROVIDER||'local',stripe:{configured:!!stripe,externallyVerified:false,requiredVariables:['STRIPE_SECRET_KEY','NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY','STRIPE_WEBHOOK_SECRET']},email:{provider:process.env.EMAIL_PROVIDER||'mailpit',externalCredentialsRequired:process.env.EMAIL_PROVIDER==='mailtrap'},sms:{provider:process.env.SMS_PROVIDER||'local',testCredentialsConfigured:twilio,externallyVerified:false},gemini:{used:false,required:false},instructions:'docs/SANDBOX_CREDENTIALS.md'};
writeFileSync('evidence/sandbox-status.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
