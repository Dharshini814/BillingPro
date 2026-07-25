from pydantic import BaseModel
from datetime import datetime


class AuditLogCreate(BaseModel):
    user_name: str
    action: str
    module: str
    description: str
    ip_address: str


class AuditLogUpdate(BaseModel):
    user_name: str
    action: str
    module: str
    description: str
    ip_address: str


class AuditLogResponse(BaseModel):
    id: int
    user_name: str
    action: str
    module: str
    description: str
    ip_address: str
    created_at: datetime

    class Config:
        from_attributes = True