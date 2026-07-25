"""merge migration heads

Revision ID: f0e2d36ea864
Revises: 8f2a9c1d4b3e, a1b2c3d4e5f6
Create Date: 2026-07-19 15:02:36.058753

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f0e2d36ea864'
down_revision: Union[str, Sequence[str], None] = ('8f2a9c1d4b3e', 'a1b2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
