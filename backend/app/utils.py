from fastapi import Request


def file_url(request: Request, path: str | None) -> str | None:
    if not path:
        return None
    base = str(request.base_url).rstrip("/")
    return f"{base}/uploads/{path.lstrip('/')}"
