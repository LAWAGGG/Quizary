from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class AnswerOption(Base):
    __tablename__ = "answer_options"

    id = Column(Integer, primary_key=True, autoincrement=True)
    answer_id = Column(Integer, ForeignKey("answers.id", ondelete="CASCADE"), nullable=False)
    option_id = Column(Integer, ForeignKey("question_options.id", ondelete="CASCADE"), nullable=False)

    answer = relationship("Answer", back_populates="selected_options")

    __table_args__ = (
        UniqueConstraint("answer_id", "option_id", name="uniq_answer_option"),
    )
