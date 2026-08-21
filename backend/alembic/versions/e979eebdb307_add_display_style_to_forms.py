"""add display_style to forms

Revision ID: e979eebdb307
Revises: f8a9b0c1d2e3
Create Date: 2026-08-21 11:29:11.434898

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e979eebdb307'
down_revision: Union[str, Sequence[str], None] = 'f8a9b0c1d2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('forms', sa.Column('display_style', sa.Enum('card', 'quiz', name='display_style_enum'), nullable=True, server_default='card'))


def downgrade() -> None:
    op.drop_column('forms', 'display_style')