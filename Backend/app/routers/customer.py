from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from typing import Optional

from app.database import get_db
from app.core.auth import get_current_user

from app.models.customer import Customer
from app.models.audit_log import AuditLog
from app.models.subscription import Subscription
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.refund import Refund
from app.models.plan import Plan
from app.models.billing_cycle import BillingCycle
from app.models.payment_retry import PaymentRetry

from app.schemas.customer import CustomerCreate, CustomerUpdate


router = APIRouter(
    prefix="/customers",
    tags=["Customers"],
    dependencies=[Depends(get_current_user)],  # Phase 2: JWT auth required
)


def to_camel(c: Customer) -> dict:

    return {
        "id": c.id,
        "name": c.name,
        "email": c.email,
        "company": c.company_name or "",
        "phone": c.phone or "",
        "address": c.address or "",
        "status": c.status,
        "country": c.country or "India",
        "currency": c.currency or "INR",
        "joined": c.created_at.isoformat()
            if c.created_at else None,
        "plan": None,
        "mrr": 0,
        "walletBalance": round(c.wallet_balance or 0.0, 2),
    }



# ==========================
# LIST CUSTOMERS
# ==========================

@router.get("/")
def get_customers(

    search: Optional[str] = Query(None),

    status: Optional[str] = Query("all"),

    page: int = Query(1, ge=1),

    pageSize: Optional[int] = Query(None),

    page_size: Optional[int] = Query(None),

    db: Session = Depends(get_db)

):

    limit = pageSize or page_size or 8


    q = db.query(Customer)


    if search:

        q = q.filter(
            or_(
                Customer.name.ilike(f"%{search}%"),
                Customer.email.ilike(f"%{search}%"),
                Customer.company_name.ilike(f"%{search}%"),
            )
        )


    if status and status != "all":
        from sqlalchemy import func as sqlfunc
        q = q.filter(
            sqlfunc.lower(Customer.status) == status.lower()
        )


    total = q.count()


    items = (
        q.order_by(Customer.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )


    return {

        "items": [
            to_camel(c)
            for c in items
        ],

        "total": total,

        "page": page,

        "pageSize": limit

    }





# ==========================
# GET CUSTOMER BY EMAIL
# ==========================

@router.get("/by-email/{email}")
def get_customer_by_email(
    email: str,
    db: Session = Depends(get_db)
):
    c = (
        db.query(Customer)
        .filter(Customer.email == email)
        .first()
    )

    if not c:
        raise HTTPException(
            status_code=404,
            detail="Customer not found"
        )

    return to_camel(c)


# ==========================
# GET CUSTOMER
# ==========================

@router.get("/{customer_id}")
def get_customer(

    customer_id: int,

    db: Session = Depends(get_db)

):

    c = (
        db.query(Customer)
        .filter(
            Customer.id == customer_id
        )
        .first()
    )


    if not c:

        raise HTTPException(
            status_code=404,
            detail="Customer not found"
        )


    return to_camel(c)





# ==========================
# CREATE CUSTOMER
# ==========================

@router.post("/")
def create_customer(

    customer: CustomerCreate,

    db: Session = Depends(get_db)

):


    existing = (
        db.query(Customer)
        .filter(
            Customer.email == customer.email
        )
        .first()
    )


    if existing:

        raise HTTPException(
            status_code=400,
            detail="Email already exists"
        )



    c = Customer(

        name=customer.name,

        email=customer.email,

        company_name=customer.company_name,

        phone=customer.phone,

        address=customer.address,

        status=customer.status,

        country=getattr(customer, 'country', None) or "India",

        currency=getattr(customer, 'currency', None) or "INR",

    )


    db.add(c)

    db.commit()

    db.refresh(c)



    audit = AuditLog(

        entity_type="customer",

        entity_id=c.id,

        action="created",

        module="customers",

        description="Customer created",

        old_value=None,

        new_value={

            "name": c.name,

            "email": c.email,

            "company": c.company_name

        },

        performed_by=None,

        user_name=None,

        ip_address=None

    )


    db.add(audit)

    db.commit()



    return to_camel(c)





# ==========================
# UPDATE CUSTOMER
# ==========================

@router.put("/{customer_id}")
def update_customer(

    customer_id: int,

    customer_data: CustomerUpdate,

    db: Session = Depends(get_db)

):


    c = (
        db.query(Customer)
        .filter(
            Customer.id == customer_id
        )
        .first()
    )


    if not c:

        raise HTTPException(
            status_code=404,
            detail="Customer not found"
        )


    old_data = {

        "name": c.name,

        "email": c.email,

        "company": c.company_name,

        "status": c.status

    }



    c.name = customer_data.name

    c.email = customer_data.email

    c.company_name = customer_data.company_name

    c.phone = customer_data.phone

    c.address = customer_data.address

    c.status = customer_data.status

    c.country = getattr(customer_data, 'country', None) or "India"

    c.currency = getattr(customer_data, 'currency', None) or "INR"



    db.commit()

    db.refresh(c)



    audit = AuditLog(

        entity_type="customer",

        entity_id=c.id,

        action="updated",

        module="customers",

        description="Customer updated",

        old_value=old_data,

        new_value={

            "name": c.name,

            "email": c.email,

            "company": c.company_name,

            "status": c.status

        }

    )


    db.add(audit)

    db.commit()



    return to_camel(c)





# ==========================
# DELETE CUSTOMER
# ==========================

@router.delete("/{customer_id}")
def delete_customer(

    customer_id: int,

    db: Session = Depends(get_db)

):


    c = (
        db.query(Customer)
        .filter(
            Customer.id == customer_id
        )
        .first()
    )


    if not c:

        raise HTTPException(
            status_code=404,
            detail="Customer not found"
        )

    # Check for active or trial subscriptions
    active_subs = (
        db.query(Subscription)
        .filter(
            Subscription.customer_id == customer_id,
            Subscription.status.in_(["active", "trialing", "trial"])
        )
        .count()
    )

    if active_subs > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete customer with {active_subs} active subscription(s). Please cancel subscriptions first."
        )

    # Get subscription IDs for this customer
    subscription_ids = [
        s.id for s in db.query(Subscription.id)
        .filter(Subscription.customer_id == customer_id)
        .all()
    ]

    # Get invoice IDs for this customer
    invoice_ids = [
        i.id for i in db.query(Invoice.id)
        .filter(Invoice.customer_id == customer_id)
        .all()
    ]

    # Delete in correct order to avoid foreign key constraints
    # 1. Delete billing cycles (references subscriptions)
    if subscription_ids:
        db.query(BillingCycle).filter(
            BillingCycle.subscription_id.in_(subscription_ids)
        ).delete(synchronize_session=False)

    # 2. Delete payment retries (references invoices)
    if invoice_ids:
        db.query(PaymentRetry).filter(
            PaymentRetry.invoice_id.in_(invoice_ids)
        ).delete(synchronize_session=False)

    # 3. Delete payments (references invoices)
    if invoice_ids:
        db.query(Payment).filter(
            Payment.invoice_id.in_(invoice_ids)
        ).delete(synchronize_session=False)

    # 4. Delete refunds (references customer)
    db.query(Refund).filter(
        Refund.customer_id == customer_id
    ).delete(synchronize_session=False)

    # 5. Delete invoices (references customer)
    db.query(Invoice).filter(
        Invoice.customer_id == customer_id
    ).delete(synchronize_session=False)

    # 6. Delete subscriptions (references customer)
    db.query(Subscription).filter(
        Subscription.customer_id == customer_id
    ).delete(synchronize_session=False)

    # Create audit log before deleting customer
    audit = AuditLog(

        entity_type="customer",

        entity_id=c.id,

        action="deleted",

        module="customers",

        description=f"Customer deleted with {len(subscription_ids)} subscriptions and {len(invoice_ids)} invoices",

        old_value={

            "name": c.name,

            "email": c.email

        },

        new_value=None

    )


    db.add(audit)

    # 7. Finally delete the customer
    db.delete(c)

    db.commit()



    return {

        "message":
        "Customer deleted successfully"

    }

