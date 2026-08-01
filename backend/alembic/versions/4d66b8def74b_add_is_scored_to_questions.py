"""add is_scored to questions

Revision ID: 4d66b8def74b
Revises: f06615177f65
Create Date: 2026-08-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '4d66b8def74b'
down_revision: Union[str, Sequence[str], None] = 'f06615177f65'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('questions', sa.Column('is_scored', sa.Boolean(), nullable=True, server_default=sa.text('1')))


def downgrade() -> None:
    op.drop_column('questions', 'is_scored')
