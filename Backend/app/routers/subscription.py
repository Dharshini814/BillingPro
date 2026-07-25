from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from typing import Optional, Any
from datetime import date, datetime, timedelta
import math

from app.database import get_db

from app.models.subscription import Subscription
from app.models.invoice import Invoice
from app.models.customer import Customer
from app.models.plan import Plan
from app.models.billing_cycle import BillingCycle
from app.models.audit_log import AuditLog
from app.utils.tax_engine import calculate_tax


router = APIRouter(
    prefix="/subscriptions",
    tags=["Subscriptions"]
)


# -------------------------
# Subscription State Machine
# -------------------------

VALID_TRANSITIONS = {
    "trial": ["active", "cancelled", "canceled"],
    "active": ["past_due", "cancelled", "canceled", "paused"],
    "past_due": ["active", "cancelled", "canceled"],
    "paused": ["active", "cancelled", "canceled"],
    "cancelled": ["active", "paused"],
    "canceled": ["active", "paused"],
    
}

# Statuses that can have their plan changed
PLAN_CHANGEABLE_STATUSES = {"trial", "active", "past_due", "paused"}


def normalize_status(status: str) -> str:
    """Normalize 'canceled' (US) -> 'cancelled' (backend storage)."""
    return "cancelled" if status == "canceled" else status


def change_status(subscription, new_status):
    current = subscription.status
    normalized_new = normalize_status(new_status)

    allowed = VALID_TRANSITIONS.get(current, [])
    if normalized_new not in allowed and new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transition {current} -> {new_status}"
        )

    subscription.status = normalized_new
    subscription.status_changed_at = datetime.utcnow()

    if normalized_new in ("cancelled", "canceled"):
        subscription.cancelled_at = datetime.utcnow()


# -------------------------
# Response Formatter
# -------------------------

def to_camel(s: Subscription):
    # Normalize cancelled -> canceled for frontend
    status = s.status
    if status == "cancelled":
        status = "canceled"

    return {
        "id": s.id,
        "customerId": s.customer_id,
        "planId": s.plan_id,
        "customerName": s.customer.name if s.customer else "",
        "company": s.customer.company_name if s.customer else "",
        "plan": s.plan.name if s.plan else "",
        "amount": s.amount,
        "billingCycle": s.billing_cycle,
        "status": status,
        "startedAt": s.start_date.isoformat() if s.start_date else None,
        "nextBilling": s.next_billing_date.isoformat() if s.next_billing_date else None,
        "cancelledAt": s.cancelled_at.isoformat() if s.cancelled_at else None,
        "createdAt": s.created_at.isoformat() if s.created_at else None,
        "planChanges": s.plan_changes if hasattr(s, 'plan_changes') and s.plan_changes else []
    }


# -------------------------
# Get All Subscriptions
# -------------------------

