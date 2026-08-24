"""Fixed-window rate limiter in-memory untuk endpoint sensitif.

ponytail: cukup untuk single-process; jika deploy multi-worker dan ingin
akurat lintas proses, ganti penyimpanan ke Redis dengan API fungsi yang sama.
"""
import time

from fastapi import HTTPException, Request

_WINDOW_SECONDS = 60
_BUCKETS: dict[str, tuple[int, float]] = {}  # key -> (hitungan, mulai window)
_MAX_KEYS = 10_000


def _client_ip(request: Request) -> str:
    # Hanya peer langsung — X-Forwarded-For bisa dipalsukan klien.
    return request.client.host if request.client else "unknown"


def _hit(key: str, max_calls: int) -> None:
    now = time.monotonic()
    count, start = _BUCKETS.get(key, (0, now))
    if now - start >= _WINDOW_SECONDS:
        count, start = 0, now
    count += 1
    _BUCKETS[key] = (count, start)

    if len(_BUCKETS) > _MAX_KEYS:
        for k, (_, s) in list(_BUCKETS.items()):
            if now - s >= _WINDOW_SECONDS:
                del _BUCKETS[k]

    if count > max_calls:
        raise HTTPException(
            status_code=429,
            detail="Terlalu banyak permintaan. Coba lagi sebentar lagi.",
        )


def limit_login(request: Request) -> None:
    """20 percobaan login / menit / IP — tidak mengganggu pengguna normal."""
    _hit(f"login:{_client_ip(request)}", 20)


def limit_register(request: Request) -> None:
    """5 pendaftaran akun / menit / IP."""
    _hit(f"register:{_client_ip(request)}", 5)


def limit_submission_create(request: Request) -> None:
    """30 sesi pengerjaan baru / menit / IP (blokir spam session anonim)."""
    _hit(f"subcreate:{_client_ip(request)}", 30)
