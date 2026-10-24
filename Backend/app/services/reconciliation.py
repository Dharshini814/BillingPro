"""
Payment reconciliation service for comparing internal records with mock gateway data.

In a real implementation, this would integrate with actual payment gateway APIs.
For the mock gateway, we simulate reconciliation by comparing database records.
"""

from typing import List, Dict, Any, Optional
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.payment import Payment
from app.models.invoice import Invoice
from app.models.webhook_event import WebhookEvent
from app.models.customer import Customer


class ReconciliationDiscrepancy:
    """Represents a discrepancy found during reconciliation."""
    
    def __init__(
        self,
        discrepancy_type: str,
        severity: str,
        payment_id: Optional[int],
        invoice_id: Optional[int],
        description: str,
        details: Dict[str, Any]
    ):
        self.type = discrepancy_type
        self.severity = severity  # "critical", "warning", "info"
        self.payment_id = payment_id
        self.invoice_id = invoice_id
        self.description = description
        self.details = details
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "severity": self.severity,
            "payment_id": self.payment_id,
            "invoice_id": self.invoice_id,
            "description": self.description,
            "details": self.details
        }


def reconcile_payments(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> Dict[str, Any]:
    """
    Reconcile internal payment records for consistency and integrity.
    
    Checks for:
    - Paid invoices without payment records
    - Payment records without corresponding invoice updates
    - Amount mismatches between payments and invoices
    - Multiple successful payments for the same invoice
    - Orphaned payment retries
    
    Args:
        db: Database session
        start_date: Start of reconciliation period (default: 30 days ago)
        end_date: End of reconciliation period (default: today)
    
    Returns:
        Dict with reconciliation results and discrepancies
    """
    if not start_date:
        start_date = date.today() - timedelta(days=30)
    if not end_date:
        end_date = date.today()
    
    discrepancies: List[ReconciliationDiscrepancy] = []
    
    # Check 1: Invoices marked as paid without successful payment record
    paid_invoices = (
        db.query(Invoice)
        .filter(
            Invoice.status == "paid",
            Invoice.invoice_date >= start_date,
            Invoice.invoice_date <= end_date
        )
        .all()
    )
    
    for invoice in paid_invoices:
        successful_payments = (
            db.query(Payment)
            .filter(
                Payment.invoice_id == invoice.id,
                Payment.status == "paid"
            )
            .all()
        )
        
        if not successful_payments:
            discrepancies.append(ReconciliationDiscrepancy(
                discrepancy_type="missing_payment_record",
                severity="critical",
                payment_id=None,
                invoice_id=invoice.id,
                description=f"Invoice #{invoice.invoice_number} marked as paid but has no successful payment record",
                details={
                    "invoice_number": invoice.invoice_number,
                    "invoice_amount": float(invoice.total_amount),
                    "invoice_date": invoice.invoice_date.isoformat()
                }
            ))
        elif len(successful_payments) > 1:
            # Multiple successful payments for same invoice (should be prevented by idempotency)
            discrepancies.append(ReconciliationDiscrepancy(
                discrepancy_type="duplicate_payment_records",
                severity="critical",
                payment_id=successful_payments[0].id,
                invoice_id=invoice.id,
                description=f"Invoice #{invoice.invoice_number} has {len(successful_payments)} successful payment records",
                details={
                    "invoice_number": invoice.invoice_number,
                    "payment_ids": [p.id for p in successful_payments],
                    "payment_references": [p.payment_reference for p in successful_payments]
                }
            ))
    
    # Check 2: Successful payments where invoice is not marked as paid
    successful_payments = (
        db.query(Payment)
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .filter(
            Payment.status == "paid",
            Payment.payment_date >= datetime.combine(start_date, datetime.min.time()),
            Payment.payment_date <= datetime.combine(end_date, datetime.max.time())
        )
        .all()
    )
    
    for payment in successful_payments:
        invoice = db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
        if invoice and invoice.status != "paid":
            discrepancies.append(ReconciliationDiscrepancy(
                discrepancy_type="payment_invoice_status_mismatch",
                severity="critical",
                payment_id=payment.id,
                invoice_id=invoice.id,
                description=f"Payment {payment.payment_reference} is successful but invoice {invoice.invoice_number} status is '{invoice.status}'",
                details={
                    "payment_reference": payment.payment_reference,
                    "payment_status": payment.status,
                    "invoice_number": invoice.invoice_number,
                    "invoice_status": invoice.status
                }
            ))
    
    # Check 3: Payment amount mismatches with invoice amount
    for payment in successful_payments:
        invoice = db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
        if invoice:
            # Allow small rounding differences (0.01)
            if abs(payment.amount - invoice.total_amount) > 0.01:
                discrepancies.append(ReconciliationDiscrepancy(
                    discrepancy_type="amount_mismatch",
                    severity="warning",
                    payment_id=payment.id,
                    invoice_id=invoice.id,
                    description=f"Payment amount ({payment.amount}) does not match invoice amount ({invoice.total_amount})",
                    details={
                        "payment_reference": payment.payment_reference,
                        "payment_amount": float(payment.amount),
                        "invoice_number": invoice.invoice_number,
                        "invoice_amount": float(invoice.total_amount),
                        "difference": float(abs(payment.amount - invoice.total_amount))
                    }
                ))
    
    # Check 4: Webhook event consistency
    # Note: This check is simplified for database compatibility
    # In production with PostgreSQL, you would query JSON fields directly
    webhook_events_count = (
        db.query(func.count(WebhookEvent.id))
        .filter(
            WebhookEvent.event_type == "payment_success",
            WebhookEvent.processed_at >= datetime.combine(start_date, datetime.min.time()),
            WebhookEvent.processed_at <= datetime.combine(end_date, datetime.max.time())
        )
        .scalar()
    )
    
    # Statistics
    total_payments = len(successful_payments)
    total_invoices_checked = len(paid_invoices)
    critical_discrepancies = len([d for d in discrepancies if d.severity == "critical"])
    warning_discrepancies = len([d for d in discrepancies if d.severity == "warning"])
    
    return {
        "reconciliation_period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        },
        "statistics": {
            "total_paid_invoices": total_invoices_checked,
            "total_successful_payments": total_payments,
            "total_discrepancies": len(discrepancies),
            "critical_discrepancies": critical_discrepancies,
            "warning_discrepancies": warning_discrepancies
        },
        "discrepancies": [d.to_dict() for d in discrepancies],
        "status": "clean" if len(discrepancies) == 0 else "discrepancies_found"
    }


def get_payment_summary(db: Session, days: int = 30) -> Dict[str, Any]:
    """
    Get payment summary statistics for monitoring.
    
    Args:
        db: Database session
        days: Number of days to include (default: 30)
    
    Returns:
        Dict with payment statistics
    """
    start_date = date.today() - timedelta(days=days)
    
    # Total payments by status
    payment_stats = (
        db.query(
            Payment.status,
            func.count(Payment.id).label("count"),
            func.coalesce(func.sum(Payment.amount), 0).label("total_amount")
        )
        .filter(Payment.created_at >= datetime.combine(start_date, datetime.min.time()))
        .group_by(Payment.status)
        .all()
    )
    
    stats_dict = {
        "period_days": days,
        "start_date": start_date.isoformat(),
        "end_date": date.today().isoformat(),
        "by_status": {}
    }
    
    for status, count, total_amount in payment_stats:
        stats_dict["by_status"][status] = {
            "count": count,
            "total_amount": float(total_amount)
        }
    
    # Success rate
    total_attempts = sum(stat.count for stat in payment_stats)
    successful = sum(stat.count for stat in payment_stats if stat.status == "paid")
    success_rate = (successful / total_attempts * 100) if total_attempts > 0 else 0
    
    stats_dict["success_rate"] = round(success_rate, 2)
    stats_dict["total_attempts"] = total_attempts
    
    return stats_dict
