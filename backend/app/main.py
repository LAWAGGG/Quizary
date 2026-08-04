import logging
import os

from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, forms, questions, profile, public_access, submissions, results, import_questions

app = FastAPI(title="Quizary API")

logger = logging.getLogger("quizary")

# allow_credentials=False: auth is Bearer-token based (no cookies), so a
# wildcard origin is safe. Wildcard + credentials is rejected by browsers.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(os.path.join(UPLOAD_DIR, "banners"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "question-images"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "avatars"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


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
    )


app.include_router(auth.router, prefix="/api")
app.include_router(forms.router, prefix="/api")
app.include_router(questions.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(public_access.router, prefix="/api")
app.include_router(submissions.router, prefix="/api")
app.include_router(results.router, prefix="/api")
app.include_router(import_questions.router, prefix="/api")
