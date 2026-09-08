from dotenv import load_dotenv
import os

load_dotenv()


def _secret_or_env(name: str, default: str = "") -> str:
    # Docker secrets: read from file if *_FILE env var exists
    file_key = f"{name}_FILE"
    file_path = os.getenv(file_key)
    if file_path and os.path.isfile(file_path):
        with open(file_path, "r") as f:
            return f.read().strip()
    return os.getenv(name, default)


DB_USER = _secret_or_env("DB_USER")
DB_PASSWORD = _secret_or_env("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
SECRET_KEY = _secret_or_env("SECRET_KEY")

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = _secret_or_env("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)


def get_smtp_config() -> dict[str, str | int]:
    """Baca SMTP config fresh per-request (hot-reload .env tanpa restart).

    load_dotenv(override=True) memuat ulang file .env yang barusan di-edit
    user agar ganti akun langsung terbaca tanpa restart. Cache lama di
    modul (SMTP_USER dll) tetap ada untuk kompatibilitas, tapi pengirim
    email WAJIB pakai fungsi ini.
    """
    load_dotenv(override=True)
    host = os.getenv("SMTP_HOST", "")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "")
    # SMTP_PASSWORD bisa via file secret
    pwd = _secret_or_env("SMTP_PASSWORD")
    from_addr = os.getenv("SMTP_FROM", user)
    return {"host": host, "port": port, "user": user, "password": pwd, "from": from_addr}

GEMINI_API_KEY = _secret_or_env("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
GEMINI_FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-3.5-flash-lite")

required = {"DB_USER": DB_USER, "DB_HOST": DB_HOST, "DB_PORT": DB_PORT, "DB_NAME": DB_NAME, "SECRET_KEY": SECRET_KEY}
missing = [k for k, v in required.items() if not v]
if missing:
    raise RuntimeError(f"Missing env vars: {', '.join(missing)}. Check .env file.")

if len(SECRET_KEY) < 32:
    raise RuntimeError("SECRET_KEY must be at least 32 characters long")

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