@router.get("/")
def get_subscriptions(
    status: Optional[str] = Query("all"),
    customer_email: Optional[str] = Query(None),
    page: int = Query(1),
    pageSize: int = Query(8),
    db: Session = Depends(get_db)
):
    query = db.query(Subscription)

    # Filter to a specific customer by email (used for user-facing My Plan page)
    if customer_email:
        customer = db.query(Customer).filter(Customer.email == customer_email).first()
        if customer:
            query = query.filter(Subscription.customer_id == customer.id)
        else:
            return {"items": [], "total": 0, "page": page, "pageSize": pageSize}

    if status and status != "all":
        # Accept both spellings from frontend
        normalized = normalize_status(status)
        if normalized == "cancelled":
            query = query.filter(
                Subscription.status.in_(["cancelled", "canceled"])
            )
        else:
            query = query.filter(Subscription.status == normalized)

    total = query.count()

    items = (
        query
        .order_by(Subscription.id.desc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .all()
    )

    return {
        "items": [to_camel(item) for item in items],
        "total": total,
        "page": page,
        "pageSize": pageSize
    }


# -------------------------
# Get Single Subscription
# -------------------------

@router.get("/{subscription_id}")
def get_subscription(subscription_id: int, db: Session = Depends(get_db)):
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return to_camel(subscription)


# -------------------------
# Create Subscription
# -------------------------

@router.post("/")
def create_subscription(payload: Any = Body(...), db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == payload["customer_id"]).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    plan = db.query(Plan).filter(Plan.id == payload["plan_id"]).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    start = date.today()
    next_bill = start + timedelta(days=365 if plan.billing_interval == "year" else 30)
    status = "trial" if plan.trial_days > 0 else "active"

    subscription = Subscription(
        customer_id=customer.id,
        plan_id=plan.id,
        amount=plan.price,
        billing_cycle=plan.billing_interval,
        start_date=start,
        next_billing_date=next_bill,
        status=status
    )

    db.add(subscription)
    db.commit()
    db.refresh(subscription)

    # Billing Cycle
    cycle_end = start + timedelta(days=365 if plan.billing_interval == "year" else 30)
    billing_cycle = BillingCycle(
        subscription_id=subscription.id,
        cycle_start_date=start,
        cycle_end_date=cycle_end,
        renewal_date=cycle_end,
        status="pending"
    )
    db.add(billing_cycle)

    # Invoice with country-based tax
    count = db.query(Invoice).count()
    invoice_number = f"INV-{(count + 1):05d}"
    # ensure unique
    while db.query(Invoice).filter(Invoice.invoice_number == invoice_number).first():
        count += 1
        invoice_number = f"INV-{(count + 1):05d}"

    tax = calculate_tax(plan.price, customer.country or "India")
    invoice = Invoice(
        invoice_number=invoice_number,
        customer_id=customer.id,
        subscription_id=subscription.id,
        invoice_date=date.today(),
        due_date=date.today() + timedelta(days=7),
        subtotal=plan.price,
        tax_amount=tax.tax_amount,
        total_amount=tax.total,
        status="unpaid",
        plan_name=plan.name,
    )
    db.add(invoice)

    # Audit log
    audit = AuditLog(
        entity_type="subscription",
        entity_id=subscription.id,
        action="created",
        module="subscriptions",
        description=f"Subscription created for {customer.name} on plan {plan.name}",
        old_value=None,
        new_value={
            "customer": customer.name,
            "plan": plan.name,
            "amount": plan.price,
            "status": status
        }
    )
    db.add(audit)

    try:
        db.commit()
        db.refresh(billing_cycle)
        db.refresh(invoice)
    except Exception as e:
        db.rollback()
        raise e

    return to_camel(subscription)


# -------------------------
# Update Subscription Status
# -------------------------

@router.patch("/{subscription_id}")
def update_status(subscription_id: int, payload: Any = Body(...), db: Session = Depends(get_db)):
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    new_status = payload.get("status", "")
    change_status(subscription, new_status)

    # Audit log
    audit = AuditLog(
        entity_type="subscription",
        entity_id=subscription.id,
        action=normalize_status(new_status),
        module="subscriptions",
        description=f"Subscription status changed to {normalize_status(new_status)}",
        new_value={"status": normalize_status(new_status)}
    )
    db.add(audit)

    db.commit()
    db.refresh(subscription)
    return to_camel(subscription)


# -------------------------
# Pause Subscription
# -------------------------

@router.post("/{subscription_id}/pause")
def pause_subscription(subscription_id: int, db: Session = Depends(get_db)):
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    change_status(subscription, "paused")
    db.commit()
    db.refresh(subscription)
    return to_camel(subscription)


# -------------------------
# Resume Subscription
# -------------------------

@router.post("/{subscription_id}/resume")
def resume_subscription(subscription_id: int, db: Session = Depends(get_db)):
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    change_status(subscription, "active")
    db.commit()
    db.refresh(subscription)
    return to_camel(subscription)


# -------------------------
# Cancel Subscription
# -------------------------

@router.post("/{subscription_id}/cancel")
def cancel_subscription(subscription_id: int, db: Session = Depends(get_db)):
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    change_status(subscription, "cancelled")
    db.commit()
    db.refresh(subscription)
    return to_camel(subscription)


# -------------------------
# Preview Plan Change (Proration)
# -------------------------

@router.post("/{subscription_id}/preview-plan-change")
def preview_plan_change(subscription_id: int, payload: Any = Body(...), db: Session = Depends(get_db)):
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.status not in PLAN_CHANGEABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot change plan for subscription with status '{subscription.status}'"
        )

    if isinstance(payload, dict):
        new_plan_id = payload.get("new_plan_id") or payload.get("planId")
    else:
        new_plan_id = payload

    if not new_plan_id:
        raise HTTPException(status_code=400, detail="new_plan_id is required")
    if not new_plan_id:
        raise HTTPException(status_code=400, detail="new_plan_id is required")

    new_plan = db.query(Plan).filter(Plan.id == int(new_plan_id)).first()
    if not new_plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    current_plan = db.query(Plan).filter(Plan.id == subscription.plan_id).first()

    cycle_days = 365 if subscription.billing_cycle == "year" else 30
    today = date.today()

    if subscription.next_billing_date:
        remaining_days = max(0, (subscription.next_billing_date - today).days)
    else:
        remaining_days = 0

    used_days = cycle_days - remaining_days
    current_price = current_plan.price if current_plan else subscription.amount
    new_price = new_plan.price

    daily_current = current_price / cycle_days
    daily_new = new_price / cycle_days
    credit = round(daily_current * remaining_days, 2)
    charge = round(daily_new * remaining_days, 2)
    amount_due = round(charge - credit, 2)

    return {
        "currentPlan": {
            "id": current_plan.id if current_plan else subscription.plan_id,
            "name": current_plan.name if current_plan else "Current Plan",
            "price": current_price,
        },
        "newPlan": {
            "id": new_plan.id,
            "name": new_plan.name,
            "price": new_price,
        },
        "cycleDays": cycle_days,
        "usedDays": used_days,
        "remainingDays": remaining_days,
        "credit": credit,
        "charge": charge,
        "amountDue": amount_due,
    }


