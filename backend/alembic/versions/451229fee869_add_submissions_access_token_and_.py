"""add submissions access_token and revoked_tokens

Revision ID: 451229fee869
Revises: a9b8c7d6e5f4
Create Date: 2026-08-24 13:51:14.958512

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '451229fee869'
down_revision: Union[str, Sequence[str], None] = 'a9b8c7d6e5f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('revoked_tokens',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('jti', sa.String(length=64), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('jti')
    )
    op.create_index('idx_revoked_tokens_expires', 'revoked_tokens', ['expires_at'], unique=False)
    op.add_column('submissions', sa.Column('access_token', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_submissions_access_token'), 'submissions', ['access_token'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_submissions_access_token'), table_name='submissions')
    op.drop_column('submissions', 'access_token')
    op.drop_index('idx_revoked_tokens_expires', table_name='revoked_tokens')
    op.drop_table('revoked_tokens')
