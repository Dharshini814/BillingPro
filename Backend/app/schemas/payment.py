from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PaymentCreate(BaseModel):
    invoice_id: Optional[int] = None
    customer_id: Optional[int] = None
    payment_reference: str
    amount: float
    payment_method: str
    status: str = "pending"


class PaymentUpdate(BaseModel):
    status: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    amount: float
    status: str
    payment_method: str

    class Config:
        from_attributes = True
