"""add datetime question type

Revision ID: f9a8b7c6d5e4
Revises: f8a9b0c1d2e3
Create Date: 2026-09-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision: str = 'f9a8b7c6d5e4'
down_revision: Union[str, Sequence[str], None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('questions', 'type',
               existing_type=mysql.ENUM('multiple_choice', 'checkbox', 'dropdown', 'short_answer', 'essay', 'password', 'date', 'time', 'file_upload'),
               type_=sa.Enum('multiple_choice', 'checkbox', 'dropdown', 'short_answer', 'essay', 'password', 'date', 'time', 'datetime', 'file_upload', name='questiontype'),
               existing_nullable=False)


def downgrade() -> None:
    op.alter_column('questions', 'type',
               existing_type=sa.Enum('multiple_choice', 'checkbox', 'dropdown', 'short_answer', 'essay', 'password', 'date', 'time', 'datetime', 'file_upload', name='questiontype'),
               type_=mysql.ENUM('multiple_choice', 'checkbox', 'dropdown', 'short_answer', 'essay', 'password', 'date', 'time', 'file_upload'),
               existing_nullable=False)
