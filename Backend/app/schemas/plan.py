from pydantic import BaseModel
from typing import Dict, Any


class PlanCreate(BaseModel):
    name: str
    price: float
    billing_interval: str
    trial_days: int = 0
    features: Dict[str, Any] = {}


class PlanResponse(BaseModel):
    id: int
    name: str
    price: float
    billing_interval: str
    trial_days: int
    features: Dict[str, Any]

    class Config:
        from_attributes = True