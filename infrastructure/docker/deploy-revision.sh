#!/bin/sh
# Install root-owned at /opt/fincore/deploy-revision.sh. The checkout is /opt/fincore/source.
set -eu
revision=${1:?Full reviewed commit SHA required}
echo "$revision" | grep -Eq '^[a-f0-9]{40}$'
cd /opt/fincore/source
git fetch origin
git cat-file -e "$revision^{commit}"
git rev-parse HEAD > /opt/fincore/previous-revision
git checkout --detach "$revision"
docker compose -f docker-compose.yml -f infrastructure/docker/compose.production.yml up --build -d
docker compose ps
