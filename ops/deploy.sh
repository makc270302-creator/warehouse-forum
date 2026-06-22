#!/bin/sh
set -eu

git pull --ff-only
docker compose --env-file .env.production build --pull app
docker compose --env-file .env.production up -d
docker compose --env-file .env.production ps
