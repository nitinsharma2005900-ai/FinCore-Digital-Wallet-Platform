# Change governance and publication

Use semantic commits and isolated feature/hotfix branches. CODEOWNERS covers ledger, migrations, payments and Python calculations. Review database migrations for foreign keys, precision, trigger preservation, lock duration, restore plan and additive compatibility. Review ledger changes for balance invariants, sorted locking, idempotency payload binding, authorization and compensating transactions. The PR template contains the concrete review checklist.

Before enabling GitHub protection, designate a repository. Require pull requests, CODEOWNER approval, passing Financial quality gates, one independent approval, stale-review dismissal, conversation resolution, restricted force pushes and protected semantic release tags. Use staging/production GitHub environments with required production reviewers and protected deployment branches. These are repository settings and have not been fabricated locally.

The controlled hotfix corrects the shutdown script leaving BullMQ worker processes alive. Branch hotfix/stop-worker adds explicit worker shutdown, verifies process ownership, and terminates owned process trees. The running worker was stopped with the WorkerOnly switch, its absence verified, and a replacement worker started. See evidence/hotfix-stop-worker.json and evidence/git-history.txt for actual results and merge history. No external review or approval is claimed.

Publishing commands after choosing a repository:

```powershell
git remote add origin https://github.com/OWNER/REPOSITORY.git
git push -u origin main
git push origin --tags
```

Do not paste access tokens into remote URLs. The repository is now published at https://github.com/nitinsharma2005900-ai/FinCore-Digital-Wallet-Platform and was made public with explicit user authorization. Genuine hosted runs are recorded in evidence/github-status.json; initial failures and corrections are documented under docs/incidents/. Branch protection setup responses are saved in evidence/github-protection-response.json. No independent review, successful overall security pipeline or cloud deployment is fabricated.

CI definitions execute lint, type checks, Node/Python/real-PostgreSQL tests, component/browser tests, builds, dependency and secret scanning, image scanning, versioned artifacts and provenance attestation. Deployment promotes a reviewed commit through configured environment gates. Local evidence is distinct from hosted CI evidence; credentials/host settings are still required for actual execution.
