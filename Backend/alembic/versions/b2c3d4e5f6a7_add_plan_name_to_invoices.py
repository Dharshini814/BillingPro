"""add plan_name snapshot to invoices

Revision ID: b2c3d4e5f6a7
Revises: f0e2d36ea864
Create Date: 2026-07-22

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'b2c3d4e5f6a7'
down_revision = 'f0e2d36ea864'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [c['name'] for c in inspector.get_columns('invoices')]
    if 'plan_name' not in columns:
        op.add_column('invoices', sa.Column('plan_name', sa.String(), nullable=True))


def downgrade():
    op.drop_column('invoices', 'plan_name')
