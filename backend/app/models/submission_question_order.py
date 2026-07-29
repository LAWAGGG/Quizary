from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class SubmissionQuestionOrder(Base):
    __tablename__ = "submission_question_order"

    id = Column(Integer, primary_key=True, autoincrement=True)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, nullable=False)

    submission = relationship("Submission", back_populates="question_orders")

    __table_args__ = (
        UniqueConstraint("submission_id", "question_id", name="uniq_sub_question"),
    )
