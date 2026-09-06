"""add composite indexes fase2

Revision ID: f1527199e451
Revises: d987230c568b
Create Date: 2026-09-06 09:40:48.424867

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f1527199e451'
down_revision: Union[str, Sequence[str], None] = 'd987230c568b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add composite indexes for Fase 2."""
    # ponytail: 10 composite indexes, skip BIGINT type noise from autogenerate
    op.create_index('idx_answers_question', 'answers', ['question_id'], unique=False)
    op.create_index('idx_answers_submission', 'answers', ['submission_id'], unique=False)
    op.create_index('idx_forms_user_category', 'forms', ['user_id', 'category_id'], unique=False)
    op.create_index('idx_forms_user_status', 'forms', ['user_id', 'status'], unique=False)
    op.create_index('idx_forms_user_type', 'forms', ['user_id', 'type'], unique=False)
    op.create_index('idx_questions_form_deleted', 'questions', ['form_id', 'is_deleted'], unique=False)
    op.create_index('idx_questions_group', 'questions', ['group_id'], unique=False)
    op.create_index('idx_questions_section', 'questions', ['section_id'], unique=False)
    op.create_index(op.f('ix_questions_is_deleted'), 'questions', ['is_deleted'], unique=False)
    op.create_index('idx_submissions_form_ip', 'submissions', ['form_id', 'ip_address'], unique=False)
    op.create_index('idx_submissions_form_status', 'submissions', ['form_id', 'status'], unique=False)
    op.create_index('idx_submissions_form_status_ip', 'submissions', ['form_id', 'status', 'ip_address'], unique=False)
    op.create_index('idx_submissions_form_status_user', 'submissions', ['form_id', 'status', 'user_id'], unique=False)
    op.create_index('idx_submissions_ip', 'submissions', ['ip_address'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_submissions_ip', table_name='submissions')
    op.drop_index('idx_submissions_form_status_user', table_name='submissions')
    op.drop_index('idx_submissions_form_status_ip', table_name='submissions')
    op.drop_index('idx_submissions_form_status', table_name='submissions')
    op.drop_index('idx_submissions_form_ip', table_name='submissions')
    op.drop_index(op.f('ix_questions_is_deleted'), table_name='questions')
    op.drop_index('idx_questions_section', table_name='questions')
    op.drop_index('idx_questions_group', table_name='questions')
    op.drop_index('idx_questions_form_deleted', table_name='questions')
    op.drop_index('idx_forms_user_type', table_name='forms')
    op.drop_index('idx_forms_user_status', table_name='forms')
    op.drop_index('idx_forms_user_category', table_name='forms')
    op.drop_index('idx_answers_submission', table_name='answers')
    op.drop_index('idx_answers_question', table_name='answers')