# ─────────────────────────────────────────────────────────────────────────────
# M3 Task 3 — Customer Billing History, Activity Summary
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{customer_id}/billing-history")
def get_billing_history(customer_id: int, db: Session = Depends(get_db)):
    """
    Chronological billing timeline for a customer:
    subscriptions, invoices, payments, refunds — all merged and sorted by date.
    """
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    events = []

    # Subscriptions
    subs = (
        db.query(Subscription)
        .options(joinedload(Subscription.plan))
        .filter(Subscription.customer_id == customer_id)
        .all()
    )
    for s in subs:
        plan_name = s.plan.name if s.plan else "Unknown"
        events.append({
            "type": "subscription",
            "date": s.created_at.isoformat() if s.created_at else None,
            "title": f"Subscription Created — {plan_name}",
            "status": s.status,
            "meta": {"plan": plan_name, "billing_cycle": s.billing_cycle, "amount": s.amount},
        })
        if s.cancelled_at:
            events.append({
                "type": "subscription_cancelled",
                "date": s.cancelled_at.isoformat(),
                "title": f"Subscription Cancelled — {plan_name}",
                "status": "cancelled",
                "meta": {"plan": plan_name},
            })

    # Invoices
    invoices = (
        db.query(Invoice)
        .filter(Invoice.customer_id == customer_id)
        .all()
    )
    for inv in invoices:
        events.append({
            "type": "invoice",
            "date": inv.created_at.isoformat() if inv.created_at else str(inv.invoice_date),
            "title": f"Invoice Generated — {inv.invoice_number}",
            "status": inv.status,
            "meta": {"invoice_number": inv.invoice_number, "amount": inv.total_amount},
        })

    # Payments
    payments = (
        db.query(Payment)
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .filter(Invoice.customer_id == customer_id)
        .all()
    )
    for p in payments:
        label = "Payment Received" if p.status == "paid" else "Payment Failed" if p.status == "failed" else f"Payment {p.status.title()}"
        events.append({
            "type": "payment",
            "date": p.payment_date.isoformat() if p.payment_date else p.created_at.isoformat(),
            "title": f"{label} — {p.payment_reference}",
            "status": p.status,
            "meta": {"amount": p.amount, "method": p.payment_method},
        })

    # Refunds
    refunds = (
        db.query(Refund)
        .filter(Refund.customer_id == customer_id)
        .all()
    )
    for r in refunds:
        events.append({
            "type": "refund",
            "date": r.created_at.isoformat() if r.created_at else None,
            "title": f"Refund Issued — {r.refund_reference}",
            "status": r.status,
            "meta": {"amount": r.refund_amount, "reason": r.reason},
        })

    # Sort all events chronologically
    events.sort(key=lambda e: e["date"] or "", reverse=False)

    return {
        "customer_id": customer_id,
        "customer_name": customer.name,
        "events": events,
        "total": len(events),
    }


