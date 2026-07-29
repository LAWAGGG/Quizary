from sqlalchemy import Column, Integer, Text, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.database import Base


class QuestionOption(Base):
    __tablename__ = "question_options"

    id = Column(Integer, primary_key=True, autoincrement=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    option_text = Column(Text, nullable=False)
    is_correct = Column(Boolean, default=False)
    order_index = Column(Integer, default=0)

    question = relationship("Question", back_populates="options")
    images = relationship("Image", back_populates="option", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_options_question", "question_id"),
    )
