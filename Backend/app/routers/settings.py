from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.settings import Settings
from app.schemas.settings import (
    SettingsCreate,
    SettingsResponse
)

router = APIRouter(
    prefix="/settings",
    tags=["Settings"]
)


@router.get("/", response_model=SettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(Settings).first()

    if not settings:
        settings = Settings(
            company_name="My Company",
            company_email="admin@example.com",
            phone="9999999999",
            address="India",
            currency="INR",
            timezone="Asia/Kolkata",
            language="English",
            theme="Light",
            tax_percentage=18
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


@router.put("/", response_model=SettingsResponse)
def update_settings(
    updated: SettingsCreate,
    db: Session = Depends(get_db)
):
    settings = db.query(Settings).first()

    if not settings:
        settings = Settings(**updated.model_dump())
        db.add(settings)
    else:
        for key, value in updated.model_dump().items():
            setattr(settings, key, value)

    db.commit()
    db.refresh(settings)

    return settings