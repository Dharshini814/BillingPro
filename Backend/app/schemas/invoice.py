from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class InvoiceCreate(BaseModel):
    invoice_number: str
    customer_id: int
    subscription_id: Optional[int] = None
    invoice_date: date
    due_date: date
    subtotal: float
    tax_amount: float = 0.0
    total_amount: float
    status: str = "unpaid"


class InvoiceUpdate(BaseModel):
    status: Optional[str] = None


class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    customer_id: int
    status: str
    total_amount: float

    class Config:
        from_attributes = True
