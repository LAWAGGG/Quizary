"""add leaderboard, restricted mode & cheating tracking

Revision ID: ac3f11e8d902
Revises: 4d66b8def74b
Create Date: 2026-08-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ac3f11e8d902'
down_revision: Union[str, Sequence[str], None] = '4d66b8def74b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('forms', sa.Column('show_leaderboard', sa.Boolean(), nullable=True, server_default=sa.text('0')))
    op.add_column('forms', sa.Column('is_restricted', sa.Boolean(), nullable=True, server_default=sa.text('0')))
    op.add_column('submissions', sa.Column('tab_exit_count', sa.Integer(), nullable=True, server_default=sa.text('0')))
    # Extend MySQL ENUM with the new `cheating` submission status.
    op.execute(
        "ALTER TABLE submissions MODIFY status "
        "ENUM('in_progress','submitted','auto_submitted','cheating') "
        "DEFAULT 'in_progress'"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE submissions MODIFY status "
        "ENUM('in_progress','submitted','auto_submitted') "
        "DEFAULT 'in_progress'"
    )
    op.drop_column('submissions', 'tab_exit_count')
    op.drop_column('forms', 'is_restricted')
    op.drop_column('forms', 'show_leaderboard')