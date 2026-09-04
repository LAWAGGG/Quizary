from sqlalchemy import Column, Integer, BigInteger, DateTime, ForeignKey, Index

from app.database import Base


class AiGeneration(Base):
    """Jejak pemakaian generate AI per user (kuota 3/hari).

    Tabel DB (bukan memori) supaya kuota tetap efektif lintas worker
    dan tetap hidup setelah restart. Satu baris = 1x generate/regenerate.
    """

    __tablename__ = "ai_generations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # BigInteger mengikuti tipe aktual users.id di DB (BIGINT).
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("idx_ai_generations_user_created", "user_id", "created_at"),
    )
