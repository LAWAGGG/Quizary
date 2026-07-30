from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL)

# Force every connection to use UTC as session timezone.
# This ensures MySQL DATETIME reads/writes are consistent with Python's
# datetime.utcnow() — prevents off-by-N-hours bugs when server OS is
# in a non-UTC timezone (e.g. WIB = UTC+7).
@event.listens_for(engine, "connect")
def _set_utc(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("SET time_zone = '+00:00'")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()