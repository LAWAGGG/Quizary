from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision: str = 'f06615177f65'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table('users',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(150), nullable=False),
        sa.Column('password', sa.String(255), nullable=False),
        sa.Column('role', sa.Enum('admin', 'user', name='user_role'), nullable=True, server_default='user'),
        sa.Column('avatar', sa.String(255), nullable=True),
        sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('remember_token', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )

    # 2. forms
    op.create_table('forms',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('type', sa.Enum('form', 'quiz', name='form_type'), nullable=True, server_default='form'),
        sa.Column('status', sa.Enum('draft', 'published', 'closed', name='form_status'), nullable=True, server_default='draft'),
        sa.Column('short_code', sa.String(20), nullable=False),
        sa.Column('is_public', sa.Boolean(), nullable=True, server_default=sa.text('1')),
        sa.Column('require_login', sa.Boolean(), nullable=True, server_default=sa.text('0')),
        sa.Column('theme_color', sa.String(20), nullable=True),
        sa.Column('banner_path', sa.String(255), nullable=True),
        sa.Column('thank_you_message', sa.Text(), nullable=True),
        sa.Column('timer_seconds', sa.Integer(), nullable=True),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('shuffle_questions', sa.Boolean(), nullable=True, server_default=sa.text('0')),
        sa.Column('shuffle_options', sa.Boolean(), nullable=True, server_default=sa.text('0')),
        sa.Column('submission_limit', sa.Enum('unlimited', 'once', name='submission_limit'), nullable=True, server_default='unlimited'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('short_code')
    )
    op.create_index('idx_forms_user', 'forms', ['user_id'])

    # 3. questions
    op.create_table('questions',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('form_id', sa.BigInteger(), nullable=False),
        sa.Column('type', sa.Enum('multiple_choice', 'checkbox', 'short_answer', 'essay', name='question_type'), nullable=False),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('points', sa.Integer(), nullable=True, server_default=sa.text('0')),
        sa.Column('order_index', sa.Integer(), nullable=True, server_default=sa.text('0')),
        sa.Column('is_required', sa.Boolean(), nullable=True, server_default=sa.text('1')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['form_id'], ['forms.id'], ondelete='CASCADE')
    )
    op.create_index('idx_questions_form', 'questions', ['form_id'])

    # 4. question_options
    op.create_table('question_options',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('question_id', sa.BigInteger(), nullable=False),
        sa.Column('option_text', sa.Text(), nullable=False),
        sa.Column('is_correct', sa.Boolean(), nullable=True, server_default=sa.text('0')),
        sa.Column('order_index', sa.Integer(), nullable=True, server_default=sa.text('0')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='CASCADE')
    )
    op.create_index('idx_options_question', 'question_options', ['question_id'])

    # 5. submissions
    op.create_table('submissions',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('form_id', sa.BigInteger(), nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=True),
        sa.Column('respondent_name', sa.String(100), nullable=True),
        sa.Column('respondent_email', sa.String(150), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('status', sa.Enum('in_progress', 'submitted', 'auto_submitted', name='submission_status'), nullable=True, server_default='in_progress'),
        sa.Column('score', sa.Numeric(8, 2), nullable=True),
        sa.Column('max_score', sa.Numeric(8, 2), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['form_id'], ['forms.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL')
    )
    op.create_index('idx_submissions_form', 'submissions', ['form_id'])
    op.create_index('idx_submissions_user', 'submissions', ['user_id'])

    # 6. answers
    op.create_table('answers',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('submission_id', sa.BigInteger(), nullable=False),
        sa.Column('question_id', sa.BigInteger(), nullable=False),
        sa.Column('answer_text', sa.Text(), nullable=True),
        sa.Column('is_correct', sa.Boolean(), nullable=True),
        sa.Column('points_earned', sa.Numeric(8, 2), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('submission_id', 'question_id', name='uniq_submission_question')
    )

    # 7. answer_options
    op.create_table('answer_options',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('answer_id', sa.BigInteger(), nullable=False),
        sa.Column('option_id', sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['answer_id'], ['answers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['option_id'], ['question_options.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('answer_id', 'option_id', name='uniq_answer_option')
    )

    # 8. submission_question_order
    op.create_table('submission_question_order',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('submission_id', sa.BigInteger(), nullable=False),
        sa.Column('question_id', sa.BigInteger(), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('submission_id', 'question_id', name='uniq_sub_question')
    )

    # 9. submission_option_order
    op.create_table('submission_option_order',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('submission_id', sa.BigInteger(), nullable=False),
        sa.Column('option_id', sa.BigInteger(), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['option_id'], ['question_options.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('submission_id', 'option_id', name='uniq_sub_option')
    )

    # 10. images
    op.create_table('images',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('question_id', sa.BigInteger(), nullable=True),
        sa.Column('option_id', sa.BigInteger(), nullable=True),
        sa.Column('path', sa.String(255), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=True, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['option_id'], ['question_options.id'], ondelete='CASCADE'),
        sa.CheckConstraint(
            '(question_id IS NOT NULL AND option_id IS NULL) OR (question_id IS NULL AND option_id IS NOT NULL)',
            name='chk_images_owner'
        )
    )
    op.create_index('idx_images_question', 'images', ['question_id'])
    op.create_index('idx_images_option', 'images', ['option_id'])


def downgrade() -> None:
    op.drop_table('images')
    op.drop_table('submission_option_order')
    op.drop_table('submission_question_order')
    op.drop_table('answer_options')
    op.drop_table('answers')
    op.drop_table('submissions')
    op.drop_table('question_options')
    op.drop_table('questions')
    op.drop_table('forms')
    op.drop_table('users')
