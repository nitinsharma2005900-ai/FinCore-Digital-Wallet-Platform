# Change governance and publication

Use semantic commits and isolated feature/hotfix branches. CODEOWNERS covers ledger, migrations, payments and Python calculations. Review database migrations for foreign keys, precision, trigger preservation, lock duration, restore plan and additive compatibility. Review ledger changes for balance invariants, sorted locking, idempotency payload binding, authorization and compensating transactions. The PR template contains the concrete review checklist.

Before enabling GitHub protection, designate a repository. Require pull requests, CODEOWNER approval, passing Financial quality gates, one independent approval, stale-review dismissal, conversation resolution, restricted force pushes and protected semantic release tags. Use staging/production GitHub environments with required production reviewers and protected deployment branches. These are repository settings and have not been fabricated locally.

The controlled hotfix example corrects sidebar scrolling on short viewports, caught by the Playwright customer profile navigation test. The local hotfix branch, commit and merge are genuine; no external review or approval is claimed. See evidence/git-history.txt for actual history.

Publishing commands after choosing a repository:

```powershell
git remote add origin https://github.com/OWNER/REPOSITORY.git
git push -u origin main
git push origin --tags
```

Do not paste access tokens into remote URLs. GitHub CLI authentication is available locally, but no submission repository was named and no new remote repository has been created. No cloud deployment, hosted CI run, protected-branch configuration or independent review is claimed by this package.

CI definitions execute lint, type checks, Node/Python/real-PostgreSQL tests, component/browser tests, builds, dependency and secret scanning, image scanning, versioned artifacts and provenance attestation. Deployment promotes a reviewed commit through configured environment gates. Local evidence is distinct from hosted CI evidence; credentials/host settings are still required for actual execution.
