"""add gemini_key_encrypted to users (BYOK)

Revision ID: h3i4j5k6l7m8
Revises: g2h3i4j5k6l7
Create Date: 2026-09-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'h3i4j5k6l7m8'
down_revision: Union[str, Sequence[str], None] = 'g2h3i4j5k6l7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('gemini_key_encrypted', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'gemini_key_encrypted')
