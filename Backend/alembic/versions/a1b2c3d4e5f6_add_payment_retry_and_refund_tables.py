"""add payment_retry and refund tables

Revision ID: a1b2c3d4e5f6
Revises: 
Create Date: 2025-07-18

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'a1b2c3d4e5f6'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    existing = inspector.get_table_names()

    if 'payment_retries' not in existing:
        op.create_table(
            'payment_retries',
            sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
            sa.Column('payment_id', sa.Integer(), sa.ForeignKey('payments.id'), nullable=False),
            sa.Column('invoice_id', sa.Integer(), sa.ForeignKey('invoices.id'), nullable=False),
            sa.Column('attempt_number', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('scheduled_date', sa.Date(), nullable=False),
            sa.Column('status', sa.String(), nullable=False, server_default='pending'),
            sa.Column('attempted_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    if 'refunds' not in existing:
        op.create_table(
            'refunds',
            sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
            sa.Column('refund_reference', sa.String(), nullable=False, unique=True),
            sa.Column('payment_id', sa.Integer(), sa.ForeignKey('payments.id'), nullable=False),
            sa.Column('invoice_id', sa.Integer(), sa.ForeignKey('invoices.id'), nullable=False),
            sa.Column('customer_id', sa.Integer(), sa.ForeignKey('customers.id'), nullable=False),
            sa.Column('paid_amount', sa.Float(), nullable=False),
            sa.Column('refund_amount', sa.Float(), nullable=False),
            sa.Column('reason', sa.Text(), nullable=True),
            sa.Column('status', sa.String(), nullable=False, server_default='completed'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade():
    op.drop_table('refunds')
    op.drop_table('payment_retries')
