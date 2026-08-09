from sqlalchemy import Column, Integer, String, Float, JSON, Boolean
from app.database import Base


class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(100), nullable=False)

    price = Column(Float, nullable=False)

    billing_interval = Column(
        String(20),
        nullable=False
    )  # monthly / yearly

    trial_days = Column(Integer, default=0)

    features = Column(JSON, nullable=True)

    # Soft-archive flag — archived plans are hidden from plan selection
    # but preserved in DB so existing subscriptions keep their FK intact
    is_active = Column(Boolean, nullable=False, default=True)