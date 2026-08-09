from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from typing import Optional, Any

from app.database import get_db
from app.models.plan import Plan

router = APIRouter(prefix="/plans", tags=["Plans"])


def to_camel(p: Plan) -> dict:
    features = p.features
    if isinstance(features, dict):
        features = list(features.values()) if features else []
    elif not isinstance(features, list):
        features = []

    PLAN_COLORS = {
        "starter": "#5B7CFA",
        "basic": "#5B7CFA",
        "growth": "#7A8FFF",
        "pro": "#7C3AED",
        "scale": "#4CAF50",
        "premium": "#059669",
        "enterprise": "#1B2430",
        "business": "#F59E0B",
    }
    color = PLAN_COLORS.get(p.name.lower(), "#5B7CFA")

    return {
        "id": p.id,
        "name": p.name,
        "price": p.price,
        "interval": p.billing_interval,
        "billingInterval": p.billing_interval,
        "trialDays": p.trial_days,
        "features": features,
        "color": color,
        "subscribers": 0,
        "archived": not p.is_active,
        "isActive": p.is_active,
    }


@router.get("/")
def get_all_plans(
    includeArchived: Optional[bool] = Query(False),
    db: Session = Depends(get_db)
):
    query = db.query(Plan)
    if not includeArchived:
        # Hide archived plans from plan-selection views
        query = query.filter(Plan.is_active == True)  # noqa: E712
    plans = query.all()
    return [to_camel(p) for p in plans]


@router.get("/{plan_id}")
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    p = db.query(Plan).filter(Plan.id == plan_id).first()

    if not p:
        raise HTTPException(status_code=404, detail="Plan not found")

    return to_camel(p)


@router.post("/")
def create_plan(payload: Any = Body(...), db: Session = Depends(get_db)):
    features = payload.get("features", [])

    if isinstance(features, str):
        features = [f.strip() for f in features.split("\n") if f.strip()]

    trial_days = (
        payload.get("trialDays")
        or payload.get("trial_days")
        or 0
    )

    billing_interval = (
        payload.get("interval")
        or payload.get("billingInterval")
        or payload.get("billing_interval")
        or "month"
    )

    p = Plan(
        name=payload.get("name"),
        price=float(payload.get("price", 0)),
        billing_interval=billing_interval,
        trial_days=int(trial_days),
        features=features,
    )

    db.add(p)
    db.commit()
    db.refresh(p)

    return to_camel(p)


@router.put("/{plan_id}")
def update_plan(plan_id: int, payload: Any = Body(...), db: Session = Depends(get_db)):
    p = db.query(Plan).filter(Plan.id == plan_id).first()

    if not p:
        raise HTTPException(status_code=404, detail="Plan not found")

    features = payload.get("features", p.features)

    if isinstance(features, str):
        features = [f.strip() for f in features.split("\n") if f.strip()]

    p.name = payload.get("name", p.name)
    p.price = float(payload.get("price", p.price))

    p.billing_interval = (
        payload.get("interval")
        or payload.get("billingInterval")
        or payload.get("billing_interval")
        or p.billing_interval
    )

    p.trial_days = int(
        payload.get("trialDays")
        or payload.get("trial_days")
        or p.trial_days
    )

    p.features = features

    db.commit()
    db.refresh(p)

    return to_camel(p)


@router.patch("/{plan_id}/archive")
def archive_plan(plan_id: int, db: Session = Depends(get_db)):
    p = db.query(Plan).filter(Plan.id == plan_id).first()

    if not p:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Soft-archive: mark inactive so it is hidden from plan selection,
    # but the row is preserved so existing subscription foreign keys remain valid.
    p.is_active = False
    db.commit()
    db.refresh(p)

    return {"message": "Plan archived", "id": p.id, "archived": True}


@router.delete("/{plan_id}")
def delete_plan(plan_id: int, db: Session = Depends(get_db)):
    p = db.query(Plan).filter(Plan.id == plan_id).first()

    if not p:
        raise HTTPException(status_code=404, detail="Plan not found")

    db.delete(p)
    db.commit()

    return {"message": "Plan deleted successfully"}