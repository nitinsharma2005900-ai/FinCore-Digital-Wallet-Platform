# Assessment traceability matrix

Local verification is distinct from external/cloud execution. No hosted results are fabricated.

| # | Requirement | Implementation file | Test file | Test result | Evidence path | Completion status | Remaining limitation |
|---|---|---|---|---|---|---|---|
| 01 | Responsive customer/staff workflows connected to stored financial records | apps/web/app/page.tsx; apps/web/app/workspace.tsx; apps/web/app/records.tsx | tests/e2e/platform.spec.ts; tests/frontend/table.test.tsx | Verified local results below | evidence/browser-tests.xml; evidence/customer-browser.png | COMPLETE AND VERIFIED | Workspaces share a Next.js route. Staff lists are bounded to 100 records. |
| 02 | Validated versioned APIs, safe errors, ownership and pagination | apps/api/src/app.ts; apps/api/src/customer.ts; apps/api/src/staff.ts | tests/integration/platform.test.ts | Verified local results below | evidence/node-tests.xml | COMPLETE AND VERIFIED | Staff lists capped at 100; reconciliation processes the newest 1000 intents per run. |
| 03 | Exact precision, immutable entries, balanced posting, holds and constraints | database/migrations/001_foundation.sql; apps/api/src/ledger.ts | tests/integration/ledger.test.ts; scripts/capstone.ts | Verified local results below | evidence/capstone.json; evidence/node-tests.xml | COMPLETE AND VERIFIED | INR only; one full compensation per original transaction. Privileged migrator credentials must remain separate. |
| 04 | Bcrypt, JWT, refresh rotation/replay revocation, simulated MFA, RBAC and reauthentication | apps/api/src/auth.ts; apps/api/src/customer.ts | tests/integration/platform.test.ts | Verified local results below | evidence/node-tests.xml | COMPLETE AND VERIFIED | MFA is explicitly simulated locally; production activation is blocked without secure delivery. |
| 05 | Decimal fees, interest, totals, summaries, reconciliation and HALF_EVEN rounding | services/financial-analytics/app.py | services/financial-analytics/test_app.py | Verified local results below | evidence/python-tests.xml; evidence/python-benchmark.json | COMPLETE AND VERIFIED | Benchmark is in-process TestClient measurement, not production capacity. |
| 06 | Five deterministic risk patterns, explanations and actionable operations alerts | services/financial-analytics/app.py; apps/api/src/customer.ts | services/financial-analytics/test_app.py; scripts/capstone.ts | Verified local results below | evidence/python-tests.xml; evidence/capstone.json | COMPLETE AND VERIFIED | Risk is threshold-based decision support, not proof of fraud. Stored alerts evaluate at transfer time. |
| 07 | Atomic transfers, funds checks, payload-bound idempotency and ordered row locks | apps/api/src/ledger.ts | tests/integration/ledger.test.ts | Verified local results below | evidence/node-tests.xml; evidence/capstone.json | COMPLETE AND VERIFIED | Automatic retry is limited to deadlock/serialization failures; durable operation keys remain mandatory. |
| 08 | Signed webhooks, deduplication, settlement, refund outbox and retryable notifications | apps/api/src/payments.ts; apps/api/src/providers.ts; apps/worker/src/index.ts | tests/integration/platform.test.ts; scripts/notification-drill.ts | Verified local results below | evidence/notification-recovery.json; evidence/capstone.json | LOCAL SIMULATION ONLY | Local settlement and Mailpit verified. Stripe, Mailtrap and Twilio test credentials absent; external adapters unverified. |
| 09 | Non-root multi-stage containers, private data networking, persistent volumes and health checks | docker-compose.yml; infrastructure/docker | Hosted image/Compose checks pending | Local portion tested; external execution pending | docs/deployment/DEPLOYMENT.md | IMPLEMENTED BUT NOT VERIFIED | Docker Desktop/engine absent. Container builds, Compose runtime and container health have not been executed. |
| 10 | Semantic commits, review checklist, CODEOWNERS, controlled hotfix and tag | docs/GOVERNANCE.md; .github/CODEOWNERS | Actual local Git hotfix and merge history | Local portion tested; external execution pending | evidence/git-history.txt | IMPLEMENTED BUT NOT VERIFIED | Local Git history is genuine. No designated remote repository, independent review or hosted protections. |
| 11 | Tests, dependency/secret/image scans, versioned artifacts, provenance and approved deployment | .github/workflows/ci.yml; .github/workflows/deploy.yml | scripts/verify.mjs; hosted workflows pending | Local portion tested; external execution pending | evidence/checks.json; evidence/npm-audit.json; evidence/python-audit.json | IMPLEMENTED BUT NOT VERIFIED | Workflow definitions prepared. No hosted CI run, image scan, attestation or deployment approval is claimed. |
| 12 | Real PostgreSQL concurrency/integrity, API/security, Python, React and browser tests | tests/integration; tests/frontend; tests/e2e | npm test; npm run test:e2e; pytest | Verified local results below | evidence/node-tests.xml; evidence/python-tests.xml; evidence/browser-tests.xml | COMPLETE AND VERIFIED | Coverage is measured over included API/UI modules; external-credential and container tests remain unexecuted. |
| 13 | OpenAPI/Swagger/Postman and lifecycle, signatures, ledger and export documentation | apps/api/src/openapi.ts; scripts/contracts.ts; docs/API.md | tests/integration/platform.test.ts | Verified local results below | docs/openapi.json; postman/FinCore.postman_collection.json | COMPLETE AND VERIFIED | Response envelope schemas are broad rather than exhaustive per-domain response-field schemas. |
| 14 | HTTPS deployment preparation, encrypted backups and isolated integrity-checked restore | scripts/recovery.py; infrastructure/nginx; docs/deployment/DEPLOYMENT.md | python scripts/recovery.py | Local portion tested; external execution pending | evidence/restore-drill.json | BLOCKED BY EXTERNAL CREDENTIALS | Local encrypted restore passed. Cloud VM, domain, DNS, HTTPS and offsite scheduling require selected hosting access. |
| 15 | Duplicate payment, mismatched settlement, unbalanced posting, dependency timeout and suspicious-activity incidents | scripts/capstone.ts; scripts/notification-drill.ts | npm run capstone | Verified local results below | evidence/capstone.json; evidence/notification-recovery.json | COMPLETE AND VERIFIED | Incidents use synthetic local wallets only; no production incident or recording is claimed. |

