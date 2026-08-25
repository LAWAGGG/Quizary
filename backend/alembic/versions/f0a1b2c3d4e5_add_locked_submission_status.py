"""add 'locked' submission status (anti-cheat: menunggu keputusan creator)

Revision ID: a1b2c3d4e5f6
Revises: f8a9b0c1d2e3
Create Date: 2026-08-26
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'f0a1b2c3d4e5'
down_revision: Union[str, Sequence[str], None] = '451229fee869'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ENUM_VALUES = "'in_progress','submitted','auto_submitted','cheating','locked'"


def upgrade() -> None:
    op.execute(f"ALTER TABLE submissions MODIFY status ENUM({ENUM_VALUES}) NOT NULL DEFAULT 'in_progress'")


def downgrade() -> None:
    op.execute("UPDATE submissions SET status='cheating' WHERE status='locked'")
    op.execute(
        "ALTER TABLE submissions MODIFY status ENUM("
        "'in_progress','submitted','auto_submitted','cheating') NOT NULL DEFAULT 'in_progress'"
    )
