from sqlalchemy import Column, Integer, String, DateTime, Index

from app.database import Base


class RevokedToken(Base):
    """JWT yang sudah di-logout (blacklist berbasis DB).

    Tabel DB (bukan memori) supaya revocation tetap efektif lintas worker
    dan tetap hidup setelah restart. Baris expired dibuang saat logout
    berikutnya supaya tabel tidak menumpuk.
    """

    __tablename__ = "revoked_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    jti = Column(String(64), unique=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("idx_revoked_tokens_expires", "expires_at"),
    )