## Actual execution summary

{
  "node": {
    "tests": 14,
    "failures": 0,
    "verified": true
  },
  "python": {
    "tests": 8,
    "failures": 0,
    "verified": true
  },
  "browser": {
    "tests": 6,
    "failures": 0,
    "verified": true
  }
}

[
  {
    "name": "typecheck",
    "exitCode": 0,
    "passed": true,
    "elapsedSeconds": 10.864,
    "completedAt": "2026-11-25T17:04:47.337Z"
  },
  {
    "name": "test",
    "exitCode": 0,
    "passed": true,
    "elapsedSeconds": 21.549,
    "completedAt": "2026-11-25T17:05:08.886Z"
  },
  {
    "name": "build",
    "exitCode": 0,
    "passed": true,
    "elapsedSeconds": 17.879,
    "completedAt": "2026-11-25T17:05:26.766Z"
  },
  {
    "name": "docs",
    "exitCode": 0,
    "passed": true,
    "elapsedSeconds": 1.132,
    "completedAt": "2026-11-25T17:05:27.898Z"
  },
  {
    "name": "lint",
    "exitCode": 0,
    "passed": true,
    "elapsedSeconds": 3.591,
    "completedAt": "2026-11-25T17:06:28.673Z"
  }
]

Coverage scope: API modules and React workspace component, not the whole application. See evidence/coverage-summary.json.

{
  "lines": {
    "total": 419,
    "covered": 331,
    "skipped": 0,
    "pct": 78.99
  },
  "statements": {
    "total": 838,
    "covered": 525,
    "skipped": 0,
    "pct": 62.64
  },
  "functions": {
    "total": 171,
    "covered": 91,
    "skipped": 0,
    "pct": 53.21
  },
  "branches": {
    "total": 464,
    "covered": 227,
    "skipped": 0,
    "pct": 48.92
  },
  "branchesTrue": {
    "total": 0,
    "covered": 0,
    "skipped": 0,
    "pct": 100
  }
}