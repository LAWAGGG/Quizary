from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import hash_password, verify_password, create_access_token, revoke_token
from app.models.user import User
from app.ratelimit import limit_login, limit_register
from app.schemas.auth import RegisterRequest, LoginRequest, UserResponse, TokenResponse, MessageResponse, PasswordUpdateRequest
from app.dependencies import get_current_user, security
from app.utils import file_url

router = APIRouter(tags=["auth"])


def _user_response(user: User, request: Request) -> UserResponse:
    """Build UserResponse with avatar resolved to a full URL."""
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role.value,
        avatar=file_url(request, user.avatar),
    )


@router.post("/register", status_code=201)
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db), _rl: None = Depends(limit_register)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(name=body.name, email=body.email, password=hash_password(body.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Race: dua register email sama bersamaan — unique constraint menangkapnya.
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    db.refresh(user)
    token = create_access_token(user.id, user.role.value)
    return {"token": token, "user": _user_response(user, request).model_dump()}


@router.post("/login")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db), _rl: None = Depends(limit_login)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token(user.id, user.role.value)
    return TokenResponse(token=token, user=_user_response(user, request))


@router.post("/logout", response_model=MessageResponse)
def logout(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if credentials:
        revoke_token(db, credentials.credentials)
    return MessageResponse(message="Logged out successfully")


@router.get("/me")
def me(request: Request, user: User = Depends(get_current_user)):
    # Fix #1 — avatar returned as full URL
    return _user_response(user, request)


@router.put("/me/password", status_code=200, response_model=MessageResponse)
def update_password(
    body: PasswordUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.old_password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Old password is incorrect")
    user.password = hash_password(body.new_password)
    db.commit()
    return MessageResponse(message="Password updated successfully")
