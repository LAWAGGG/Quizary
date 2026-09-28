"""backfill users created_at

Revision ID: j5k6l7m8n9o0
Revises: i4j5k6l7m8n9
Create Date: 2026-09-28

User register lama tidak isi created_at/updated_at (NULL) sehingga
kolom Created di admin panel tampil '-'. Backfill dari timestamp
lain yang ada, fallback ke NOW().
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'j5k6l7m8n9o0'
down_revision: Union[str, Sequence[str], None] = 'i4j5k6l7m8n9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE users SET created_at = COALESCE(email_verified_at, updated_at, NOW()) "
        "WHERE created_at IS NULL"
    )
    op.execute(
        "UPDATE users SET updated_at = COALESCE(updated_at, created_at, NOW()) "
        "WHERE updated_at IS NULL"
    )


def downgrade() -> None:
    pass
