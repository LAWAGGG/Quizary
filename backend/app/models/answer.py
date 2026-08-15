from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    answer_text = Column(Text, nullable=True)
    answer_file = Column(String(255), nullable=True)
    is_correct = Column(Boolean, nullable=True)
    points_earned = Column(Numeric(8, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)

    submission = relationship("Submission", back_populates="answers")
    selected_options = relationship("AnswerOption", back_populates="answer", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("submission_id", "question_id", name="uniq_submission_question"),
    )
