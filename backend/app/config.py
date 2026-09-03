from dotenv import load_dotenv
import os

load_dotenv()

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
SECRET_KEY = os.getenv("SECRET_KEY")

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)

required = {"DB_USER": DB_USER, "DB_HOST": DB_HOST, "DB_PORT": DB_PORT, "DB_NAME": DB_NAME, "SECRET_KEY": SECRET_KEY}
missing = [k for k, v in required.items() if not v]
if missing:
    raise RuntimeError(f"Missing env vars: {', '.join(missing)}. Check .env file.")

if len(SECRET_KEY) < 32:
    # JWT HS256 dengan secret pendek bisa di-brute-force dari token yang bocor.
    raise RuntimeError("SECRET_KEY must be at least 32 characters long")

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
