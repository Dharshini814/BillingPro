from pydantic import BaseModel, EmailStr


class SettingsCreate(BaseModel):
    company_name: str
    company_email: EmailStr
    phone: str
    address: str
    currency: str
    timezone: str
    language: str
    theme: str
    tax_percentage: float


class SettingsResponse(SettingsCreate):
    id: int

    class Config:
        from_attributes = True