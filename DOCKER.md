# Docker

Jalankan Quizary (MySQL + backend FastAPI + frontend Vite) via Docker.

## Prasyarat

- Docker Engine 20.10+
- Docker Compose v2

## Langkah

```bash
cp .env.example .env             # edit jika perlu (SECRET_KEY wajib >= 32 char)
docker compose up -d --build     # build image, start semua service
```

Tunggu `mysql` healthcheck `healthy`, lalu backend otomatis jalan `alembic upgrade head` + `uvicorn`. Frontend jalan via Vite dev server (HMR).

## URL

| Service  | URL                          |
|----------|------------------------------|
| Frontend | http://localhost:5173        |
| Backend  | http://localhost:8000        |
| API docs | http://localhost:8000/docs   |
| MySQL    | `localhost:3307` (user `quizary`, pwd `quizarypass`) |

## Seed data (opsional)

```bash
docker compose exec -T mysql mysql -uquizary -pquizarypass fastapi_quizary < backend/seed.sql
```

Atau reset total:

```bash
docker compose down -v
docker compose up -d --build
```

## Catatan

- File upload (banner, avatar, soal) di-persist via volume `backend_uploads` di `/app/uploads` container backend.
- Vite di container listen di `0.0.0.0:5173`, jadi `http://localhost:5173` langsung bisa.
- `VITE_API_URL` di-set ke `http://localhost:8000/api`. Kalau diakses dari device lain di LAN, ganti ke IP host (mis. `http://192.168.1.10:8000/api`) dan rebuild frontend.
- Stop: `docker compose down`. Hapus volume: `docker compose down -v`.
