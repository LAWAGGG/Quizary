from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index, CheckConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, autoincrement=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=True)
    option_id = Column(Integer, ForeignKey("question_options.id", ondelete="CASCADE"), nullable=True)
    path = Column(String(255), nullable=False)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)

    question = relationship("Question", back_populates="images")
    option = relationship("QuestionOption", back_populates="images")

    __table_args__ = (
        Index("idx_images_question", "question_id"),
        Index("idx_images_option", "option_id"),
        CheckConstraint(
            "(question_id IS NOT NULL AND option_id IS NULL) OR (question_id IS NULL AND option_id IS NOT NULL)",
            name="chk_images_owner",
        ),
    )
