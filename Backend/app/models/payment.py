from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Payment(Base):

    __tablename__ = "payments"


    id = Column(
        Integer,
        primary_key=True,
        index=True
    )


    invoice_id = Column(
        Integer,
        ForeignKey("invoices.id"),
        nullable=False
    )


    payment_reference = Column(
        String,
        unique=True,
        nullable=False
    )


    amount = Column(
        Float,
        nullable=False
    )


    payment_method = Column(
        String,
        nullable=False
    )


    status = Column(
        String,
        nullable=False,
        default="pending"
    )


    payment_date = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )


    # Idempotency key to prevent duplicate payment processing (Phase 1)
    idempotency_key = Column(
        String,
        unique=True,
        nullable=True,
        index=True
    )


    invoice = relationship(
        "Invoice",
        back_populates="payments"
    )
    