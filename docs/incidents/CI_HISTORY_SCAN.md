# Hosted CI failure and correction

Actual first run: https://github.com/nitinsharma2005900-ai/FinCore-Digital-Wallet-Platform/actions/runs/45664698594

The hosted verify job successfully installed dependencies, migrated/seeded PostgreSQL, started analytics, ran lint/type/API/component/Python tests, built the application and passed dependency scans. Its Gitleaks step failed because shallow checkout did not contain the historical commit range requested for the first push. The scanner reported a partial scan, so that run is recorded as failed rather than described as a successful secret scan.

Correction: configure actions/checkout with fetch-depth: 0, retain the narrow synthetic CI fixture allowlist, commit the change and trigger another real run. The local full-history Gitleaks scan independently passed. Current hosted conclusions are recorded in evidence/github-status.json. A pending job is not counted as successful.

The Docker configuration was also improved to build one shared Node runtime image for API, migration job, web and worker rather than rebuilding and exporting the same dependency tree independently for each service. The isolated validation project retains separate volumes/ports and preserves native data.
