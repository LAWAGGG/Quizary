"""judul form jadi rich text (HTML) — perbesar kolom

Revision ID: f1a2b3c4d5e6
Revises: f0a1b2c3d4e5
Create Date: 2026-08-26
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'f0a1b2c3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE forms MODIFY title VARCHAR(1000) NOT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE forms MODIFY title VARCHAR(150) NOT NULL")
