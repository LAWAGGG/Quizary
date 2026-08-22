"""add questions.group_id for story-grouped questions (shuffle as one block)

Revision ID: a9b8c7d6e5f4
Revises: e979eebdb307
Create Date: 2026-08-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a9b8c7d6e5f4'
down_revision: Union[str, Sequence[str], None] = 'e979eebdb307'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('questions', sa.Column('group_id', sa.String(length=36), nullable=True))


def downgrade() -> None:
    op.drop_column('questions', 'group_id')
