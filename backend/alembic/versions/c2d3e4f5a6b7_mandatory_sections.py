"""mandatory sections: reassign unassigned questions to Default section"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, Sequence[str], None] = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Find forms that have unassigned questions (section_id IS NULL)
    forms_with_unassigned = conn.execute(
        sa.text("SELECT DISTINCT form_id FROM questions WHERE section_id IS NULL")
    ).fetchall()

    for (form_id,) in forms_with_unassigned:
        # Check if a "Default" section already exists for this form
        existing = conn.execute(
            sa.text("SELECT id FROM sections WHERE form_id = :fid AND title = 'Default'"),
            {"fid": form_id},
        ).fetchone()

        if existing:
            section_id = existing[0]
        else:
            # Create "Default" section
            conn.execute(
                sa.text(
                    "INSERT INTO sections (form_id, title, order_index, created_at) "
                    "VALUES (:fid, 'Default', 0, NOW())"
                ),
                {"fid": form_id},
            )
            section_id = conn.execute(sa.text("SELECT LAST_INSERT_ID()")).scalar()

        # Reassign unassigned questions to this section
        conn.execute(
            sa.text("UPDATE questions SET section_id = :sid WHERE form_id = :fid AND section_id IS NULL"),
            {"sid": section_id, "fid": form_id},
        )


def downgrade() -> None:
    # Set section_id back to NULL for questions in "Default" sections
    conn = op.get_bind()
    conn.execute(sa.text("UPDATE questions SET section_id = NULL WHERE section_id IN (SELECT id FROM sections WHERE title = 'Default')"))
    conn.execute(sa.text("DELETE FROM sections WHERE title = 'Default'"))
