import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, verify_form_owner
from app.models.form import Form as FormModel
from app.models.image import Image
from app.models.question import Question
from app.models.question_option import QuestionOption
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.utils import file_url

router = APIRouter(tags=["profile & media"])

UPLOAD_DIR = "uploads"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
ALLOWED_MIMES = {"image/jpeg", "image/png", "image/gif", "image/webp"}


def _save_upload(file: UploadFile, subdir: str) -> str:
    ext = os.path.splitext(file.filename or ".png")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unsupported file format, use JPG/PNG/GIF/WEBP",
        )
    mime = file.content_type
    if mime and mime not in ALLOWED_MIMES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unsupported file format, use JPG/PNG/GIF/WEBP",
        )
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(UPLOAD_DIR, subdir, filename)
    with open(dest, "wb") as f:
        f.write(file.file.read())
    return f"{subdir}/{filename}"


def _delete_file(path: str | None) -> None:
    """Remove a stored file from disk if it exists."""
    if not path:
        return
    # path stored in DB is relative, e.g. "banners/abc.png" or "question-images/xyz.jpg"
    full = os.path.join(UPLOAD_DIR, path.lstrip("/"))
    if os.path.isfile(full):
        os.remove(full)


# ── PUT /me ──────────────────────────────────────────────────────────────────
@router.put("/me", response_model=MessageResponse)
def update_profile(
    request: Request,
    name: str | None = Form(None),
    avatar: UploadFile | None = File(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if name is not None:
        user.name = name
    if avatar is not None:
        old_path = user.avatar
        new_path = _save_upload(avatar, "avatars")
        user.avatar = new_path
        db.commit()
        _delete_file(old_path)
    db.commit()
    return MessageResponse(message="Profile updated")


# ── POST /me/avatar ──────────────────────────────────────────────────────────
@router.post("/me/avatar", response_model=MessageResponse)
def upload_avatar(
    request: Request,
    avatar: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a new avatar image. Old file is deleted from disk."""
    old_path = user.avatar
    new_path = _save_upload(avatar, "avatars")
    user.avatar = new_path
    db.commit()
    # Remove old avatar file after committing
    _delete_file(old_path)
    return MessageResponse(message="Avatar updated")


# ── POST /forms/{form_id}/banner ─────────────────────────────────────────────
@router.post("/forms/{form_id}/banner")
async def upload_banner(
    request: Request,
    banner: UploadFile = File(...),
    form: FormModel = Depends(verify_form_owner),
    db: Session = Depends(get_db),
):
    old_path = form.banner_path
    path = _save_upload(banner, "banners")
    form.banner_path = path
    form.updated_at = datetime.utcnow()
    db.commit()
    _delete_file(old_path)
    return {"message": "Banner uploaded", "banner_path": file_url(request, path)}


# ── POST /questions/{question_id}/images ─────────────────────────────────────
@router.post("/questions/{question_id}/images", status_code=201)
def add_question_image(
    request: Request,
    question_id: int,
    image: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.get(Question, question_id)
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    f = db.get(FormModel, q.form_id)
    if not f or f.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not the owner of this form")

    file_path = _save_upload(image, "question-images")
    img = Image(question_id=question_id, path=file_path, created_at=datetime.utcnow())
    db.add(img)
    db.commit()
    db.refresh(img)
    return {"id": img.id, "path": file_url(request, img.path)}


# ── POST /options/{option_id}/images ─────────────────────────────────────────
@router.post("/options/{option_id}/images", status_code=201)
def add_option_image(
    request: Request,
    option_id: int,
    image: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    opt = db.get(QuestionOption, option_id)
    if not opt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Option not found")
    q = db.get(Question, opt.question_id)
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    f = db.get(FormModel, q.form_id)
    if not f or f.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not the owner of this form")

    file_path = _save_upload(image, "question-images")
    img = Image(option_id=option_id, path=file_path, created_at=datetime.utcnow())
    db.add(img)
    db.commit()
    db.refresh(img)
    return {"id": img.id, "path": file_url(request, img.path)}


# ── DELETE /images/{image_id} ─────────────────────────────────────────────────
@router.delete("/images/{image_id}", response_model=MessageResponse)
def delete_image(
    image_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    img = db.get(Image, image_id)
    if not img:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    # Resolve owner
    owner_id: int | None = None
    if img.question_id:
        q = db.get(Question, img.question_id)
        if q:
            f = db.get(FormModel, q.form_id)
            owner_id = f.user_id if f else None
    elif img.option_id:
        opt = db.get(QuestionOption, img.option_id)
        if opt:
            q = db.get(Question, opt.question_id)
            if q:
                f = db.get(FormModel, q.form_id)
                owner_id = f.user_id if f else None

    if owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not the owner of this image")

    stored_path = img.path
    db.delete(img)
    db.commit()

    # Fix #7 — delete physical file from disk
    _delete_file(stored_path)

    return MessageResponse(message="Image deleted")
