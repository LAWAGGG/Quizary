"""add forms.reveal_answers to control showing answer review to respondent

Revision ID: d2e3f4g5h6i7
Revises: c1d2e3f4g5h6
Create Date: 2026-08-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd2e3f4g5h6i7'
down_revision: Union[str, Sequence[str], None] = 'c1d2e3f4g5h6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('forms', sa.Column('reveal_answers', sa.Boolean(), nullable=True, server_default=sa.text('1')))
    op.alter_column('forms', 'reveal_answers', existing_type=sa.Boolean(), nullable=False)


def downgrade() -> None:
    op.drop_column('forms', 'reveal_answers')