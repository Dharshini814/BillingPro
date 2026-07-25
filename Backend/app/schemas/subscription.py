from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class SubscriptionCreate(BaseModel):
    customer_id: int
    plan_id: int
    status: str = "trial"
    amount: float = 0.0
    billing_cycle: str = "monthly"
    start_date: date
    end_date: Optional[date] = None
    next_billing_date: Optional[date] = None


class SubscriptionUpdate(BaseModel):
    status: Optional[str] = None
    amount: Optional[float] = None


class SubscriptionResponse(BaseModel):
    id: int
    customer_id: int
    plan_id: int
    status: str
    amount: float
    billing_cycle: Optional[str]
    start_date: date
    end_date: Optional[date]

    class Config:
        from_attributes = True
