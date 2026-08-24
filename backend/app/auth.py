from datetime import datetime, timedelta, timezone
import uuid

import bcrypt
import jwt  # PyJWT
from jwt import InvalidTokenError

from app.config import SECRET_KEY

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: int, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        # jti acts as a unique token id so individual tokens can be revoked
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except InvalidTokenError:
        return None


# ── Revocation (DB-backed, aman lintas worker & restart) ─────────────────────

def revoke_token(db, token: str) -> None:
    """Blacklist a token's jti until its natural expiry."""
    from app.models.revoked_token import RevokedToken

    payload = decode_access_token(token)
    jti = payload.get("jti") if payload else None
    if not jti:
        return
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    exp_raw = payload.get("exp")
    expires_at = (
        datetime.fromtimestamp(exp_raw, tz=timezone.utc).replace(tzinfo=None)
        if exp_raw else now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    # Buang baris expired sekalian — tabel tetap ramping tanpa cron.
    db.query(RevokedToken).filter(RevokedToken.expires_at < now).delete()
    if not db.query(RevokedToken.id).filter(RevokedToken.jti == jti).first():
        db.add(RevokedToken(jti=jti, expires_at=expires_at))
    db.commit()


def token_is_revoked(db, payload: dict | None) -> bool:
    from app.models.revoked_token import RevokedToken

    jti = payload.get("jti") if payload else None
    if not jti:
        return False
    return db.query(RevokedToken.id).filter(RevokedToken.jti == jti).first() is not None
