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
| 09 | Non-root multi-stage containers, private data networking, persistent volumes and health checks | docker-compose.yml; infrastructure/docker | Hosted image/Compose checks pending | Verified local results below | docs/deployment/DEPLOYMENT.md | COMPLETE AND VERIFIED | Isolated fincore-verify Compose stack verified in Ubuntu WSL; native database/data preserved. Cloud container execution remains separate. |
| 10 | Semantic commits, review checklist, CODEOWNERS, controlled hotfix and tag | docs/GOVERNANCE.md; .github/CODEOWNERS | Actual local Git hotfix and merge history | Local portion tested; external execution pending | evidence/git-history.txt | IMPLEMENTED BUT NOT VERIFIED | Public repository published at github.com/nitinsharma2005900-ai/FinCore-Digital-Wallet-Platform with user authorization. See evidence/github-protection-response.json for actual protection setup result; no independent review is fabricated. |
| 11 | Tests, dependency/secret/image scans, versioned artifacts, provenance and approved deployment | .github/workflows/ci.yml; .github/workflows/deploy.yml | scripts/verify.mjs; hosted workflows pending | Local portion tested; external execution pending | evidence/checks.json; evidence/npm-audit.json; evidence/python-audit.json | IMPLEMENTED BUT NOT VERIFIED | Hosted verify job passed, but the image-security gate has unresolved OS advisories. Real run status is in evidence/github-status.json and raw findings in evidence/image-scan.json. No successful overall pipeline is claimed. |
| 12 | Real PostgreSQL concurrency/integrity, API/security, Python, React and browser tests | tests/integration; tests/frontend; tests/e2e | npm test; npm run test:e2e; pytest | Verified local results below | evidence/node-tests.xml; evidence/python-tests.xml; evidence/browser-tests.xml | COMPLETE AND VERIFIED | Coverage is measured over included API/UI modules; external-credential and container tests remain unexecuted. |
| 13 | OpenAPI/Swagger/Postman and lifecycle, signatures, ledger and export documentation | apps/api/src/openapi.ts; scripts/contracts.ts; docs/API.md | tests/integration/platform.test.ts | Verified local results below | docs/openapi.json; postman/FinCore.postman_collection.json | COMPLETE AND VERIFIED | Response envelope schemas are broad rather than exhaustive per-domain response-field schemas. |
| 14 | HTTPS deployment preparation, encrypted backups and isolated integrity-checked restore | scripts/recovery.py; infrastructure/nginx; docs/deployment/DEPLOYMENT.md | python scripts/recovery.py | Local portion tested; external execution pending | evidence/restore-drill.json | BLOCKED BY EXTERNAL CREDENTIALS | Local encrypted restore verified. Render free services do not support the full durable worker architecture. Free full-stack VM/subdomain setup requires manual account provisioning; no paid resource created. |
| 15 | Duplicate payment, mismatched settlement, unbalanced posting, dependency timeout and suspicious-activity incidents | scripts/capstone.ts; scripts/notification-drill.ts | npm run capstone | Verified local results below | evidence/capstone.json; evidence/notification-recovery.json | COMPLETE AND VERIFIED | Incidents use synthetic local wallets only; no production incident or recording is claimed. |

## Actual execution summary

{
  "node": {
    "tests": 18,
    "failures": 0,
    "verified": true
  },
  "python": {
    "tests": 8,
    "failures": 0,
    "verified": true
  },
  "browser": {
    "tests": 7,
    "failures": 0,
    "verified": true
  },
  "containerBrowser": {
    "tests": 6,
    "failures": 0,
    "verified": true
  }
}

[
  {
    "name": "test",
    "exitCode": 0,
    "passed": true,
    "elapsedSeconds": 40.921,
    "completedAt": "2026-11-25T17:15:42.888Z"
  },
  {
    "name": "docs",
    "exitCode": 0,
    "passed": true,
    "elapsedSeconds": 8.106,
    "completedAt": "2026-11-25T17:16:32.484Z"
  },
  {
    "name": "lint",
    "exitCode": 0,
    "passed": true,
    "elapsedSeconds": 5.373,
    "completedAt": "2026-11-25T18:01:12.377Z"
  },
  {
    "name": "typecheck",
    "exitCode": 0,
    "passed": true,
    "elapsedSeconds": 17.94,
    "completedAt": "2026-11-25T18:01:30.319Z"
  },
  {
    "name": "build",
    "exitCode": 0,
    "passed": true,
    "elapsedSeconds": 28.93,
    "completedAt": "2026-11-25T18:01:59.249Z"
  }
]

Coverage scope: API modules and React workspace component, not the whole application. See evidence/coverage-summary.json.

{
  "lines": {
    "total": 429,
    "covered": 341,
    "skipped": 0,
    "pct": 79.48
  },
  "statements": {
    "total": 878,
    "covered": 559,
    "skipped": 0,
    "pct": 63.66
  },
  "functions": {
    "total": 182,
    "covered": 100,
    "skipped": 0,
    "pct": 54.94
  },
  "branches": {
    "total": 504,
    "covered": 253,
    "skipped": 0,
    "pct": 50.19
  },
  "branchesTrue": {
    "total": 0,
    "covered": 0,
    "skipped": 0,
    "pct": 100
  }
}