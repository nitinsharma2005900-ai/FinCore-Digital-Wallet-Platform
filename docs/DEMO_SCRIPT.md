# 8–10 minute demonstration script

0:00–0:45 — “This is FinCore, an educational wallet and payment-processing platform. Every balance and customer is synthetic. The application never processes real money.” Show the visible simulation notice.

0:45–1:30 — Open README, ASSESSMENT_MATRIX and the consolidated report. “Each assessment links to source code, tests and real evidence. External sandbox and deployment limitations are recorded explicitly.”

1:30–2:15 — Show the architecture diagram. “Next.js presents the interface, Express owns business operations, PostgreSQL owns the journal, Python handles Decimal calculations and transparent risk rules, and Redis/BullMQ handles background delivery.”

2:15–3:45 — Sign in using the local customer credentials. Show the dashboard, add a beneficiary using recipient@fincore.test, transfer a small synthetic amount after password confirmation, and inspect transaction journal entries. Add money through local simulated funding and demonstrate a failed settlement that creates no credit.

3:45–4:30 — Show transaction search/date sorting, PDF/CSV statements, profile/security settings, MFA simulation and dispute creation. Explain opening/closing balances and available versus held funds.

4:30–5:45 — Sign in to support, operations, finance and admin in separate browser contexts. Show dispute investigation, risk explanations, reconciliation outcomes, financial reversal, role management and audit records. Explain that role checks are enforced by Express and tested directly.

5:45–6:45 — Show the migration constraints and ledger engine. “A posted transaction contains two equal entries. Sorted locks prevent overspending. Idempotency keys prevent duplicate debit/credit. Reversals add new entries; historical records stay immutable.”

6:45–7:30 — Open FastAPI Swagger and the Python tests. Explain HALF_EVEN Decimal rounding and the five deterministic risk rules. “Risk scores support an investigation; they do not prove fraud.”

7:30–8:30 — Run npm run capstone and show evidence/capstone.json. Review the successful concurrency, duplicate webhook, failed settlement, reversal and integrity results. Show Mailpit and notification outage recovery evidence.

8:30–9:15 — Show actual test XML, coverage, dependency scan and encrypted restore results. “These are local execution reports. Container execution, hosted CI and cloud deployment are only claimed if verified in the matrix.”

9:15–10:00 — Show real Git history, the controlled hotfix and semantic tag. Explain the remaining external credentials/hosting actions. Finish by opening the verified ZIP and PDF deliverables. Record the demonstration yourself; no Loom recording has been fabricated.
