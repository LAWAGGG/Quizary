# Production Docker

Production-ready stack: MySQL + FastAPI (gunicorn/uvicorn workers) + React (nginx).

## Perbedaan vs `docker-compose.yml` (dev)

| Aspek | Dev | Prod |
|-------|-----|------|
| Backend runtime | uvicorn --reload | gunicorn 4 workers + uvicorn worker class |
| Frontend runtime | Vite dev server | Nginx static + reverse proxy `/api` |
| MySQL port | host `0.0.0.0:3307` | host `127.0.0.1:3307` (loopback only) |
| Network | default bridge | 2 networks: `web` (public) + `internal` (no internet) |
| Secrets | plaintext `.env` | Docker secrets (file-based) |
| User | root | non-root `appuser` |
| Image | single stage | multi-stage (smaller final image) |
| Healthcheck | only mysql | mysql + backend |

## Setup

```bash
mkdir -p secrets

# Generate secrets
openssl rand -base64 32 > secrets/mysql_root_password.txt
openssl rand -base64 32 > secrets/mysql_password.txt
openssl rand -base64 48 > secrets/secret_key.txt

cp .env.production.example .env.prod

# Build + start
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

## Akses

URL hanya di loopback (`127.0.0.1`). Untuk public, pasang reverse proxy (Caddy/Nginx/Traefik) di depan port 80.

- Frontend: `http://localhost`
- API: `http://localhost/api` (di-proxy nginx ke backend)
- API docs: `http://localhost/api/docs`
- MySQL: `127.0.0.1:3307` (debug only)

## Tambah HTTPS

Letakkan Caddy/Traefik di depan container `frontend` (port 80) untuk auto-TLS via Let's Encrypt. Contoh minimal Caddyfile:

```
quizary.example.com {
    reverse_proxy 127.0.0.1:80
}
```

## Catatan penting

- `SECRET_KEY` di file `./secrets/secret_key.txt` — backup aman, kalau hilang semua JWT invalid.
- Upload file (banner/avatar/soal) di volume `backend_uploads` — backup berkala.
- Migrasi `alembic upgrade head` jalan tiap start container. Untuk multi-replica, pindahkan ke init container / CI step.
- `gunicorn -w 4` cocok untuk ~4 CPU core. Sesuaikan dengan host.

## Backup

```bash
# DB
docker compose -f docker-compose.prod.yml exec -T mysql sh -c \
  'mysqldump -u$$MYSQL_USER -p$$(cat /run/secrets/mysql_password) fastapi_quizary' \
  > backup-$(date +%F).sql

# Uploads
docker compose -f docker-compose.prod.yml run --rm -v $(pwd):/backup alpine \
  tar czf /backup/uploads-$(date +%F).tar.gz -C /app uploads
```

## Stop

```bash
docker compose -f docker-compose.prod.yml down       # keep volumes
docker compose -f docker-compose.prod.yml down -v    # nukes data
```
