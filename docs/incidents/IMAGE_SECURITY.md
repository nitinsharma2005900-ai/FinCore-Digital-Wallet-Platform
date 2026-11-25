# Image scan findings and remediation

Actual hosted scan: run 45667185131, image aed962005cafd15c4af70c7cd01c52e43898fee3. The raw Trivy JSON is evidence/image-scan.json; its summary is evidence/image-scan-summary.json.

Application npm and Python scans passed, but the image scan correctly found additional OS and bundled package-manager issues. The older Debian base also included vulnerable global npm tooling. The runtime now uses Debian Trixie, removes unused global npm/npx, and starts Next.js directly through a Node CLI bootstrap. The later scan reports zero Node.js dependency findings, but still reports 56 OS findings, including one with a known fixed version (libzstd1 1.5.7+dfsg-1+deb13u1). An explicit runtime apt upgrade is added to apply available base-package fixes.

The other findings in that captured report did not list fixed package versions. They have not been ignored or represented as resolved. The image gate remains exit-code 1 for HIGH/CRITICAL findings. A new build and scan are required to establish the remaining count after the upgrade; production deployment remains blocked until this gate is reviewed and passes. No false VEX assertion or blanket ignore file was added to turn the pipeline green.

The hosted verify job separately passed lint, type checks, PostgreSQL/API/component tests, Python tests, application builds, dependency scans, full-history secret scanning and browser tests. That does not make the overall workflow successful while its image job fails.

Update: run 45668899068 scanned the upgraded image. The captured current report has 55 OS findings, zero findings with a fixed package version listed, and no Node dependency findings. The libzstd fix is no longer among the fixable findings. The strict image gate remains failed; this update does not assert that the remaining advisories are harmless.
