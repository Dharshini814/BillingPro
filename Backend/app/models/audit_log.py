from sqlalchemy import Column, Integer, String, DateTime, JSON
from sqlalchemy.sql import func
from app.database import Base


class AuditLog(Base):

    __tablename__ = "audit_logs"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # User who performed the action
    user_name = Column(
        String,
        nullable=True
    )

    performed_by = Column(
        Integer,
        nullable=True
    )


    # Billing entity details
    entity_type = Column(
        String,
        nullable=False
    )

    entity_id = Column(
        Integer,
        nullable=False
    )


    # Action information
    action = Column(
        String,
        nullable=False
    )

    module = Column(
        String,
        nullable=True
    )

    description = Column(
        String,
        nullable=True
    )


    # Before and after values
    old_value = Column(
        JSON,
        nullable=True
    )

    new_value = Column(
        JSON,
        nullable=True
    )


    # User request information
    ip_address = Column(
        String,
        nullable=True
    )


    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )