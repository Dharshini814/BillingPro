from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class CustomerCreate(BaseModel):
    name: str
    email: EmailStr
    company_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: str = "Active"
    country: Optional[str] = "India"
    currency: Optional[str] = "INR"


class CustomerUpdate(BaseModel):
    name: str
    email: EmailStr
    company_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: str
    country: Optional[str] = "India"
    currency: Optional[str] = "INR"


class CustomerResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    company_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: str
    country: Optional[str] = None
    currency: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
