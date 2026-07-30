from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt, JWTError

from app.config import SECRET_KEY

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

# In-memory token blacklist — holds revoked JTIs until they expire naturally.
# For multi-process deployments swap this for a Redis set.
_revoked_tokens: set[str] = set()


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
        "jti": f"{user_id}-{now.timestamp()}",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        jti = payload.get("jti")
        if jti and jti in _revoked_tokens:
            return None
        return payload
    except JWTError:
        return None


def revoke_token(token: str) -> None:
    """Add this token's jti to the blacklist."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        jti = payload.get("jti")
        if jti:
            _revoked_tokens.add(jti)
    except JWTError:
        pass
