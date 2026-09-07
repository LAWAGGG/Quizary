"""add last_opened_at to forms

Revision ID: g2h3i4j5k6l7
Revises: f1527199e451
Create Date: 2026-09-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'g2h3i4j5k6l7'
down_revision: Union[str, Sequence[str], None] = 'f1527199e451'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('forms', sa.Column('last_opened_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('idx_forms_user_opened', 'forms', ['user_id', 'last_opened_at'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_forms_user_opened', table_name='forms')
    op.drop_column('forms', 'last_opened_at')