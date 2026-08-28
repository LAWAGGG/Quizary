"""add quiz scoring mode (auto/manual)"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "e5b441637e7c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "forms",
        sa.Column(
            "scoring_mode",
            sa.Enum("auto", "manual", name="scoringmode"),
            nullable=False,
            server_default="auto",
        ),
    )


def downgrade() -> None:
    op.drop_column("forms", "scoring_mode")
