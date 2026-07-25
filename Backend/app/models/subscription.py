from sqlalchemy import Column, Integer, String, Date, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)

    customer_id = Column(
        Integer,
        ForeignKey("customers.id"),
        nullable=False
    )

    plan_id = Column(
        Integer,
        ForeignKey("plans.id"),
        nullable=False
    )

    status = Column(
        String,
        nullable=False,
        default="trial"
    )

    amount = Column(
        Float,
        nullable=False,
        default=0.0
    )

    billing_cycle = Column(
        String,
        default="monthly"
    )

    start_date = Column(
        Date,
        nullable=False
    )

    end_date = Column(
        Date,
        nullable=True
    )

    next_billing_date = Column(
        Date,
        nullable=True
    )

    status_changed_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    cancelled_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


    # Relationships

    customer = relationship(
        "Customer"
    )

    plan = relationship(
        "Plan"
    )

    billing_cycles = relationship(
        "BillingCycle",
        back_populates="subscription"
    )

    invoices = relationship(
        "Invoice",
        back_populates="subscription"
    )