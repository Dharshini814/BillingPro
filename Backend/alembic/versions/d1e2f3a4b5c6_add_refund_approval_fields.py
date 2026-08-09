"""add refund approval fields

Revision ID: d1e2f3a4b5c6
Revises: a1b2c3d4e5f6
Create Date: 2026-08-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'd1e2f3a4b5c6'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)

    # Add requested_by column if it doesn't exist
    existing_cols = [c['name'] for c in inspector.get_columns('refunds')]
    if 'requested_by' not in existing_cols:
        op.add_column(
            'refunds',
            sa.Column('requested_by', sa.String(), nullable=True, server_default='user')
        )


def downgrade():
    op.drop_column('refunds', 'requested_by')
