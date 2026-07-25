"""
Task 4: Failed Payment Retry & Refund Management
GET  /payment-retries/         – List failed payment queue
POST /payment-retries/run      – Trigger retry processing
POST /refunds                  – Issue a refund
GET  /refunds                  – List refund history
"""

import random
import uuid
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy.orm import Session, joinedload
from typing import Any, Optional

from app.database import get_db
from app.models.payment import Payment
from app.models.payment_retry import PaymentRetry
from app.models.refund import Refund
from app.models.invoice import Invoice
from app.models.subscription import Subscription
from app.models.customer import Customer
from app.models.audit_log import AuditLog

router = APIRouter(tags=["Retries & Refunds"])

RETRY_SCHEDULE = {1: 1, 2: 3, 3: 7}


# ─────────────────────────────────────────
# GET /payment-retries/
# Failed Payment Queue
# ─────────────────────────────────────────
@router.get("/payment-retries/")
def list_retries(
    status: Optional[str] = Query("pending"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20),
    db: Session = Depends(get_db)
):
    q = (
        db.query(PaymentRetry)
        .options(
            joinedload(PaymentRetry.payment),
            joinedload(PaymentRetry.invoice).joinedload(Invoice.customer)
        )
    )

    if status and status != "all":
        q = q.filter(PaymentRetry.status == status)

    total = q.count()
    retries = (
        q.order_by(PaymentRetry.scheduled_date.asc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .all()
    )

    items = []
    for r in retries:
        customer_name = ""
        invoice_number = ""
        invoice_status = ""
        sub_status = ""

        if r.invoice:
            invoice_number = r.invoice.invoice_number
            invoice_status = r.invoice.status
            if r.invoice.customer:
                customer_name = r.invoice.customer.name

            if r.invoice.subscription_id:
                sub = db.query(Subscription).filter(
                    Subscription.id == r.invoice.subscription_id
                ).first()
                if sub:
                    sub_status = sub.status

        items.append({
            "id": r.id,
            "paymentId": r.payment_id,
            "invoiceId": r.invoice_id,
            "invoiceNumber": invoice_number,
            "invoiceStatus": invoice_status,
            "subscriptionStatus": sub_status,
            "customerName": customer_name,
            "amount": r.payment.amount if r.payment else 0,
            "attemptNumber": r.attempt_number,
            "scheduledDate": r.scheduled_date.isoformat() if r.scheduled_date else None,
            "status": r.status,
            "attemptedAt": r.attempted_at.isoformat() if r.attempted_at else None,
        })

    return {"items": items, "total": total, "page": page, "pageSize": pageSize}


# ─────────────────────────────────────────
# POST /payment-retries/run
# Process due retries
# ─────────────────────────────────────────
@router.post("/payment-retries/run")
def run_retries(db: Session = Depends(get_db)):
    today = date.today()
    due_retries = (
        db.query(PaymentRetry)
        .options(
            joinedload(PaymentRetry.payment),
            joinedload(PaymentRetry.invoice)
        )
        .filter(
            PaymentRetry.status == "pending",
            PaymentRetry.scheduled_date <= today
        )
        .all()
    )

    results = []
    for retry in due_retries:
        retry.attempted_at = datetime.utcnow()

        # Simulate 80/20
        success = random.random() < 0.80

        invoice = retry.invoice
        subscription = None
        if invoice and invoice.subscription_id:
            subscription = db.query(Subscription).filter(
                Subscription.id == invoice.subscription_id
            ).first()

        if success:
            retry.status = "success"

            # Create a new successful payment record
            new_pay = Payment(
                invoice_id=retry.invoice_id,
                payment_reference=f"RETRY-{uuid.uuid4().hex[:8].upper()}",
                amount=retry.payment.amount if retry.payment else 0,
                payment_method="card",
                status="paid"
            )
            db.add(new_pay)

            if invoice:
                invoice.status = "paid"
            if subscription and subscription.status == "past_due":
                subscription.status = "active"

            # Cancel remaining pending retries for this invoice
            db.query(PaymentRetry).filter(
                PaymentRetry.invoice_id == retry.invoice_id,
                PaymentRetry.status == "pending",
                PaymentRetry.id != retry.id
            ).update({"status": "cancelled"})

            results.append({"retry_id": retry.id, "result": "success"})

        else:
            retry.status = "failed"

            # Check if all retries exhausted (max attempt = 3)
            all_retries = db.query(PaymentRetry).filter(
                PaymentRetry.invoice_id == retry.invoice_id
            ).all()

            max_attempt = max(r.attempt_number for r in all_retries)
            all_failed = all(r.status in ("failed", "cancelled") for r in all_retries if r.id != retry.id)

            if retry.attempt_number >= max_attempt and all_failed:
                # All retries exhausted – cancel subscription
                if subscription:
                    subscription.status = "cancelled"
                if invoice:
                    invoice.status = "failed"
                results.append({"retry_id": retry.id, "result": "exhausted – subscription cancelled"})
            else:
                results.append({"retry_id": retry.id, "result": "failed – more retries pending"})

    db.commit()

    return {
        "processed": len(results),
        "results": results
    }


# ─────────────────────────────────────────
# POST /refunds
# Issue a refund (prorated or full)
# ─────────────────────────────────────────
@router.post("/refunds")
def create_refund(
    payload: Any = Body(...),
    db: Session = Depends(get_db)
):
    invoice_id = payload.get("invoice_id")
    if not invoice_id:
        raise HTTPException(status_code=400, detail="invoice_id is required")

    invoice = (
        db.query(Invoice)
        .options(
            joinedload(Invoice.customer),
            joinedload(Invoice.subscription)
        )
        .filter(Invoice.id == invoice_id)
        .first()
    )

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Find latest paid payment for this invoice
    payment = (
        db.query(Payment)
        .filter(
            Payment.invoice_id == invoice_id,
            Payment.status == "paid"
        )
        .order_by(Payment.id.desc())
        .first()
    )

    if not payment:
        raise HTTPException(status_code=400, detail="No paid payment found for this invoice")

    paid_amount = payment.amount

    # Prorated refund calculation
    refund_amount = payload.get("refund_amount")
    if refund_amount is None:
        # Auto-calculate proration based on subscription
        subscription = invoice.subscription
        if subscription:
            today = date.today()
            # billing_cycle is on subscription, billing_interval is on plan
            billing = (subscription.billing_cycle or
                       (subscription.plan.billing_interval if subscription.plan else None) or
                       "monthly")
            cycle_days = 365 if billing in ("yearly", "annual", "year") else 30

            # Days used since invoice_date
            invoice_date = invoice.invoice_date
            if invoice_date:
                days_used = max(0, (today - invoice_date).days)
                days_remaining = max(0, cycle_days - days_used)
                refund_amount = round((paid_amount / cycle_days) * days_remaining, 2)
                refund_amount = min(refund_amount, paid_amount)
            else:
                refund_amount = paid_amount
        else:
            refund_amount = paid_amount

    refund_amount = float(refund_amount)
    if refund_amount <= 0:
        raise HTTPException(status_code=400, detail="Refund amount must be greater than 0")
    if refund_amount > paid_amount:
        raise HTTPException(status_code=400, detail="Refund amount cannot exceed paid amount")

    ref_code = f"RF{uuid.uuid4().hex[:6].upper()}"

    refund = Refund(
        refund_reference=ref_code,
        payment_id=payment.id,
        invoice_id=invoice_id,
        customer_id=invoice.customer_id,
        paid_amount=paid_amount,
        refund_amount=refund_amount,
        reason=payload.get("reason", "Customer requested refund"),
        status="completed"
    )
    db.add(refund)

    # Update payment status
    payment.status = "refunded"

    # Update invoice status
    invoice.status = "refunded"

    # Cancel subscription if full refund
    if invoice.subscription_id and refund_amount >= paid_amount:
        sub = db.query(Subscription).filter(
            Subscription.id == invoice.subscription_id
        ).first()
        if sub and sub.status in ("active", "past_due"):
            sub.status = "cancelled"

    db.commit()
    db.refresh(refund)

    # Audit log
    db.add(AuditLog(
        entity_type="Refund",
        entity_id=refund.id,
        action="CREATE",
        module="Refunds",
        description=f"Refund {ref_code} issued for Invoice #{invoice_id}",
        new_value={
            "refund_reference": ref_code,
            "paid_amount": paid_amount,
            "refund_amount": refund_amount,
            "status": "completed"
        }
    ))
    db.commit()

    customer_name = invoice.customer.name if invoice.customer else ""

    return {
        "id": refund.id,
        "refundReference": ref_code,
        "paymentId": payment.id,
        "invoiceId": invoice_id,
        "customerId": invoice.customer_id,
        "customerName": customer_name,
        "paidAmount": paid_amount,
        "refundAmount": refund_amount,
        "reason": refund.reason,
        "status": refund.status,
        "createdAt": refund.created_at.isoformat() if refund.created_at else None
    }


# ─────────────────────────────────────────
# GET /refunds
# Refund history
# ─────────────────────────────────────────
@router.get("/refunds")
def list_refunds(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20),
    db: Session = Depends(get_db)
):
    q = (
        db.query(Refund)
        .options(
            joinedload(Refund.customer),
            joinedload(Refund.invoice)
        )
        .order_by(Refund.id.desc())
    )

    total = q.count()
    refunds = q.offset((page - 1) * pageSize).limit(pageSize).all()

    items = []
    for r in refunds:
        items.append({
            "id": r.id,
            "refundReference": r.refund_reference,
            "paymentId": r.payment_id,
            "invoiceId": r.invoice_id,
            "invoiceNumber": r.invoice.invoice_number if r.invoice else "",
            "customerId": r.customer_id,
            "customerName": r.customer.name if r.customer else "",
            "paidAmount": r.paid_amount,
            "refundAmount": r.refund_amount,
            "reason": r.reason,
            "status": r.status,
            "createdAt": r.created_at.isoformat() if r.created_at else None
        })

    return {"items": items, "total": total, "page": page, "pageSize": pageSize}


# ─────────────────────────────────────────
# GET /refunds/{refund_id}
# ─────────────────────────────────────────
@router.get("/refunds/{refund_id}")
def get_refund(refund_id: int, db: Session = Depends(get_db)):
    r = (
        db.query(Refund)
        .options(
            joinedload(Refund.customer),
            joinedload(Refund.invoice)
        )
        .filter(Refund.id == refund_id)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Refund not found")

    return {
        "id": r.id,
        "refundReference": r.refund_reference,
        "paymentId": r.payment_id,
        "invoiceId": r.invoice_id,
        "invoiceNumber": r.invoice.invoice_number if r.invoice else "",
        "customerId": r.customer_id,
        "customerName": r.customer.name if r.customer else "",
        "paidAmount": r.paid_amount,
        "refundAmount": r.refund_amount,
        "reason": r.reason,
        "status": r.status,
        "createdAt": r.created_at.isoformat() if r.created_at else None
    }
