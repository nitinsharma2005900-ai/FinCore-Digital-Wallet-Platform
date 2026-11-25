# Controlled financial incident report

Reproduction: npm run capstone. All records are synthetic; timeline timestamps are actual UTC execution times.

## concurrent-transfers

Timeline: 2026-11-25T17:16:55.068Z.
Root cause and corrective action: Two spends compete for one balance; ordered row locks permit only one successful spend.
Actual result and recovery evidence: {"fulfilled": 1, "rejected": 1, "source": {"settled": "20.00", "held": "0.00", "available": "20.00"}, "recipient": {"settled": "80.00", "held": "0.00", "available": "80.00"}}
Impact: synthetic wallets only. Regression: scripts/capstone.ts, tests/integration/ledger.test.ts and tests/integration/platform.test.ts.
Prevention: preserve database constraints, idempotency keys, role checks, immutable history and bounded timeouts.

## duplicate-payment-events

Timeline: 2026-11-25T17:16:55.339Z.
Root cause and corrective action: At-least-once provider delivery; unique event ID suppresses duplicate credit and successful settlement ignores later failure.
Actual result and recovery evidence: {"duplicate": true, "outOfOrderIgnored": true, "source": {"settled": "45.00", "held": "0.00", "available": "45.00"}}
Impact: synthetic wallets only. Regression: scripts/capstone.ts, tests/integration/ledger.test.ts and tests/integration/platform.test.ts.
Prevention: preserve database constraints, idempotency keys, role checks, immutable history and bounded timeouts.

## failed-settlement

Timeline: 2026-11-25T17:16:55.382Z.
Root cause and corrective action: Provider failure persists without creating wallet credit.
Actual result and recovery evidence: {"credited": false}
Impact: synthetic wallets only. Regression: scripts/capstone.ts, tests/integration/ledger.test.ts and tests/integration/platform.test.ts.
Prevention: preserve database constraints, idempotency keys, role checks, immutable history and bounded timeouts.

## mismatched-provider-settlement

Timeline: 2026-11-25T17:16:55.417Z.
Root cause and corrective action: Observed amount differs from intent; store discrepancy without journal posting.
Actual result and recovery evidence: {"duplicate": false, "status": "AMOUNT_MISMATCH"}
Impact: synthetic wallets only. Regression: scripts/capstone.ts, tests/integration/ledger.test.ts and tests/integration/platform.test.ts.
Prevention: preserve database constraints, idempotency keys, role checks, immutable history and bounded timeouts.

## financial-reversal

Timeline: 2026-11-25T17:16:55.480Z.
Root cause and corrective action: A new compensating journal restores funds; original remains immutable.
Actual result and recovery evidence: {"original": "144bf6db-64fc-420a-9193-4a5543827e10", "compensation": "cc5e6268-ff67-4a82-9eb5-aaaa0cddcaf5"}
Impact: synthetic wallets only. Regression: scripts/capstone.ts, tests/integration/ledger.test.ts and tests/integration/platform.test.ts.
Prevention: preserve database constraints, idempotency keys, role checks, immutable history and bounded timeouts.

## unbalanced-journal

Timeline: 2026-11-25T17:16:55.551Z.
Root cause and corrective action: Only debit side exists; deferred database constraint rejects commit and rolls back the transaction.
Actual result and recovery evidence: {"rejected": true, "rolledBack": true}
Impact: synthetic wallets only. Regression: scripts/capstone.ts, tests/integration/ledger.test.ts and tests/integration/platform.test.ts.
Prevention: preserve database constraints, idempotency keys, role checks, immutable history and bounded timeouts.

## dependency-timeout

Timeline: 2026-11-25T17:16:57.602Z.
Root cause and corrective action: Analytics URL intentionally unavailable; bounded dependency failure rejects before financial posting.
Actual result and recovery evidence: {"safeFailure": true, "recovered": {"fee": "0.00", "total": "1.00", "currency": "INR", "rounding": "ROUND_HALF_EVEN"}}
Impact: synthetic wallets only. Regression: scripts/capstone.ts, tests/integration/ledger.test.ts and tests/integration/platform.test.ts.
Prevention: preserve database constraints, idempotency keys, role checks, immutable history and bounded timeouts.

## suspicious-activity

Timeline: 2026-11-25T17:16:57.942Z.
Root cause and corrective action: Synthetic threshold inputs trigger explainable risk decision support.
Actual result and recovery evidence: {"score": 100, "level": "HIGH", "reasons": [{"code": "LARGE_TRANSFER", "explanation": "Transfer is at least INR 100,000"}, {"code": "HIGH_VELOCITY", "explanation": "At least five transfers in the past hour"}, {"code": "FAILED_PAYMENTS", "explanation": "At least three recent failed payment attempts"}, {"code": "RAPID_BENEFICIARIES", "explanation": "At least three beneficiaries added in one hour"}, {"code": "UNUSUAL_FREQUENCY", "explanation": "At least twenty transfers in one day"}], "notice": "Decision support only; not proof of fraud."}
Impact: synthetic wallets only. Regression: scripts/capstone.ts, tests/integration/ledger.test.ts and tests/integration/platform.test.ts.
Prevention: preserve database constraints, idempotency keys, role checks, immutable history and bounded timeouts.

## Recovery confirmation

Final journal: {"balanced": true, "invalidTransactions": [], "debits": "50999.68", "credits": "50999.68", "entries": 42}. Source after reversal: {"settled": "125.00", "held": "0.00", "available": "125.00"}.

## Background delivery outage

{
  "notificationId": "75012bad-7c39-446f-abda-c871d4f09139",
  "failedAttempts": 2,
  "finalAttempts": 3,
  "status": "SENT",
  "emailCaptured": true,
  "provider": "Mailpit local SMTP",
  "scope": "Controlled local SMTP outage; BullMQ retries and outbox recovery"
}
Reproduction: node --import tsx scripts/notification-drill.ts. It intentionally stops/restarts the owned local Mailpit process; BullMQ retries and then delivers.