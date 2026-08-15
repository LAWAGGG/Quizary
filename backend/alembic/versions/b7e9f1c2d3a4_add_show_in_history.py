"""add forms.show_in_history to hide a form from respondent submission history

Revision ID: b7e9f1c2d3a4
Revises: a1b2c3d4e5f6
Create Date: 2026-08-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7e9f1c2d3a4'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('forms', sa.Column('show_in_history', sa.Boolean(), nullable=True, server_default=sa.text('1')))
    op.alter_column('forms', 'show_in_history', existing_type=sa.Boolean(), nullable=False)


def downgrade() -> None:
    op.drop_column('forms', 'show_in_history')
