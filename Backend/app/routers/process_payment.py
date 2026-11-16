"""
Task 3: Mock Payment Gateway & Webhooks (Enhanced with Security)

POST /payments/process  – Simulate payment with idempotency & server-side amount
POST /webhooks/payment  – Handle payment events with deduplication

Security enhancements:
  • Idempotency key prevents duplicate payment processing
  • Amount is read from the invoice (server-side), NOT trusted from frontend
  • Webhook events are deduplicated via webhook_events table
  • Secure audit logging with hash chain
"""

import random
import uuid
import hmac
import hashlib
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Body, Header, Request
from sqlalchemy.orm import Session, joinedload
from typing import Any, Optional

from app.database import get_db
from app.core.auth import get_current_user, require_admin
from app.core.config import WEBHOOK_SECRET
from app.core.transactions import (
    atomic_transaction,
    enforce_invoice_state_transition,
    enforce_payment_amount_match
)
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.subscription import Subscription
from app.models.payment_retry import PaymentRetry
from app.models.audit_log import AuditLog
from app.models.webhook_event import WebhookEvent
from app.models.secure_audit_log import create_secure_audit_entry
from app.models.user import User

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


def _verify_webhook_signature(payload_bytes: bytes, signature: str) -> bool:
    """
    Verify webhook signature using HMAC-SHA256.
    Returns True if signature is valid or if no WEBHOOK_SECRET is configured
    (to support mock/development mode).
    """
    if not WEBHOOK_SECRET:
        return True  # No secret configured — skip verification (dev mode)
    expected = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


