from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Refund(Base):
    __tablename__ = "refunds"

    id = Column(Integer, primary_key=True, index=True)

    refund_reference = Column(String, unique=True, nullable=False)

    payment_id = Column(
        Integer,
        ForeignKey("payments.id"),
        nullable=False
    )

    invoice_id = Column(
        Integer,
        ForeignKey("invoices.id"),
        nullable=False
    )

    customer_id = Column(
        Integer,
        ForeignKey("customers.id"),
        nullable=False
    )

    paid_amount = Column(Float, nullable=False)
    refund_amount = Column(Float, nullable=False)

    reason = Column(Text, nullable=True)

    # Status lifecycle:
    # pending_approval → completed  (admin approves)
    # pending_approval → rejected   (admin rejects)
    # completed (direct admin-issued refund)
    # failed
    status = Column(
        String,
        nullable=False,
        default="pending_approval"
    )

    # Who requested: "user" | "admin"
    requested_by = Column(String, nullable=True, default="user")

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    # Relationships
    payment = relationship("Payment", foreign_keys=[payment_id])
    invoice = relationship("Invoice", foreign_keys=[invoice_id])
    customer = relationship("Customer", foreign_keys=[customer_id])
