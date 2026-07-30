from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import hash_password, verify_password, create_access_token, revoke_token
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, UserResponse, TokenResponse, MessageResponse
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
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(name=body.name, email=body.email, password=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_response(user, request)


@router.post("/login")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token(user.id, user.role.value)
    return TokenResponse(token=token, user=_user_response(user, request))


@router.post("/logout", response_model=MessageResponse)
def logout(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    _user: User = Depends(get_current_user),
):
    if credentials:
        revoke_token(credentials.credentials)
    return MessageResponse(message="Logged out successfully")


@router.get("/me")
def me(request: Request, user: User = Depends(get_current_user)):
    # Fix #1 — avatar returned as full URL
    return _user_response(user, request)
