"""add otp fields to users

Revision ID: 9b48e1ba5156
Revises: g1h2i3j4k5l6
Create Date: 2026-09-03 15:59:49.736911

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b48e1ba5156'
down_revision: Union[str, Sequence[str], None] = 'g1h2i3j4k5l6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('otp_code', sa.String(length=64), nullable=True))
    op.add_column('users', sa.Column('otp_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('otp_attempts', sa.Integer(), nullable=True))
    # Grandfather existing accounts: jangan sampai user lama terkunci gara-gara
    # belum pernah verifikasi email.
    op.execute(
        "UPDATE users SET email_verified_at = COALESCE(created_at, NOW()) "
        "WHERE email_verified_at IS NULL"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'otp_attempts')
    op.drop_column('users', 'otp_expires_at')
    op.drop_column('users', 'otp_code')
