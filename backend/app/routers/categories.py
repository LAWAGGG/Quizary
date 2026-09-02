from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.dependencies import get_current_user
from app.models.form import Form
from app.models.form_category import FormCategory
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.utils import fmt_dt, now_wib

router = APIRouter(tags=["categories"])


def _to_response(cat: FormCategory, count: int = 0) -> dict:
    return {
        "id": cat.id,
        "name": cat.name,
        "color": cat.color,
        "form_count": count,
        "created_at": fmt_dt(cat.created_at),
        "updated_at": fmt_dt(cat.updated_at),
    }


@router.get("/categories", response_model=list[CategoryResponse])
def list_categories(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cats = db.query(FormCategory).filter(FormCategory.user_id == user.id).order_by(FormCategory.name.asc()).all()
    if not cats:
        return []
    # count forms per category in one query
    rows = (
        db.query(Form.category_id, func.count(Form.id))
        .filter(Form.user_id == user.id, Form.category_id.in_([c.id for c in cats]))
        .group_by(Form.category_id)
        .all()
    )
    count_map = {cid: n for cid, n in rows}
    return [_to_response(c, count_map.get(c.id, 0)) for c in cats]


@router.post("/categories", status_code=201, response_model=CategoryResponse)
def create_category(
    body: CategoryCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # unique per user (case-insensitive check)
    exists = db.query(FormCategory).filter(
        FormCategory.user_id == user.id,
        func.lower(FormCategory.name) == body.name.lower(),
    ).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Nama kategori sudah ada")

    now = now_wib()
    cat = FormCategory(
        user_id=user.id,
        name=body.name.strip(),
        color=body.color,
        created_at=now,
        updated_at=now,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return _to_response(cat, 0)


@router.put("/categories/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    body: CategoryUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cat = db.get(FormCategory, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
    if cat.user_id != user.id:
        raise HTTPException(status_code=403, detail="Anda bukan pemilik kategori ini")

    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        new_name = data["name"].strip()
        # check duplicate excluding self
        dup = db.query(FormCategory).filter(
            FormCategory.user_id == user.id,
            func.lower(FormCategory.name) == new_name.lower(),
            FormCategory.id != cat.id,
        ).first()
        if dup:
            raise HTTPException(status_code=409, detail="Nama kategori sudah ada")
        cat.name = new_name
    if "color" in data:
        cat.color = data["color"]

    cat.updated_at = now_wib()
    db.commit()
    db.refresh(cat)
    cnt = db.query(func.count(Form.id)).filter(Form.category_id == cat.id).scalar() or 0
    return _to_response(cat, cnt)


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cat = db.get(FormCategory, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
    if cat.user_id != user.id:
        raise HTTPException(status_code=403, detail="Anda bukan pemilik kategori ini")

    # forms.category_id SET NULL via FK, but ensure explicit null first for clarity
    db.query(Form).filter(Form.category_id == cat.id).update({"category_id": None})
    db.delete(cat)
    db.commit()
    return {"message": "Kategori berhasil dihapus"}
