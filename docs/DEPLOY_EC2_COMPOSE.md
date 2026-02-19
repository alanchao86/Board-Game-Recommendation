# EC2 Deployment Runbook (Single Host + Docker Compose)

This runbook is for the production profile:
- `docker-compose.prod.yml`
- `.env.prod`

## 1. Prerequisites

1. AWS account with billing configured.
2. SSH key pair for EC2 login.
3. A domain name (recommended for HTTPS).

## 2. Prepare Repo (Local)

1. Create deployment branch:
   - `git checkout -b feat/cloud-ec2-compose`
2. Confirm production compose parses:
   - Copy `.env.prod.example` to `.env.prod`
   - Fill placeholder values
   - Run `docker compose -f docker-compose.prod.yml --env-file .env.prod config`
3. Do not commit real secrets in `.env.prod`.

## 3. Provision EC2 (User Action)

1. Launch EC2 (Ubuntu or Amazon Linux).
2. Start with `t3.small` (or above) for more stable image builds; `t3.micro` can work but is easier to stall during heavy builds.
3. Attach security group:
   - Inbound `22` (your IP only)
   - Inbound `80` (public)
   - Inbound `443` (public)
4. Keep `5432` closed to public internet.

## 4. Install Runtime on EC2

SSH into EC2 and run:

```bash
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

For Amazon Linux, replace `apt-get` commands with `yum` equivalents.

## 5. Deploy App to EC2

```bash
git clone <your-repo-url>
cd Board-Game-Recommendation
cp .env.prod.example .env.prod
```

Edit `.env.prod` with real values:
- `POSTGRES_PASSWORD`
- `DB_PASSWORD`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `VITE_API_URL`
- `VITE_BASE_PATH`

Start services:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml ps
```

## 6. Health Checks

1. API health via container status:
   - `docker compose -f docker-compose.prod.yml ps`
2. Logs:
   - `docker compose -f docker-compose.prod.yml logs -f server`
   - `docker compose -f docker-compose.prod.yml logs -f recommender`
3. Browser smoke test:
   - `http://<EC2_PUBLIC_IP>:3000/`

## 7. Reverse Proxy + HTTPS (Recommended)

Use Caddy on host (Let's Encrypt auto-managed):

1. Set a domain that resolves to EC2 public IP.
2. For quick testing, you can use `sslip.io`:
   - Example domain: `<EC2_PUBLIC_IP>.sslip.io`
3. Copy `infra/caddy/Caddyfile` to `/etc/caddy/Caddyfile`.
4. Export domain variable and render Caddyfile:
   - `export CADDY_DOMAIN=your-domain.example`
   - `envsubst < infra/caddy/Caddyfile | sudo tee /etc/caddy/Caddyfile`
5. Install and start Caddy (Ubuntu):
   - `sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https`
   - `curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg`
   - `curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list`
   - `sudo apt-get update && sudo apt-get install -y caddy gettext-base`
   - `sudo systemctl enable --now caddy`
6. Update app env for HTTPS domain:
   - `CORS_ORIGINS=https://your-domain.example`
   - `VITE_API_URL=https://your-domain.example/api`
7. Rebuild app:
   - `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build client server`

## 8. Basic Operations

1. Restart:
   - `docker compose -f docker-compose.prod.yml --env-file .env.prod restart`
2. Update after code changes:
   - `git pull`
   - `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build`
3. Stop:
   - `docker compose -f docker-compose.prod.yml --env-file .env.prod down`

## 9. Cost Control (Stop/Start)

1. When not testing, stop app containers first:
   - `docker compose -f docker-compose.prod.yml --env-file .env.prod down`
2. Then stop the EC2 instance from AWS Console (`Instance state -> Stop instance`).
3. Billing behavior:
   - EC2 compute: stops billing while instance is stopped.
   - Storage/resources: EBS, snapshots, and some Elastic IP scenarios still incur charges.
4. Before resuming tests:
   - Start instance
   - Wait for `2/2 status checks`
   - SSH in and run:
     - `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d`

## 10. Backup Minimum

1. Postgres logical backup:

```bash
docker exec -t bgr_postgres_prod pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql
```

2. Store backup off-instance (recommended: S3).

## 11. Known Limits of Single-Host Setup

1. Single point of failure.
2. Local avatar storage is host-volume-based, not object storage.
3. Scale-out is manual.

For next iteration, migrate DB to RDS and avatar files to S3.

## 12. HTTPS Path (Simple vs Standard)

1. Simple (recommended first): Caddy on host
   - Point domain A record to EC2 public IP (or use `sslip.io` for temporary testing)
   - Install Caddy and configure reverse proxy to `http://127.0.0.1:3000`
   - Caddy auto-issues and renews Let's Encrypt certificates
2. Standard/explicit control: Nginx + Certbot
   - Install Nginx
   - Configure server block for your domain
   - Run Certbot for certificate issuance and auto-renew cron/systemd timer
3. Complexity:
   - Caddy path: low
   - Nginx+Certbot: medium
