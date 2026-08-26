"""add password question type

Revision ID: e5b441637e7c
Revises: f1a2b3c4d5e6
Create Date: 2026-08-26 18:26:29.107532

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = 'e5b441637e7c'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('questions', sa.Column('password_keyword', sa.String(length=255), nullable=True))
    op.alter_column('questions', 'type',
               existing_type=mysql.ENUM('multiple_choice', 'checkbox', 'dropdown', 'short_answer', 'essay', 'date', 'time', 'file_upload'),
               type_=sa.Enum('multiple_choice', 'checkbox', 'dropdown', 'short_answer', 'essay', 'password', 'date', 'time', 'file_upload', name='questiontype'),
               existing_nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('questions', 'type',
               existing_type=sa.Enum('multiple_choice', 'checkbox', 'dropdown', 'short_answer', 'essay', 'password', 'date', 'time', 'file_upload', name='questiontype'),
               type_=mysql.ENUM('multiple_choice', 'checkbox', 'dropdown', 'short_answer', 'essay', 'date', 'time', 'file_upload'),
               existing_nullable=False)
    op.drop_column('questions', 'password_keyword')
