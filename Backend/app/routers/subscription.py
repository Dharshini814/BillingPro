from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from typing import Optional, Any
from datetime import date, datetime, timedelta
import math
import uuid as _uuid

from app.database import get_db

from app.models.subscription import Subscription
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.customer import Customer
from app.models.plan import Plan
from app.models.billing_cycle import BillingCycle
from app.models.audit_log import AuditLog
from app.utils.tax_engine import calculate_tax


router = APIRouter(
    prefix="/subscriptions",
    tags=["Subscriptions"]
)


def formatINR(amount: float) -> str:
    return f"₹{amount:,.2f}"


# -------------------------
# Subscription State Machine
# -------------------------

VALID_TRANSITIONS = {
    "trial": ["active", "cancelled", "canceled", "past_due"],
    "active": ["past_due", "cancelled", "canceled", "paused", "active"],
    "past_due": ["active", "cancelled", "canceled"],
    "paused": ["active", "cancelled", "canceled"],
    "cancelled": ["active", "trial", "paused"],
    "canceled": ["active", "trial", "paused"],
}

# Statuses from which a plan change is allowed
PLAN_CHANGEABLE_STATUSES = {"trial", "active", "past_due", "paused", "cancelled", "canceled"}


def normalize_status(status: str) -> str:
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
        "planChanges": s.plan_changes if hasattr(s, 'plan_changes') and s.plan_changes else [],
        "walletBalance": s.customer.wallet_balance if s.customer else 0.0,
    }


# -------------------------
# Helper: Generate unique invoice number
# -------------------------

def _next_invoice_number(db: Session) -> str:
    last = db.query(Invoice).order_by(Invoice.id.desc()).first()
    last_no = int(last.invoice_number.replace("INV-", "")) if last else 0
    candidate = f"INV-{last_no + 1:05d}"
    while db.query(Invoice).filter(Invoice.invoice_number == candidate).first():
        last_no += 1
        candidate = f"INV-{last_no + 1:05d}"
    return candidate


# -------------------------
# Helper: Auto-process payment (mark invoice paid immediately)
# -------------------------

def _auto_pay_invoice(invoice: Invoice, db: Session) -> Payment:
    """Immediately mark an invoice as paid and create a paid payment record."""
    pay_ref = f"PAY-{_uuid.uuid4().hex[:8].upper()}"
    payment = Payment(
        invoice_id=invoice.id,
        payment_reference=pay_ref,
        amount=invoice.total_amount,
        payment_method="card",
        status="paid",
        payment_date=datetime.utcnow(),
    )
    db.add(payment)
    invoice.status = "paid"
    db.flush()
    return payment


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
    if customer_email:
        customer = db.query(Customer).filter(Customer.email == customer_email).first()
        if customer:
            query = query.filter(Subscription.customer_id == customer.id)
        else:
            return {"items": [], "total": 0, "page": page, "pageSize": pageSize}

    if status and status != "all":
        normalized = normalize_status(status)
        if normalized == "cancelled":
            query = query.filter(Subscription.status.in_(["cancelled", "canceled"]))
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
# FIX: Auto-process payment → invoice marked PAID immediately
# -------------------------

