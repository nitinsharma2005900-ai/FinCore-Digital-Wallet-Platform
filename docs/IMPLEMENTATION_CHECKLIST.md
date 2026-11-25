# Implementation checklist

Source assessment: assignment2.pdf, 12 pages, all read before development. The PDF is requirements evidence; the pasted master prompt is the user's implementation request.

1. Foundation: inspect Windows tooling, create monorepo and traceability; install exact locked dependencies.
2. Integrity: PostgreSQL migration, deferred balance constraints, immutable ledger, sorted locks, Decimal arithmetic, idempotency and concurrency tests.
3. Services: identity, financial APIs, analytics, provider adapters, durable notifications and workflows.
4. Interface: responsive customer/staff journeys connected to actual APIs.
5. Verification: unit, integration, security, browser, capstone, incidents, build and restore drill.
6. Delivery: infrastructure, governance, contracts, assessment evidence, consolidated PDF, ZIP.

All 15 assessments are tracked individually in ASSESSMENT_MATRIX.md. Statuses must be based on execution evidence. Docker execution requires a Docker engine; cloud deployment requires a selected hosting target and credentials. External provider adapters remain explicitly simulated until sandbox credentials are configured.
