from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import hash_password, verify_password, create_access_token
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    UserResponse,
    TokenResponse,
    MessageResponse,
)
from app.dependencies import get_current_user

router = APIRouter(tags=["auth"])


@router.post("/register", status_code=201, response_model=UserResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email sudah terdaftar",
        )
    user = User(
        name=body.name,
        email=body.email,
        password=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email atau password salah",
        )
    token = create_access_token(user.id, user.role.value)
    return TokenResponse(token=token, user=user)


@router.post("/logout", response_model=MessageResponse)
def logout(_user: User = Depends(get_current_user)):
    return MessageResponse(message="Logout berhasil")


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return user
