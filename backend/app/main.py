import logging
import os
import re

from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, forms, questions, profile, public_access, submissions, results, import_questions

app = FastAPI(title="Quizary API")

logger = logging.getLogger("quizary")

_CORS_ORIGIN_RE = re.compile(r"^https://[a-z0-9-]+\.trycloudflare\.com$")
_CORS_LAN_RE = re.compile(r"^https?://(192\.168|10\.|172\.(1[6-9]|2[0-9]|3[0-1]))\.\d{1,3}\.\d{1,3}(:\d+)?$")
_CORS_STATIC_ORIGINS = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "exp://localhost:8081",
    "exp://127.0.0.1:8081",
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(_CORS_STATIC_ORIGINS),
    allow_origin_regex=r"https://.*\.trycloudflare\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _cors_headers(request: Request) -> dict[str, str]:
    """Keep CORS on errors too.

    Starlette's exception middleware can turn an unhandled exception into a
    response outside CORSMiddleware. Without this header, browsers report a
    misleading CORS failure and hide the actual HTTP 500 payload.
    """
    origin = request.headers.get("origin", "")
    if origin in _CORS_STATIC_ORIGINS or _CORS_ORIGIN_RE.fullmatch(origin) or _CORS_LAN_RE.fullmatch(origin):
        return {"Access-Control-Allow-Origin": origin, "Vary": "Origin"}
    return {}
        
UPLOAD_DIR = "uploads"
os.makedirs(os.path.join(UPLOAD_DIR, "banners"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "question-images"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "avatars"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.middleware("http")
async def security_headers(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        loc = err.get("loc", [])
        field = ".".join(str(x) for x in loc[1:]) if len(loc) > 1 else "_schema"
        msg = err.get("msg", "Invalid value")
        if err.get("type") == "value_error" and "ctx" in err and "error" in err["ctx"]:
            msg = str(err["ctx"]["error"])
        errors.append({field: msg})
    return JSONResponse(
        status_code=422,
        content={"message": "Invalid fields", "errors": errors},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": exc.detail},
    )


@app.exception_handler(Exception)
async def catch_all_handler(request: Request, exc: Exception):
    # Log full trace server-side; never leak internals (paths, SQL, stack) to clients.
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"message": "Internal server error"},
        headers=_cors_headers(request),
    )


app.include_router(auth.router, prefix="/api")
app.include_router(forms.router, prefix="/api")
app.include_router(questions.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(public_access.router, prefix="/api")
app.include_router(submissions.router, prefix="/api")
app.include_router(results.router, prefix="/api")
app.include_router(import_questions.router, prefix="/api")
