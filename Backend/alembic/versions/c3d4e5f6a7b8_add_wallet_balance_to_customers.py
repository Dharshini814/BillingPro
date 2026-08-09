"""add wallet_balance to customers

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-08-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns('customers')]
    if 'wallet_balance' not in columns:
        op.add_column('customers', sa.Column('wallet_balance', sa.Float(), nullable=False, server_default='0.0'))


def downgrade():
    op.drop_column('customers', 'wallet_balance')
