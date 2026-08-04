"""add cheat_reason to track what triggered the anti-cheat flag

Revision ID: a1b2c3d4e5f6
Revises: ac3f11e8d902
Create Date: 2026-08-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'ac3f11e8d902'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('submissions', sa.Column('cheat_reason', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('submissions', 'cheat_reason')