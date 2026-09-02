from sqlalchemy import Column, Integer, BigInteger, String, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class FormCategory(Base):
    __tablename__ = "form_categories"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(50), nullable=False)
    color = Column(String(7), nullable=True)  # hex #RRGGBB optional
    created_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")
    forms = relationship("Form", back_populates="category")

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_category_user_name"),
        Index("idx_category_user", "user_id"),
    )
