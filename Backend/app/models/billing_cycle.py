from sqlalchemy import Column, Integer, Date, DateTime, String, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class BillingCycle(Base):
    __tablename__ = "billing_cycles"

    id = Column(Integer, primary_key=True, index=True)

    subscription_id = Column(
        Integer,
        ForeignKey("subscriptions.id"),
        nullable=False
    )

    cycle_start_date = Column(Date, nullable=False)

    cycle_end_date = Column(Date, nullable=False)

    renewal_date = Column(Date, nullable=False)

    status = Column(
        String,
        default="pending",
        nullable=False
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

    subscription = relationship(
    "Subscription",
    back_populates="billing_cycles",
    overlaps="billing_cycles"
)