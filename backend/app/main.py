import os

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.routers import auth, forms, questions, profile, public_access, submissions, results, import_questions

app = FastAPI(title="Quizary API")

UPLOAD_DIR = "uploads"
os.makedirs(os.path.join(UPLOAD_DIR, "banners"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "question-images"), exist_ok=True)
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
        content={"message": "Validasi gagal", "errors": errors},
    )


app.include_router(auth.router, prefix="/api")
app.include_router(forms.router, prefix="/api")
app.include_router(questions.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(public_access.router, prefix="/api")
app.include_router(submissions.router, prefix="/api")
app.include_router(results.router, prefix="/api")
app.include_router(import_questions.router, prefix="/api")
