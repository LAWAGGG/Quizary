"""add forms.reveal_score to control showing final score to respondent

Revision ID: c1d2e3f4g5h6
Revises: b7e9f1c2d3a4
Create Date: 2026-08-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c1d2e3f4g5h6'
down_revision: Union[str, Sequence[str], None] = 'b7e9f1c2d3a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('forms', sa.Column('reveal_score', sa.Boolean(), nullable=True, server_default=sa.text('1')))
    op.alter_column('forms', 'reveal_score', existing_type=sa.Boolean(), nullable=False)


def downgrade() -> None:
    op.drop_column('forms', 'reveal_score')