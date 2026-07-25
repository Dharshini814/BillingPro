"""
Task 3: Mock Payment Gateway & Webhooks
POST /payments/process  – Simulate payment with 80/20 success/failure
POST /webhooks/payment  – Handle payment events and update invoice + subscription
"""

import random
import uuid
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session, joinedload
from typing import Any

from app.database import get_db
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.subscription import Subscription
from app.models.payment_retry import PaymentRetry
from app.models.audit_log import AuditLog

router = APIRouter(tags=["Payment Gateway"])


# ─────────────────────────────────────────
# Retry schedule: attempt → days from today
# ─────────────────────────────────────────
RETRY_SCHEDULE = {1: 1, 2: 3, 3: 7}


def _schedule_retries(payment: Payment, invoice: Invoice, db: Session):
    """Create 3 retry records for a failed payment."""
    today = date.today()
    for attempt, days in RETRY_SCHEDULE.items():
        retry = PaymentRetry(
            payment_id=payment.id,
            invoice_id=invoice.id,
            attempt_number=attempt,
            scheduled_date=today + timedelta(days=days),
            status="pending"
        )
        db.add(retry)


# ─────────────────────────────────────────
# API 1: Process Payment
# POST /payments/process
# ─────────────────────────────────────────
@router.post("/payments/process")
def process_payment(
    payload: Any = Body(...),
    db: Session = Depends(get_db)
):
    invoice_id = payload.get("invoice_id")
    amount = payload.get("amount")

    if not invoice_id or amount is None:
        raise HTTPException(status_code=400, detail="invoice_id and amount are required")

    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.customer))
        .filter(Invoice.id == invoice_id)
        .first()
    )

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status == "paid":
        raise HTTPException(status_code=400, detail="Invoice is already paid")

    # 80% success, 20% failure
    success = random.random() < 0.80

    txn_id = f"TXN{uuid.uuid4().hex[:8].upper()}"
    pay_ref = f"PAY-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(timezone.utc)

    # Find existing pending payment for this invoice, update it instead of creating duplicate
    payment = db.query(Payment).filter(
        Payment.invoice_id == invoice_id,
        Payment.status.in_(["pending", "unpaid", "failed"])
    ).order_by(Payment.id.desc()).first()

    if payment:
        payment.status = "paid" if success else "failed"
        payment.payment_method = "card"
        payment.payment_reference = pay_ref
        payment.payment_date = now if success else payment.payment_date
        db.flush()
    else:
        payment = Payment(
            invoice_id=invoice_id,
            payment_reference=pay_ref,
            amount=float(amount),
            payment_method="card",
            status="paid" if success else "failed",
            payment_date=now if success else None
        )
        db.add(payment)
        db.flush()

    # Trigger webhook internally
    _handle_webhook(
        event="payment_success" if success else "payment_failed",
        invoice_id=invoice_id,
        payment=payment,
        db=db
    )

    db.commit()
    db.refresh(payment)

    # Audit
    db.add(AuditLog(
        entity_type="Payment",
        entity_id=payment.id,
        action="PROCESS",
        module="Payments",
        description=f"Payment processed for Invoice #{invoice_id} - {'SUCCESS' if success else 'FAILED'}",
        new_value={
            "invoice_id": invoice_id,
            "amount": float(amount),
            "status": payment.status,
            "transaction_id": txn_id
        }
    ))
    db.commit()

    return {
        "success": success,
        "transaction_id": txn_id,
        "payment_reference": pay_ref,
        "payment_id": payment.id,
        "invoice_id": invoice_id,
        "amount": float(amount),
        "status": payment.status,
        "invoice_status": invoice.status,
        "message": "Payment successful" if success else "Payment failed – retries scheduled"
    }


# ─────────────────────────────────────────
# API 2: Payment Webhook
# POST /webhooks/payment
# ─────────────────────────────────────────
@router.post("/webhooks/payment")
def payment_webhook(
    payload: Any = Body(...),
    db: Session = Depends(get_db)
):
    event = payload.get("event")
    invoice_id = payload.get("invoice_id")
    payment_id = payload.get("payment_id")

    if not event or not invoice_id:
        raise HTTPException(status_code=400, detail="event and invoice_id are required")

    allowed_events = {"payment_success", "payment_failed", "payment_refunded"}
    if event not in allowed_events:
        raise HTTPException(status_code=400, detail=f"Unknown event. Allowed: {allowed_events}")

    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    payment = None
    if payment_id:
        payment = db.query(Payment).filter(Payment.id == payment_id).first()

    _handle_webhook(event=event, invoice_id=invoice_id, payment=payment, db=db)
    db.commit()

    return {"message": f"Webhook '{event}' handled for invoice #{invoice_id}"}


# ─────────────────────────────────────────
# Internal webhook handler
# ─────────────────────────────────────────
def _handle_webhook(event: str, invoice_id: int, payment, db: Session):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        return

    subscription = None
    if invoice.subscription_id:
        subscription = db.query(Subscription).filter(
            Subscription.id == invoice.subscription_id
        ).first()

    if event == "payment_success":
        # Invoice: unpaid → paid
        invoice.status = "paid"
        # Subscription: remains active (or set to active if past_due)
        if subscription and subscription.status == "past_due":
            subscription.status = "active"

        # Cancel any pending retries for this invoice
        db.query(PaymentRetry).filter(
            PaymentRetry.invoice_id == invoice_id,
            PaymentRetry.status == "pending"
        ).update({"status": "cancelled"})

    elif event == "payment_failed":
        # Invoice: unpaid → failed
        invoice.status = "failed"
        # Subscription: active → past_due
        if subscription and subscription.status == "active":
            subscription.status = "past_due"

        # Schedule retries if payment object available
        if payment:
            # Only schedule if no retries exist yet
            existing = db.query(PaymentRetry).filter(
                PaymentRetry.invoice_id == invoice_id
            ).count()
            if existing == 0:
                _schedule_retries(payment, invoice, db)

    elif event == "payment_refunded":
        invoice.status = "refunded"
        if payment:
            payment.status = "refunded"
