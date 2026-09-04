"""jejak pemakaian generate AI per user (kuota 3/hari)

Revision ID: c8d9e0f1a2b3
Revises: 9b48e1ba5156
Create Date: 2026-09-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c8d9e0f1a2b3'
down_revision: Union[str, Sequence[str], None] = '9b48e1ba5156'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ai_generations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_ai_generations_user_created', 'ai_generations', ['user_id', 'created_at'])


def downgrade() -> None:
    op.drop_index('idx_ai_generations_user_created', table_name='ai_generations')
    op.drop_table('ai_generations')