@router.post("/")
def create_subscription(payload: Any = Body(...), db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == payload["customer_id"]).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    plan = db.query(Plan).filter(Plan.id == payload["plan_id"]).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Cancel any previous active subscriptions for this customer
    existing_subs = db.query(Subscription).filter(
        Subscription.customer_id == customer.id,
        Subscription.status.in_(["active", "trial", "past_due", "paused"])
    ).all()
    for old_sub in existing_subs:
        old_sub.status = "cancelled"
        old_sub.cancelled_at = datetime.utcnow()

    start = date.today()
    # Trial period: 7 days before billing kicks in
    trial_end = start + timedelta(days=7)
    next_bill = start + timedelta(days=365 if plan.billing_interval == "year" else 30)
    # Start as "trial" — user must manually pay the unpaid invoice
    status = "trial"

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
    db.flush()

    # Billing Cycle
    cycle_end = start + timedelta(days=365 if plan.billing_interval == "year" else 30)
    billing_cycle = BillingCycle(
        subscription_id=subscription.id,
        cycle_start_date=start,
        cycle_end_date=cycle_end,
        renewal_date=cycle_end,
        status="active"
    )
    db.add(billing_cycle)

    # Calculate tax
    tax = calculate_tax(plan.price, customer.country or "India")

    # Check wallet balance — will be applied when user pays
    wallet_available = customer.wallet_balance

    # Create invoice as UNPAID — user pays manually from their dashboard
    invoice_number = _next_invoice_number(db)
    invoice = Invoice(
        invoice_number=invoice_number,
        customer_id=customer.id,
        subscription_id=subscription.id,
        invoice_date=date.today(),
        due_date=trial_end,          # 7-day trial / grace period
        subtotal=plan.price,
        tax_amount=tax.tax_amount,
        total_amount=tax.total,
        status="unpaid",             # User pays when ready
        plan_name=plan.name,
        notes=(
            f"Trial invoice for {plan.name}. "
            f"Due by {trial_end.isoformat()}. "
            + (f"Wallet balance of ₹{wallet_available:.2f} can be applied on payment." if wallet_available > 0 else "")
        ),
    )
    db.add(invoice)
    db.flush()

    # Audit log
    audit = AuditLog(
        entity_type="subscription",
        entity_id=subscription.id,
        action="created",
        module="subscriptions",
        description=f"Subscription created for {customer.name} on plan {plan.name}. Invoice {invoice_number} generated (unpaid, due {trial_end.isoformat()}).",
        old_value=None,
        new_value={
            "customer": customer.name,
            "plan": plan.name,
            "plan_name": plan.name,
            "amount": plan.price,
            "tax": tax.tax_amount,
            "total": tax.total,
            "wallet_credit_used": 0,
            "amount_charged": 0,
            "status": status,
            "invoice": invoice_number,
            "invoice_status": "unpaid",
        }
    )
    db.add(audit)

    try:
        db.commit()
        db.refresh(subscription)
    except Exception as e:
        db.rollback()
        raise e

    return {
        **to_camel(subscription),
        "invoiceId": invoice.id,
        "invoiceNumber": invoice_number,
        "invoiceStatus": invoice.status,
        "walletCreditUsed": 0,
        "amountCharged": 0,
        "trialEnds": trial_end.isoformat(),
    }


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
# Pause / Resume / Cancel
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


@router.post("/{subscription_id}/resume")
def resume_subscription(subscription_id: int, db: Session = Depends(get_db)):
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    change_status(subscription, "active")
    db.commit()
    db.refresh(subscription)
    return to_camel(subscription)


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
# FIX: Returns wallet balance info + correct proration
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

    new_plan = db.query(Plan).filter(Plan.id == int(new_plan_id)).first()
    if not new_plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    current_plan = db.query(Plan).filter(Plan.id == subscription.plan_id).first()
    customer = db.query(Customer).filter(Customer.id == subscription.customer_id).first()

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
    # Credit = unused value from old plan
    credit = round(daily_current * remaining_days, 2)
    # Charge = cost of new plan for remaining days
    charge = round(daily_new * remaining_days, 2)
    # Net amount before wallet
    amount_due_before_wallet = round(charge - credit, 2)

    wallet_balance = customer.wallet_balance if customer else 0.0

    if amount_due_before_wallet > 0:
        # Upgrade: charge user; can use wallet credit
        wallet_applied = min(wallet_balance, amount_due_before_wallet)
        amount_due = round(amount_due_before_wallet - wallet_applied, 2)
        wallet_credit_added = 0.0
    else:
        # Downgrade: give user wallet credit for the surplus
        wallet_applied = 0.0
        wallet_credit_added = round(abs(amount_due_before_wallet), 2)
        amount_due = 0.0

    # Tax on the final amount due
    tax = calculate_tax(max(amount_due, 0), customer.country if customer else "India")

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
        "amountDueBeforeWallet": amount_due_before_wallet,
        "walletBalance": wallet_balance,
        "walletApplied": wallet_applied,
        "walletCreditAdded": wallet_credit_added,
        "amountDue": amount_due,
        "taxAmount": tax.tax_amount,
        "totalDue": tax.total if amount_due > 0 else 0.0,
        "isDowngrade": amount_due_before_wallet < 0,
    }


# -------------------------
# Change Plan (with proration)
# FIX: Correct proration, wallet credit on downgrade, wallet usage on upgrade
# -------------------------

