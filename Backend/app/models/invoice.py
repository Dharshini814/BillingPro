from sqlalchemy import Column, Integer, Float, String, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Invoice(Base):

    __tablename__ = "invoices"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    invoice_number = Column(
        String,
        unique=True,
        nullable=False
    )

    subscription_id = Column(
        Integer,
        ForeignKey("subscriptions.id"),
        nullable=True
    )

    customer_id = Column(
        Integer,
        ForeignKey("customers.id"),
        nullable=False
    )

    invoice_date = Column(
        Date,
        nullable=False
    )

    due_date = Column(
        Date,
        nullable=False
    )

    subtotal = Column(
        Float,
        nullable=False
    )

    tax_amount = Column(
        Float,
        default=0.0
    )

    total_amount = Column(
        Float,
        nullable=False
    )

    status = Column(
        String,
        default="unpaid",
        nullable=False
    )

    # Snapshot of plan name at invoice creation time
    # Prevents mismatches after plan upgrades/downgrades
    plan_name = Column(
        String,
        nullable=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


    # Relationships

    subscription = relationship(
        "Subscription",
        back_populates="invoices"
    )

    customer = relationship(
        "Customer",
        back_populates="invoices"
    )

    payments = relationship(
        "Payment",
        back_populates="invoice"
    )