@router.get("/{customer_id}/activity-summary")
def get_activity_summary(customer_id: int, db: Session = Depends(get_db)):
    """
    M3 Task 3 — Customer Activity Summary Card:
    total_invoices, total_paid, failed_payments, refunds
    """
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    total_invoices = (
        db.query(func.count(Invoice.id))
        .filter(Invoice.customer_id == customer_id)
        .scalar() or 0
    )

    total_paid = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .filter(Invoice.customer_id == customer_id, Payment.status == "paid")
        .scalar() or 0
    )

    failed_payments = (
        db.query(func.count(Payment.id))
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .filter(Invoice.customer_id == customer_id, Payment.status == "failed")
        .scalar() or 0
    )

    total_refunds = (
        db.query(func.count(Refund.id))
        .filter(Refund.customer_id == customer_id)
        .scalar() or 0
    )

    total_refund_amount = (
        db.query(func.coalesce(func.sum(Refund.refund_amount), 0))
        .filter(Refund.customer_id == customer_id)
        .scalar() or 0
    )

    active_subscriptions = (
        db.query(func.count(Subscription.id))
        .filter(Subscription.customer_id == customer_id, Subscription.status == "active")
        .scalar() or 0
    )

    return {
        "total_invoices": total_invoices,
        "total_paid": float(total_paid),
        "failed_payments": failed_payments,
        "refunds": total_refunds,
        "total_refund_amount": float(total_refund_amount),
        "active_subscriptions": active_subscriptions,
    }
