"""add sections, new question types, answer_file

Revision ID: a4b5c6d7e8f9
Revises: ac3f11e8d902
Create Date: 2026-08-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision: str = 'a4b5c6d7e8f9'
down_revision: Union[str, Sequence[str], None] = 'd2e3f4g5h6i7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

Q_TYPE_ENUM = (
    'multiple_choice', 'checkbox', 'dropdown', 'short_answer',
    'essay', 'date', 'time', 'file_upload',
)


def upgrade() -> None:
    # 1. sections table
    op.create_table(
        'sections',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('form_id', sa.BigInteger(), nullable=False),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_sections_form', 'sections', ['form_id'])

    # 2. questions.section_id + extend type enum
    op.add_column('questions', sa.Column('section_id', sa.BigInteger(), nullable=True))
    op.create_foreign_key('fk_questions_section', 'questions', 'sections', ['section_id'], ['id'], ondelete='SET NULL')
    op.execute(
        "ALTER TABLE questions MODIFY type ENUM('multiple_choice','checkbox','dropdown',"
        "'short_answer','essay','date','time','file_upload') NOT NULL"
    )

    # 3. answers.answer_file
    op.add_column('answers', sa.Column('answer_file', sa.String(255), nullable=True))


def downgrade() -> None:
    op.execute(
        "ALTER TABLE questions MODIFY type ENUM('multiple_choice','checkbox','short_answer','essay') NOT NULL"
    )
    op.drop_constraint('fk_questions_section', 'questions', type_='foreignkey')
    op.drop_column('questions', 'section_id')
    op.drop_column('answers', 'answer_file')
    op.drop_index('idx_sections_form', table_name='sections')
    op.drop_table('sections')
