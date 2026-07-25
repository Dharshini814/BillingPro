"""fix audit_logs columns to match AuditLog model

Revision ID: 8f2a9c1d4b3e
Revises: 435919228931
Create Date: 2026-07-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8f2a9c1d4b3e'
down_revision: Union[str, Sequence[str], None] = '435919228931'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add columns the model expects but that were never migrated in
    op.add_column('audit_logs', sa.Column('module', sa.String(), nullable=True))
    op.add_column('audit_logs', sa.Column('user_name', sa.String(), nullable=True))
    op.add_column('audit_logs', sa.Column('ip_address', sa.String(), nullable=True))

    # performed_by was created as a required String; the model now treats it
    # as an optional Integer and the app never sets it, so it must be
    # nullable (and typed as Integer) or every insert will fail.
    op.alter_column(
        'audit_logs', 'performed_by',
        existing_type=sa.String(),
        type_=sa.Integer(),
        postgresql_using='performed_by::integer',
        nullable=True,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        'audit_logs', 'performed_by',
        existing_type=sa.Integer(),
        type_=sa.String(),
        postgresql_using='performed_by::varchar',
        nullable=False,
    )
    op.drop_column('audit_logs', 'ip_address')
    op.drop_column('audit_logs', 'user_name')
    op.drop_column('audit_logs', 'module')