# -------------------------
# Change Plan (with proration)
# -------------------------

@router.post("/{subscription_id}/change-plan")
def change_plan(subscription_id: int, payload: Any = Body(...), db: Session = Depends(get_db)):
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.status not in PLAN_CHANGEABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot change plan for subscription with status '{subscription.status}'. Only active, trial, past_due, or paused subscriptions can have their plan changed."
        )

    new_plan_id = payload.get("new_plan_id") or payload.get("planId")
    if not new_plan_id:
        raise HTTPException(status_code=400, detail="new_plan_id is required")

    plan = db.query(Plan).filter(Plan.id == int(new_plan_id)).first()
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan with id {new_plan_id} not found")

    current_plan = db.query(Plan).filter(Plan.id == subscription.plan_id).first()

    cycle_days = 365 if subscription.billing_cycle == "year" else 30
    today = date.today()

    if subscription.next_billing_date:
        remaining_days = max(0, (subscription.next_billing_date - today).days)
    else:
        remaining_days = 0

    current_price = current_plan.price if current_plan else subscription.amount
    new_price = plan.price

    daily_current = current_price / cycle_days
    daily_new = new_price / cycle_days
    credit = round(daily_current * remaining_days, 2)
    charge = round(daily_new * remaining_days, 2)
    amount_due = round(charge - credit, 2)

    old_plan_name = current_plan.name if current_plan else "Unknown"
    old_plan_id = subscription.plan_id

    # Update Subscription
    subscription.plan_id = plan.id
    subscription.amount = plan.price
    subscription.billing_cycle = plan.billing_interval
    # If was trial, activate it now
    if subscription.status == "trial":
        subscription.status = "active"
        subscription.status_changed_at = datetime.utcnow()

    # Proration Invoice (always create when amount_due != 0)
    last_invoice = db.query(Invoice).order_by(Invoice.id.desc()).first()
    if last_invoice:
        last_no = int(last_invoice.invoice_number.replace("INV-", ""))
        invoice_number = f"INV-{last_no + 1:05d}"
    else:
        invoice_number = "INV-00001"

    if amount_due != 0:
        customer_obj = db.query(Customer).filter(Customer.id == subscription.customer_id).first()
        proration_tax = calculate_tax(amount_due, customer_obj.country if customer_obj else "India")
        # Snapshot the new plan name so the invoice always shows the correct
        # plan even if the subscription is changed again in the future.
        proration_invoice = Invoice(
            invoice_number=invoice_number,
            customer_id=subscription.customer_id,
            subscription_id=subscription.id,
            invoice_date=today,
            due_date=today + timedelta(days=7),
            subtotal=amount_due,
            tax_amount=proration_tax.tax_amount,
            total_amount=proration_tax.total,
            status="unpaid",
            plan_name=plan.name,
        )
        db.add(proration_invoice)

    # Audit Log
    audit = AuditLog(
        entity_type="subscription",
        entity_id=subscription.id,
        action="plan_change",
        module="subscriptions",
        description=(
            f"Plan changed from {old_plan_name} to {plan.name}. "
            f"Credit: ₹{credit}, Charge: ₹{charge}, Amount Due: ₹{amount_due}"
        ),
        old_value={"plan_id": old_plan_id, "plan_name": old_plan_name, "amount": current_price},
        new_value={
            "plan_id": plan.id,
            "plan_name": plan.name,
            "amount": new_price,
            "credit": credit,
            "charge": charge,
            "amount_due": amount_due,
            "remaining_days": remaining_days,
            "changed_at": today.isoformat()
        }
    )
    db.add(audit)
    db.commit()
    db.refresh(subscription)

    return {
        **to_camel(subscription),
        "proration": {
            "credit": credit,
            "charge": charge,
            "amountDue": amount_due,
            "remainingDays": remaining_days,
            "oldPlanName": old_plan_name,
            "newPlanName": plan.name,
        }
    }


# -------------------------
# Update Subscription
# -------------------------

@router.put("/{subscription_id}")
def update_subscription(subscription_id: int, payload: Any = Body(...), db: Session = Depends(get_db)):
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if "amount" in payload:
        subscription.amount = float(payload["amount"])
    if "billing_cycle" in payload:
        subscription.billing_cycle = payload["billing_cycle"]

    db.commit()
    db.refresh(subscription)
    return to_camel(subscription)


# -------------------------
# Delete Subscription
# -------------------------

@router.delete("/{subscription_id}")
def delete_subscription(subscription_id: int, db: Session = Depends(get_db)):
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    db.delete(subscription)
    db.commit()
    return {"message": "Subscription deleted successfully"}
