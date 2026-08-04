from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Enum as SAEnum, ForeignKey, Index
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class FormType(str, enum.Enum):
    form = "form"
    quiz = "quiz"


class FormStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    closed = "closed"


class SubmissionLimit(str, enum.Enum):
    unlimited = "unlimited"
    once = "once"


class Form(Base):
    __tablename__ = "forms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(SAEnum(FormType), default=FormType.form)
    status = Column(SAEnum(FormStatus), default=FormStatus.draft)
    short_code = Column(String(20), unique=True, nullable=False)
    is_public = Column(Boolean, default=True)
    require_login = Column(Boolean, default=False)
    theme_color = Column(String(20), nullable=True)
    banner_path = Column(String(255), nullable=True)
    thank_you_message = Column(Text, nullable=True)
    timer_seconds = Column(Integer, nullable=True)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    shuffle_questions = Column(Boolean, default=False)
    shuffle_options = Column(Boolean, default=False)
    submission_limit = Column(SAEnum(SubmissionLimit), default=SubmissionLimit.unlimited)
    show_leaderboard = Column(Boolean, default=False)
    is_restricted = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="forms")
    questions = relationship("Question", back_populates="form", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="form", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_forms_user", "user_id"),
    )
