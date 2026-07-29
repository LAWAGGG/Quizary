from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class SubmissionOptionOrder(Base):
    __tablename__ = "submission_option_order"

    id = Column(Integer, primary_key=True, autoincrement=True)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False)
    option_id = Column(Integer, ForeignKey("question_options.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, nullable=False)

    submission = relationship("Submission", back_populates="option_orders")

    __table_args__ = (
        UniqueConstraint("submission_id", "option_id", name="uniq_sub_option"),
    )
