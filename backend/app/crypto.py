import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import SECRET_KEY


def _fernet() -> Fernet:
    digest = hashlib.sha256(SECRET_KEY.encode()).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_gemini_key(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt_gemini_key(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as e:
        raise ValueError("decrypt failed") from e


def mask_key(plain: str) -> str:
    s = plain.strip()
    if len(s) <= 4:
        return "••••"
    return "••••" + s[-4:]
