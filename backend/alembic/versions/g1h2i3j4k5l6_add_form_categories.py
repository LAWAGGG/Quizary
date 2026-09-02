"""add form_categories and category_id to forms

Revision ID: g1h2i3j4k5l6
Revises: f9a8b7c6d5e4
Create Date: 2026-09-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'g1h2i3j4k5l6'
down_revision: Union[str, Sequence[str], None] = 'f9a8b7c6d5e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('form_categories',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('color', sa.String(length=7), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name', name='uq_category_user_name')
    )
    op.create_index('idx_category_user', 'form_categories', ['user_id'], unique=False)

    op.add_column('forms', sa.Column('category_id', sa.BigInteger(), nullable=True))
    op.create_index('idx_forms_category', 'forms', ['category_id'], unique=False)
    op.create_foreign_key('fk_forms_category', 'forms', 'form_categories', ['category_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_forms_category', 'forms', type_='foreignkey')
    op.drop_index('idx_forms_category', table_name='forms')
    op.drop_column('forms', 'category_id')
    op.drop_index('idx_category_user', table_name='form_categories')
    op.drop_table('form_categories')
