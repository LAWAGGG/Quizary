from datetime import datetime, timezone
from fastapi import Request


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
    """Format a datetime to 'd-m-Y H:i:s' string, or None."""
    return dt.strftime("%d-%m-%Y %H:%M:%S") if dt else None
