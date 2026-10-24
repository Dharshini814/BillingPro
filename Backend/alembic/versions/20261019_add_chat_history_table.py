"""add chat_history table

Revision ID: 20261019_add_chat_history_table
Revises: f0e2d36ea864
Create Date: 2026-10-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261019_add_chat_history_table'
down_revision: Union[str, Sequence[str], None] = 'f0e2d36ea864'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'chat_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('conversation_id', sa.String(36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_chat_history_conversation_id', 'chat_history', ['conversation_id'], unique=False)
    op.create_index('ix_chat_history_user_id', 'chat_history', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_chat_history_user_id', table_name='chat_history')
    op.drop_index('ix_chat_history_conversation_id', table_name='chat_history')
    op.drop_table('chat_history')