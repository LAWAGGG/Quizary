"""drop is_public — public access is controlled by status alone

Revision ID: e5f6a7b8c9d1
Revises: a4b5c6d7e8f9
Create Date: 2026-08-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e5f6a7b8c9d1'
down_revision: Union[str, Sequence[str], None] = 'a4b5c6d7e8f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('forms', 'is_public')


def downgrade() -> None:
    op.add_column('forms', sa.Column('is_public', sa.Boolean(), nullable=True, server_default=sa.text('1')))