@router.post("/{subscription_id}/change-plan")
def change_plan(subscription_id: int, payload: Any = Body(...), db: Session = Depends(get_db)):
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.status not in PLAN_CHANGEABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot change plan for subscription with status '{subscription.status}'."
        )

    new_plan_id = payload.get("new_plan_id") or payload.get("planId")
    if not new_plan_id:
        raise HTTPException(status_code=400, detail="new_plan_id is required")

    plan = db.query(Plan).filter(Plan.id == int(new_plan_id)).first()
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan with id {new_plan_id} not found")

    current_plan = db.query(Plan).filter(Plan.id == subscription.plan_id).first()
    customer = db.query(Customer).filter(Customer.id == subscription.customer_id).first()

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
    amount_due_before_wallet = round(charge - credit, 2)

    wallet_balance_before = customer.wallet_balance if customer else 0.0
    proration_invoice = None
    wallet_applied = 0.0
    wallet_credit_added = 0.0

    old_plan_name = current_plan.name if current_plan else "Unknown"
    old_plan_id = subscription.plan_id

    # Update Subscription
    subscription.plan_id = plan.id
    subscription.amount = plan.price
    subscription.billing_cycle = plan.billing_interval
    # Reactivate from trial, past_due, or cancelled states
    if subscription.status in ("trial", "cancelled", "canceled", "past_due"):
        subscription.status = "active"
        subscription.status_changed_at = datetime.utcnow()
        subscription.cancelled_at = None

    if amount_due_before_wallet > 0:
        # ─── UPGRADE: charge user, apply wallet first ───────────────────────
        wallet_applied = min(customer.wallet_balance, amount_due_before_wallet)
        amount_due = round(amount_due_before_wallet - wallet_applied, 2)
        customer.wallet_balance = round(customer.wallet_balance - wallet_applied, 2)

        if amount_due > 0:
            # Generate prorated invoice for the remaining charge after wallet
            proration_tax = calculate_tax(amount_due, customer.country if customer else "India")
            invoice_number = _next_invoice_number(db)
            proration_invoice = Invoice(
                invoice_number=invoice_number,
                customer_id=subscription.customer_id,
                subscription_id=subscription.id,
                invoice_date=today,
                due_date=today + timedelta(days=7),
                subtotal=amount_due,
                tax_amount=proration_tax.tax_amount,
                total_amount=proration_tax.total,
                status="unpaid",           # Leave unpaid — user pays manually
                plan_name=plan.name,
                notes=(
                    f"Proration invoice for upgrading to {plan.name}. "
                    f"Please pay via My Invoices within 7 days."
                    + (f" Wallet credit of ₹{wallet_applied:.2f} was already applied." if wallet_applied > 0 else "")
                ),
            )
            db.add(proration_invoice)
            db.flush()
            # Do NOT auto-pay — user must pay manually from their dashboard
        else:
            # Wallet covered the entire upgrade cost — no invoice needed
            amount_due = 0.0

    else:
        # ─── DOWNGRADE: generate prorated invoice for days used, credit remainder ──
        # used_days_cost = what user actually consumed from their old plan
        used_days = cycle_days - remaining_days
        used_cost = round(daily_current * used_days, 2)
        proration_tax_obj = calculate_tax(used_cost, customer.country if customer else "India")

        wallet_credit_added = round(abs(amount_due_before_wallet), 2)
        customer.wallet_balance = round((customer.wallet_balance or 0.0) + wallet_credit_added, 2)
        amount_due = 0.0

        # Generate a prorated downgrade invoice (positive — shows what was charged for used days)
        invoice_number = _next_invoice_number(db)
        proration_invoice = Invoice(
            invoice_number=invoice_number,
            customer_id=subscription.customer_id,
            subscription_id=subscription.id,
            invoice_date=today,
            due_date=today + timedelta(days=7),
            subtotal=used_cost,
            tax_amount=proration_tax_obj.tax_amount,
            total_amount=proration_tax_obj.total,
            status="paid",
            plan_name=old_plan_name,
            invoice_type="prorated_downgrade",
            notes=(
                f"Prorated charge for {used_days} days used on {old_plan_name}. "
                f"Remaining {remaining_days} days credit of {formatINR(wallet_credit_added)} "
                f"has been added to your wallet."
            ),
        )
        db.add(proration_invoice)
        db.flush()
        # Mark as paid immediately (already pre-paid from original invoice)
        _auto_pay_invoice(proration_invoice, db)

    # Audit Log
    audit = AuditLog(
        entity_type="subscription",
        entity_id=subscription.id,
        action="plan_change",
        module="subscriptions",
        description=(
            f"Plan changed from {old_plan_name} to {plan.name}. "
            f"Credit: ₹{credit}, Charge: ₹{charge}, "
            f"Wallet applied: ₹{wallet_applied}, Wallet credit added: ₹{wallet_credit_added}, "
            f"Amount due: ₹{amount_due}"
        ),
        old_value={"plan_id": old_plan_id, "plan_name": old_plan_name, "amount": current_price},
        new_value={
            "plan_id": plan.id,
            "plan_name": plan.name,
            "amount": new_price,
            "credit": credit,
            "charge": charge,
            "wallet_applied": wallet_applied,
            "wallet_credit_added": wallet_credit_added,
            "amount_due": amount_due,
            "remaining_days": remaining_days,
            "changed_at": today.isoformat()
        }
    )
    db.add(audit)

    try:
        db.commit()
        db.refresh(subscription)
        if proration_invoice:
            db.refresh(proration_invoice)
    except Exception as e:
        db.rollback()
        raise e

    is_downgrade = amount_due_before_wallet < 0
    return {
        **to_camel(subscription),
        "proration": {
            "credit": credit,
            "charge": charge,
            "amountDueBeforeWallet": amount_due_before_wallet,
            "walletApplied": wallet_applied,
            "walletCreditAdded": wallet_credit_added,
            "amountDue": amount_due,
            "remainingDays": remaining_days,
            "oldPlanName": old_plan_name,
            "newPlanName": plan.name,
            "isDowngrade": is_downgrade,
            "invoiceId": proration_invoice.id if proration_invoice else None,
            "invoiceNumber": proration_invoice.invoice_number if proration_invoice else None,
            "invoiceType": proration_invoice.invoice_type if proration_invoice else None,
            "walletBalanceBefore": wallet_balance_before,
            "walletBalanceAfter": customer.wallet_balance,
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


# ─────────────────────────────────────────────────────────────────────────────
# Subscription Change History
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{subscription_id}/history")
def get_subscription_history(subscription_id: int, db: Session = Depends(get_db)):
    from app.models.audit_log import AuditLog
    from sqlalchemy import func

    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    logs = (
        db.query(AuditLog)
        .filter(
            func.lower(AuditLog.entity_type) == "subscription",
            AuditLog.entity_id == subscription_id,
        )
        .order_by(AuditLog.created_at.asc())
        .all()
    )

    changes = []
    for log in logs:
        changes.append({
            "date": log.created_at.isoformat() if log.created_at else None,
            "action": log.action,
            "description": log.description,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "performed_by": log.user_name or "System",
        })

    current_plan = sub.plan.name if sub.plan else "Unknown"
    customer = sub.customer
    return {
        "subscription_id": subscription_id,
        "current_plan": current_plan,
        "current_status": sub.status,
        "created_at": sub.created_at.isoformat() if sub.created_at else None,
        "changes": changes,
        "total_changes": len(changes),
        "wallet_balance": customer.wallet_balance if customer else 0.0,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Get Wallet Balance for a customer by email
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/wallet/{customer_email}")
def get_wallet_balance(customer_email: str, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.email == customer_email).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {
        "customerId": customer.id,
        "customerName": customer.name,
        "walletBalance": customer.wallet_balance,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Wallet Transaction History for a customer by email
# Reads from audit_logs: plan_change events show wallet credits / debits
# Also reads subscription create events for wallet usage
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/wallet/{customer_email}/transactions")
def get_wallet_transactions(customer_email: str, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.email == customer_email).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.entity_type == "subscription",
            AuditLog.action.in_(["plan_change", "created"])
        )
        .order_by(AuditLog.created_at.desc())
        .all()
    )

    transactions = []
    for log in logs:
        new_val = log.new_value or {}
        if not isinstance(new_val, dict):
            continue

        # Filter to this customer via subscription lookup
        sub = db.query(Subscription).filter(Subscription.id == log.entity_id).first()
        if not sub or sub.customer_id != customer.id:
            continue

        wallet_credit_added = new_val.get("wallet_credit_added", 0) or 0
        wallet_credit_used = new_val.get("wallet_credit_used", 0) or 0
        wallet_applied = new_val.get("wallet_applied", 0) or 0

        if wallet_credit_added > 0:
            transactions.append({
                "id": log.id,
                "type": "credit",
                "amount": wallet_credit_added,
                "description": f"Downgrade credit: {new_val.get('plan_name', 'plan change')}",
                "date": log.created_at.isoformat() if log.created_at else None,
            })

        debit = wallet_credit_used or wallet_applied
        if debit > 0:
            plan_name = new_val.get("plan", new_val.get("plan_name", "plan"))
            action = "Subscription payment" if log.action == "created" else "Upgrade payment"
            transactions.append({
                "id": log.id,
                "type": "debit",
                "amount": debit,
                "description": f"{action}: wallet applied for {plan_name}",
                "date": log.created_at.isoformat() if log.created_at else None,
            })

    return {
        "customerId": customer.id,
        "customerName": customer.name,
        "walletBalance": customer.wallet_balance,
        "transactions": transactions,
    }
