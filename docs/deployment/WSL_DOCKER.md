# Open-source Docker Engine on this Windows machine

Docker Engine 29.1.3 and Compose 2.40.3 were installed into the existing Ubuntu WSL distribution using Ubuntu packages. No paid service or Docker Desktop license is required for this setup. Windows-native `docker` is not installed; invoke it through WSL:

```powershell
wsl -d Ubuntu -u root -- docker info
wsl -d Ubuntu -u root -- service docker start
```

An isolated Compose validation project preserves the native stack and uses separate PostgreSQL/Redis volumes and ports 3100 (web), 4101 (API), 8101 (analytics), 8125 (Mailpit). From PowerShell:

```powershell
wsl -d Ubuntu -u root -- docker compose --project-directory /mnt/c/Users/amits/Documents/FinCore -f /mnt/c/Users/amits/Documents/FinCore/docker-compose.yml -f /mnt/c/Users/amits/Documents/FinCore/infrastructure/docker/compose.verify.yml -p fincore-verify up --build -d
node scripts/docker-evidence.mjs
```

Use evidence/docker-runtime.json to distinguish an installed engine and validated Compose configuration from successfully built, healthy application containers. Installation alone is not proof of assessment completion. The original native services remain at ports 3000/4001/8001.
