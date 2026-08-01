from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Enum as SAEnum, ForeignKey, Index
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class QuestionType(str, enum.Enum):
    multiple_choice = "multiple_choice"
    checkbox = "checkbox"
    short_answer = "short_answer"
    essay = "essay"


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    form_id = Column(Integer, ForeignKey("forms.id", ondelete="CASCADE"), nullable=False)
    type = Column(SAEnum(QuestionType), nullable=False)
    question_text = Column(Text, nullable=False)
    points = Column(Integer, default=0)
    is_scored = Column(Boolean, default=True)
    order_index = Column(Integer, default=0)
    is_required = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)

    form = relationship("Form", back_populates="questions")
    options = relationship("QuestionOption", back_populates="question", cascade="all, delete-orphan")
    images = relationship("Image", back_populates="question", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_questions_form", "form_id"),
    )
