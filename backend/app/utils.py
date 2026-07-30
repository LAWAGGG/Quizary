import os
from datetime import datetime, timezone, timedelta
from fastapi import Request

WIB = timezone(timedelta(hours=7))

UPLOAD_DIR = "uploads"


def _delete_file(path: str | None) -> None:
    """Remove a stored file from disk if it exists."""
    if not path:
        return
    full = os.path.join(UPLOAD_DIR, path.lstrip("/"))
    if os.path.isfile(full):
        os.remove(full)


def file_url(request: Request, path: str | None) -> str | None:
    """
    Convert a relative storage path to a full URL.
      - None / empty        → None
      - Already http/https  → return as-is (already full URL stored in DB)
      - Relative path       → prepend base_url/uploads/
    """
    if not path:
        return None
    if path.startswith("http://") or path.startswith("https://"):
        return path
    base = str(request.base_url).rstrip("/")
    return f"{base}/uploads/{path.lstrip('/')}"


def now_wib() -> datetime:
    """Current time in WIB (UTC+7) as a naive datetime."""
    return datetime.now(WIB).replace(tzinfo=None)


def to_naive_utc(dt: datetime | None) -> datetime | None:
    """
    Normalise any datetime to a naive UTC datetime.

    MySQL DATETIME columns have no timezone info — SQLAlchemy may return them as
    either naive (most common) or aware depending on the driver version and column
    definition. Always stripping the tzinfo and treating the value as UTC gives us
    a consistent naive datetime for arithmetic and comparisons.
    """
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def fmt_dt(dt: datetime | None) -> str | None:
    """Format a naive datetime to 'd-m-Y H:i:s', or None."""
    return dt.strftime("%d-%m-%Y %H:%M:%S") if dt else None
