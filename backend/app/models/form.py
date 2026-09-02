from sqlalchemy import Column, Integer, BigInteger, String, Text, Boolean, DateTime, Enum as SAEnum, ForeignKey, Index
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class FormType(str, enum.Enum):
    form = "form"
    quiz = "quiz"


class DisplayStyle(str, enum.Enum):
    card = "card"
    quiz = "quiz"


class FormStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    closed = "closed"


class SubmissionLimit(str, enum.Enum):
    unlimited = "unlimited"
    once = "once"


class ScoringMode(str, enum.Enum):
    """Quiz point allocation strategy.

    auto keeps the 100-point pool balanced by the points service; manual keeps
    creator-entered points and normalizes the final result to 100.
    """
    auto = "auto"
    manual = "manual"


class Form(Base):
    __tablename__ = "forms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(SAEnum(FormType), default=FormType.form)
    display_style = Column(SAEnum(DisplayStyle), default=DisplayStyle.card)
    status = Column(SAEnum(FormStatus), default=FormStatus.draft)
    short_code = Column(String(20), unique=True, nullable=False)
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
    show_in_history = Column(Boolean, default=True)
    reveal_score = Column(Boolean, default=True)
    reveal_answers = Column(Boolean, default=True)
    scoring_mode = Column(SAEnum(ScoringMode), default=ScoringMode.auto, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)

    category_id = Column(BigInteger, ForeignKey("form_categories.id", ondelete="SET NULL"), nullable=True)

    user = relationship("User", back_populates="forms")
    category = relationship("FormCategory", back_populates="forms")
    questions = relationship("Question", back_populates="form", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="form", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_forms_user", "user_id"),
        Index("idx_forms_category", "category_id"),
    )