# ─────────────────────────────────────────
# API 1: Process Payment
# POST /payments/process
# ─────────────────────────────────────────
@router.post("/payments/process")
def process_payment(
    payload: Any = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice_id     = payload.get("invoice_id")
    payment_method = payload.get("payment_method", "card")
    idempotency_key = payload.get("idempotency_key")

    if not invoice_id:
        raise HTTPException(status_code=400, detail="invoice_id is required")

    # ── Idempotency check ──
    # If client sends an idempotency_key, check for existing processed payment
    if idempotency_key:
        existing = db.query(Payment).filter(
            Payment.idempotency_key == idempotency_key
        ).first()
        if existing:
            return {
                "success": existing.status == "paid",
                "transaction_id": existing.payment_reference,
                "payment_reference": existing.payment_reference,
                "payment_id": existing.id,
                "invoice_id": existing.invoice_id,
                "amount": float(existing.amount),
                "status": existing.status,
                "invoice_status": db.query(Invoice).filter(
                    Invoice.id == existing.invoice_id
                ).first().status if existing.invoice_id else "unknown",
                "message": "Duplicate request — returning existing result",
                "idempotent": True,
            }

    # ── Load and validate invoice ──
    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.customer))
        .filter(Invoice.id == invoice_id)
        .first()
    )

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Validate invoice state allows payment
    if invoice.status == "paid":
        raise HTTPException(status_code=400, detail="Invoice is already paid")
    
    if invoice.status in ("refunded", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot process payment for {invoice.status} invoice"
        )

    # ── SECURITY: Use server-side amount from invoice, NOT from frontend ──
    amount = float(invoice.total_amount)
    
    # Validate amount is positive
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid invoice amount")

    # 50% success / 50% failure simulation (mock gateway)
    success = random.random() < 0.50

    txn_id  = f"TXN{uuid.uuid4().hex[:8].upper()}"
    pay_ref = f"PAY-{uuid.uuid4().hex[:8].upper()}"
    now     = datetime.now(timezone.utc)

    # Find existing pending payment for this invoice, update it instead of creating duplicate
    payment = db.query(Payment).filter(
        Payment.invoice_id == invoice_id,
        Payment.status.in_(["pending", "unpaid", "failed"])
    ).order_by(Payment.id.desc()).first()

    if payment:
        payment.status            = "paid" if success else "failed"
        payment.payment_method    = payment_method
        payment.payment_reference = pay_ref
        payment.payment_date      = now if success else payment.payment_date
        payment.idempotency_key   = idempotency_key
        db.flush()
    else:
        payment = Payment(
            invoice_id        = invoice_id,
            payment_reference = pay_ref,
            amount            = amount,
            payment_method    = payment_method,
            status            = "paid" if success else "failed",
            payment_date      = now if success else None,
            idempotency_key   = idempotency_key,
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

    # Legacy audit log (existing system)
    db.add(AuditLog(
        entity_type="Payment",
        entity_id=payment.id,
        action="PROCESS",
        module="Payments",
        description=(
            f"Payment processed for Invoice #{invoice_id} "
            f"via {payment_method.upper()} - {'SUCCESS' if success else 'FAILED'}"
        ),
        new_value={
            "invoice_id": invoice_id,
            "amount": amount,
            "status": payment.status,
            "payment_method": payment_method,
            "transaction_id": txn_id,
        }
    ))

    # Secure audit log (hash-chained)
    create_secure_audit_entry(
        db=db,
        action="payment_processed",
        entity_type="Payment",
        entity_id=payment.id,
        description=(
            f"{'Successful' if success else 'Failed'} payment of "
            f"{amount} for Invoice #{invoice_id} via {payment_method}"
        ),
        user_id=current_user.id if current_user else None,
        user_name=getattr(current_user, "full_name", None),
        new_value={
            "invoice_id": invoice_id,
            "amount": amount,
            "status": payment.status,
            "payment_method": payment_method,
            "transaction_id": txn_id,
        },
    )

    db.commit()

    return {
        "success": success,
        "transaction_id": txn_id,
        "payment_reference": pay_ref,
        "payment_id": payment.id,
        "invoice_id": invoice_id,
        "amount": amount,
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
    request: Request,
    payload: Any = Body(...),
    db: Session = Depends(get_db),
    x_webhook_signature: Optional[str] = Header(None, alias="X-Webhook-Signature"),
):
    """
    Handle payment webhook events.
    
    Security:
    - In production with real gateway: WEBHOOK_SECRET must be set and signatures required
    - In development with mock gateway: Signature verification is optional
    - Event deduplication prevents replay attacks
    """
    # ── Signature verification ──
    # SECURITY NOTE: This is a mock/development gateway.
    # Real payment gateways MUST have WEBHOOK_SECRET configured and enforce signatures.
    if WEBHOOK_SECRET:
        # If secret is configured, signature is required
        if not x_webhook_signature:
            raise HTTPException(
                status_code=401,
                detail="Webhook signature required (X-Webhook-Signature header missing)"
            )
        
        # Verify signature
        import json
        payload_bytes = json.dumps(payload, sort_keys=True, default=str).encode()
        if not _verify_webhook_signature(payload_bytes, x_webhook_signature):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
    # else: Development/mock mode - no secret configured, signatures not enforced

    event = payload.get("event")
    invoice_id = payload.get("invoice_id")
    payment_id = payload.get("payment_id")
    event_id = payload.get("event_id") or f"{event}_{invoice_id}_{uuid.uuid4().hex[:8]}"

    if not event or not invoice_id:
        raise HTTPException(status_code=400, detail="event and invoice_id are required")

    allowed_events = {"payment_success", "payment_failed", "payment_refunded"}
    if event not in allowed_events:
        raise HTTPException(status_code=400, detail=f"Unknown event. Allowed: {allowed_events}")

    # ── Deduplication check ──
    existing_event = db.query(WebhookEvent).filter(
        WebhookEvent.event_id == event_id
    ).first()
    if existing_event:
        return {
            "message": f"Event '{event_id}' already processed — skipped (idempotent)",
            "duplicate": True,
        }

    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    payment = None
    if payment_id:
        payment = db.query(Payment).filter(Payment.id == payment_id).first()

    _handle_webhook(event=event, invoice_id=invoice_id, payment=payment, db=db)

    # Record the webhook event for deduplication
    db.add(WebhookEvent(
        event_id=event_id,
        event_type=event,
        source=payload.get("source", "external"),
        payload=payload,
        status="processed",
    ))

    db.commit()

    return {"message": f"Webhook '{event}' handled for invoice #{invoice_id}"}


# ─────────────────────────────────────────
# Internal webhook handler
# ─────────────────────────────────────────
def _handle_webhook(event: str, invoice_id: int, payment, db: Session):
    """Handle payment webhook events with state validation."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        return

    subscription = None
    if invoice.subscription_id:
        subscription = db.query(Subscription).filter(
            Subscription.id == invoice.subscription_id
        ).first()

    if event == "payment_success":
        # Validate state transition before updating
        if invoice.status not in ("unpaid", "failed", "overdue", "draft"):
            # Log warning but don't fail - webhook already processed
            import logging
            logging.warning(
                f"[WEBHOOK] Skipping invoice state change - invoice #{invoice.id} "
                f"already in terminal state '{invoice.status}'"
            )
        else:
            # Invoice: unpaid/failed/overdue → paid
            invoice.status = "paid"
        
        # Subscription: past_due → active
        if subscription and subscription.status == "past_due":
            subscription.status = "active"

        # Cancel any pending retries for this invoice
        db.query(PaymentRetry).filter(
            PaymentRetry.invoice_id == invoice_id,
            PaymentRetry.status == "pending"
        ).update({"status": "cancelled"})

    elif event == "payment_failed":
        # Only update if invoice is not already in a terminal state
        if invoice.status in ("unpaid", "draft", "overdue"):
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
        # Only update if invoice is currently paid
        if invoice.status == "paid":
            invoice.status = "refunded"
        if payment and payment.status == "paid":
            payment.status = "refunded"
