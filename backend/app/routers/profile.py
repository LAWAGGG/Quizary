import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, status
from fastapi import Form as FormField
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, verify_form_owner
from app.models.form import Form
from app.models.image import Image
from app.models.question import Question
from app.models.question_option import QuestionOption
from app.models.user import User
from app.schemas.profile import ProfileUpdateRequest
from app.schemas.auth import MessageResponse
from app.utils import file_url

router = APIRouter(tags=["profile & media"])

UPLOAD_DIR = "uploads"


@router.put("/me", response_model=MessageResponse)
def update_profile(body: ProfileUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.name is not None:
        user.name = body.name
    if body.avatar is not None:
        user.avatar = body.avatar
    db.commit()
    return MessageResponse(message="Profil diperbarui")


ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


def _save_upload(file: UploadFile, subdir: str) -> str:
    ext = os.path.splitext(file.filename or ".png")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Format file tidak didukung, gunakan JPG/PNG")
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(UPLOAD_DIR, subdir, filename)
    with open(dest, "wb") as f:
        f.write(file.file.read())
    return f"{subdir}/{filename}"


@router.post("/forms/{form_id}/banner", response_model=dict)
async def upload_banner(
    request: Request,
    banner: UploadFile = File(...),
    form: Form = Depends(verify_form_owner),
    db: Session = Depends(get_db),
):
    path = _save_upload(banner, "banners")
    form.banner_path = path
    form.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Banner diunggah", "banner_path": file_url(request, path)}


def _get_image_owner_id(img: Image, db: Session) -> int | None:
    if img.question_id:
        q = db.get(Question, img.question_id)
        if q:
            f = db.get(Form, q.form_id)
            return f.user_id if f else None
    elif img.option_id:
        opt = db.get(QuestionOption, img.option_id)
        if opt:
            q = db.get(Question, opt.question_id)
            if q:
                f = db.get(Form, q.form_id)
                return f.user_id if f else None
    return None


@router.post("/questions/{question_id}/images", status_code=201)
def add_question_image(
    request: Request,
    question_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    image: UploadFile | None = File(None),
    path: str = FormField(None),
):
    q = db.get(Question, question_id)
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Soal tidak ditemukan")
    f = db.get(Form, q.form_id)
    if not f or f.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Anda bukan pemilik form ini")

    if image:
        file_path = _save_upload(image, "question-images")
    elif path:
        file_path = path
    else:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Kirim file atau field 'path'")

    img = Image(question_id=question_id, path=file_path)
    db.add(img)
    db.commit()
    db.refresh(img)
    return {"id": img.id, "path": file_url(request, img.path), "type": "file" if image else "link"}


@router.post("/options/{option_id}/images", status_code=201)
def add_option_image(
    request: Request,
    option_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    image: UploadFile | None = File(None),
    path: str = FormField(None),
):
    opt = db.get(QuestionOption, option_id)
    if not opt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opsi tidak ditemukan")
    q = db.get(Question, opt.question_id)
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Soal tidak ditemukan")
    f = db.get(Form, q.form_id)
    if not f or f.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Anda bukan pemilik form ini")

    if image:
        file_path = _save_upload(image, "question-images")
    elif path:
        file_path = path
    else:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Kirim file atau field 'path'")

    img = Image(option_id=option_id, path=file_path)
    db.add(img)
    db.commit()
    db.refresh(img)
    return {"id": img.id, "path": file_url(request, img.path), "type": "file" if image else "link"}


@router.delete("/images/{image_id}", response_model=MessageResponse)
def delete_image(
    image_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    img = db.get(Image, image_id)
    if not img:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gambar tidak ditemukan")
    owner_id = _get_image_owner_id(img, db)
    if owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Anda bukan pemilik gambar ini")
    db.delete(img)
    db.commit()
    return MessageResponse(message="Gambar dihapus")
