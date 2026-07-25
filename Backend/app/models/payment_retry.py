from sqlalchemy import Column, Integer, Float, String, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class PaymentRetry(Base):
    __tablename__ = "payment_retries"

    id = Column(Integer, primary_key=True, index=True)

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

    attempt_number = Column(Integer, nullable=False, default=1)

    scheduled_date = Column(Date, nullable=False)

    status = Column(
        String,
        nullable=False,
        default="pending"
    )  # pending / success / failed

    attempted_at = Column(DateTime(timezone=True), nullable=True)

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
