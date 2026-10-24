"""
Webhook event deduplication model.
Stores processed webhook events to prevent duplicate handling
of the same event (idempotent webhook processing).
"""

from sqlalchemy import Column, Integer, String, DateTime, JSON
from sqlalchemy.sql import func

from app.database import Base


class WebhookEvent(Base):

    __tablename__ = "webhook_events"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # Unique event identifier — used for deduplication
    event_id = Column(
        String,
        unique=True,
        nullable=False,
        index=True
    )

    event_type = Column(
        String,
        nullable=False
    )

    # Source gateway identifier (e.g. 'mock_gateway', 'stripe')
    source = Column(
        String,
        nullable=True,
        default="mock_gateway"
    )

    # Full event payload for debugging and reconciliation
    payload = Column(
        JSON,
        nullable=True
    )

    # processing status: processed, failed, ignored
    status = Column(
        String,
        default="processed"
    )

    processed_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )
