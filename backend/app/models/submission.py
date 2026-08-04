from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Enum as SAEnum, ForeignKey, Index, Numeric
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class SubmissionStatus(str, enum.Enum):
    in_progress = "in_progress"
    submitted = "submitted"
    auto_submitted = "auto_submitted"
    cheating = "cheating"


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    form_id = Column(Integer, ForeignKey("forms.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    respondent_name = Column(String(100), nullable=True)
    respondent_email = Column(String(150), nullable=True)
    ip_address = Column(String(45), nullable=True)
    status = Column(SAEnum(SubmissionStatus), default=SubmissionStatus.in_progress)
    tab_exit_count = Column(Integer, default=0)
    cheat_reason = Column(String(255), nullable=True)
    score = Column(Numeric(8, 2), nullable=True)
    max_score = Column(Numeric(8, 2), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)

    form = relationship("Form", back_populates="submissions")
    user = relationship("User", back_populates="submissions")
    answers = relationship("Answer", back_populates="submission", cascade="all, delete-orphan")
    question_orders = relationship("SubmissionQuestionOrder", back_populates="submission", cascade="all, delete-orphan")
    option_orders = relationship("SubmissionOptionOrder", back_populates="submission", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_submissions_form", "form_id"),
        Index("idx_submissions_user", "user_id"),
    )
