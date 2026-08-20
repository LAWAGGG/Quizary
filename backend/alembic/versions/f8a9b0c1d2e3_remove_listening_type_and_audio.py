"""remove listening question type, questions.audio_path

Revision ID: f8a9b0c1d2e3
Revises: f7a8b9c0d1e2
Create Date: 2026-08-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f8a9b0c1d2e3'
down_revision: Union[str, Sequence[str], None] = 'f7a8b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE questions MODIFY type ENUM('multiple_choice','checkbox','dropdown',"
        "'short_answer','essay','date','time','file_upload') NOT NULL"
    )
    op.drop_column('questions', 'audio_path')


def downgrade() -> None:
    op.add_column('questions', sa.Column('audio_path', sa.String(255), nullable=True))
    op.execute(
        "ALTER TABLE questions MODIFY type ENUM('multiple_choice','checkbox','dropdown',"
        "'short_answer','essay','date','time','file_upload','listening') NOT NULL"
    )