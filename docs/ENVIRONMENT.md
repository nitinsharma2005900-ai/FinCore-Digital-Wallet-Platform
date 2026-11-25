# Configuration reference

Copy .env.example only through scripts/Setup.ps1 or scripts/setup-local.mjs so local secrets are generated rather than reused. Actual .env is ignored and excluded from the ZIP. The seed writes synthetic login credentials to ignored .runtime/demo-credentials.json. Never paste the private configuration into documentation, screenshots or CI logs.

| Variables | Purpose / configuration |
|---|---|
| NODE_ENV | development locally; production only behind HTTPS with fresh secrets and demo seeding disabled |
| DATABASE_URL | Least-privilege fincore_app runtime connection |
| MIGRATION_DATABASE_URL | Separate schema owner/migrator connection; never use it in the API |
| TEST_DATABASE_URL | Dedicated fincore_test connection; tests explicitly reject another database name |
| REDIS_URL | Private Redis/BullMQ queue, loopback for native setup |
| JWT_ACCESS_SECRET, JWT_REFRESH_SECRET | Distinct generated secrets for JWT signing and refresh-token keyed hashes |
| MFA_SECRET | Hashing simulated one-time codes |
| INTERNAL_SERVICE_SECRET | Authenticates Express-to-FastAPI requests; never sent to the browser |
| LOCAL_WEBHOOK_SECRET | Signs local timestamped provider events |
| BACKUP_SECRET | Encrypts local dumps with scrypt-derived AES-GCM key; store separately from backup files |
| FASTAPI_SERVICE_URL | Internal analytics URL; current native installation uses http://127.0.0.1:8001 |
| PORT, HOST | API bind port/address; native 4001 and loopback, container internal 4000 and 0.0.0.0 |
| WEB_ORIGIN | Exact allowed browser origin, currently http://127.0.0.1:3000 |
| NEXT_PUBLIC_API_URL | Public browser API URL; current native value http://127.0.0.1:4001/api/v1; rebuild/restart Next.js after changes |
| PAYMENT_PROVIDER | local or stripe; local requires no external credentials |
| STRIPE_SECRET_KEY | Server-only sk_test_ key; live keys rejected |
| STRIPE_WEBHOOK_SECRET | Server-only signing secret for exact provider endpoint |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | Browser-safe pk_test_ key only; Stripe checkout is disabled without it |
| EMAIL_PROVIDER | mailpit for local SMTP capture; sandbox SMTP can use Mailtrap |
| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE | Local defaults 127.0.0.1:1025; use the sandbox SMTP host/port/auth and TLS settings for external capture |
| SMS_PROVIDER | local (no external SMS) or twilio test adapter |
| TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TEST_MODE | Test credentials only; TWILIO_TEST_MODE=true is mandatory. Magic test-number calls validate API behavior without delivering SMS |
| TWILIO_FROM_NUMBER | Reserved template value; current test adapter deliberately uses magic test numbers |
| SEED_DEMO, DEMO_PASSWORD | Explicitly enable synthetic seed only outside production; setup generates the local password |
| DATABASE_PASSWORD, POSTGRES_PASSWORD | Docker Compose runtime/migrator credentials; distinct from exposed frontend configuration |
| API_HOST_PORT, ANALYTICS_HOST_PORT | Optional Compose host mappings, default 4001/8001; database/cache have no host mapping |
| WORKER_HEALTH_PORT | Private worker health endpoint, default 8081 |

No API key is needed for verified local simulation. To execute external Stripe, Mailtrap or Twilio sandbox tests, obtain provider test credentials in your own account and configure only the server variables above; do not use live payment processing. To deploy, configure the VM/domain and GitHub environment secrets described in docs/deployment/DEPLOYMENT.md. No LLM API is used or required.
