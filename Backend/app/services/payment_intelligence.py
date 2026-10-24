"""
Payment intelligence service for detecting failure patterns and providing insights.

Analyzes payment and invoice data to identify:
- Failed payment patterns
- Overdue invoices requiring attention
- Retry status and exhaustion
- Risk-based prioritization
"""

from typing import List, Dict, Any, Optional
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc

from app.models.payment import Payment
from app.models.invoice import Invoice
from app.models.payment_retry import PaymentRetry
from app.models.customer import Customer
from app.services.risk_scoring import calculate_risk_score, RiskConfig


class FailedPaymentInsight:
    """Enriched failed payment with risk assessment and context."""
    
    def __init__(
        self,
        payment: Payment,
        invoice: Invoice,
        customer: Customer,
        risk_score: float,
        risk_category: str,
        retry_info: Dict[str, Any],
        overdue_days: int = 0
    ):
        self.payment = payment
        self.invoice = invoice
        self.customer = customer
        self.risk_score = risk_score
        self.risk_category = risk_category
        self.retry_info = retry_info
        self.overdue_days = overdue_days
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "payment": {
                "id": self.payment.id,
                "payment_reference": self.payment.payment_reference,
                "amount": float(self.payment.amount),
                "payment_method": self.payment.payment_method,
                "status": self.payment.status,
                "failed_at": self.payment.created_at.isoformat() if self.payment.created_at else None
            },
            "invoice": {
                "id": self.invoice.id,
                "invoice_number": self.invoice.invoice_number,
                "total_amount": float(self.invoice.total_amount),
                "status": self.invoice.status,
                "due_date": self.invoice.due_date.isoformat(),
                "overdue_days": self.overdue_days
            },
            "customer": {
                "id": self.customer.id,
                "name": self.customer.name,
                "email": self.customer.email,
                "status": self.customer.status
            },
            "risk_assessment": {
                "risk_score": round(self.risk_score, 2),
                "risk_category": self.risk_category
            },
            "retry_status": self.retry_info
        }


def get_failed_payments_with_risk(
    db: Session,
    limit: int = 50,
    offset: int = 0,
    min_risk_score: Optional[float] = None,
    risk_category: Optional[str] = None,
    days_back: int = 30
) -> Dict[str, Any]:
    """
    Get failed payments with risk assessment.
    
    Args:
        db: Database session
        limit: Maximum number of results
        offset: Pagination offset
        min_risk_score: Filter by minimum risk score
        risk_category: Filter by risk category (low, medium, high)
        days_back: Look back this many days
    
    Returns:
        Dict with failed payments, risk scores, and pagination info
    """
    cutoff_date = datetime.now() - timedelta(days=days_back)
    
    # Query failed payments
    query = (
        db.query(Payment)
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .join(Customer, Invoice.customer_id == Customer.id)
        .filter(
            Payment.status == "failed",
            Payment.created_at >= cutoff_date
        )
        .order_by(desc(Payment.created_at))
    )
    
    total = query.count()
    payments = query.offset(offset).limit(limit).all()
    
    # Enrich with risk scores and retry info
    insights = []
    for payment in payments:
        invoice = payment.invoice
        customer = db.query(Customer).filter(Customer.id == invoice.customer_id).first()
        
        # Calculate risk score
        try:
            risk_result = calculate_risk_score(db, payment_id=payment.id)
            risk_score = risk_result.score
            risk_cat = risk_result.category
        except Exception:
            # Fallback if risk calculation fails
            risk_score = 0
            risk_cat = "unknown"
        
        # Skip if doesn't meet filter criteria
        if min_risk_score and risk_score < min_risk_score:
            continue
        if risk_category and risk_cat != risk_category.lower():
            continue
        
        # Get retry information
        retry_info = _get_retry_info(db, payment.id, invoice.id)
        
        # Calculate overdue days
        today = date.today()
        overdue_days = (today - invoice.due_date).days if invoice.due_date < today else 0
        
        insight = FailedPaymentInsight(
            payment=payment,
            invoice=invoice,
            customer=customer,
            risk_score=risk_score,
            risk_category=risk_cat,
            retry_info=retry_info,
            overdue_days=max(0, overdue_days)
        )
        insights.append(insight)
    
    # Sort by risk score descending
    insights.sort(key=lambda x: x.risk_score, reverse=True)
    
    return {
        "items": [insight.to_dict() for insight in insights],
        "total": total,
        "limit": limit,
        "offset": offset,
        "filters": {
            "days_back": days_back,
            "min_risk_score": min_risk_score,
            "risk_category": risk_category
        }
    }


def get_overdue_invoices_with_risk(
    db: Session,
    limit: int = 50,
    offset: int = 0,
    min_overdue_days: int = 0
) -> Dict[str, Any]:
    """
    Get overdue invoices with risk assessment.
    
    Args:
        db: Database session
        limit: Maximum results
        offset: Pagination offset
        min_overdue_days: Minimum days overdue
    
    Returns:
        Dict with overdue invoices and risk scores
    """
    today = date.today()
    cutoff_date = today - timedelta(days=min_overdue_days)
    
    # Query overdue unpaid invoices
    query = (
        db.query(Invoice)
        .join(Customer, Invoice.customer_id == Customer.id)
        .filter(
            Invoice.status == "unpaid",
            Invoice.due_date < cutoff_date
        )
        .order_by(Invoice.due_date)
    )
    
    total = query.count()
    invoices = query.offset(offset).limit(limit).all()
    
    results = []
    for invoice in invoices:
        customer = db.query(Customer).filter(Customer.id == invoice.customer_id).first()
        
        # Calculate risk
        try:
            risk_result = calculate_risk_score(db, invoice_id=invoice.id)
            risk_score = risk_result.score
            risk_cat = risk_result.category
        except Exception:
            risk_score = 0
            risk_cat = "unknown"
        
        overdue_days = (today - invoice.due_date).days
        
        # Get payment attempts for this invoice
        payment_attempts = db.query(Payment).filter(
            Payment.invoice_id == invoice.id
        ).count()
        
        # Get retry status
        retries = db.query(PaymentRetry).filter(
            PaymentRetry.invoice_id == invoice.id
        ).all()
        
        retry_status = {
            "total_attempts": payment_attempts,
            "scheduled_retries": len([r for r in retries if r.status == "pending"]),
            "failed_retries": len([r for r in retries if r.status == "failed"]),
            "exhausted": all(r.status in ("failed", "cancelled") for r in retries) if retries else False
        }
        
        results.append({
            "invoice": {
                "id": invoice.id,
                "invoice_number": invoice.invoice_number,
                "total_amount": float(invoice.total_amount),
                "status": invoice.status,
                "due_date": invoice.due_date.isoformat(),
                "overdue_days": overdue_days,
                "invoice_date": invoice.invoice_date.isoformat()
            },
            "customer": {
                "id": customer.id,
                "name": customer.name,
                "email": customer.email,
                "status": customer.status
            },
            "risk_assessment": {
                "risk_score": round(risk_score, 2),
                "risk_category": risk_cat
            },
            "retry_status": retry_status
        })
    
    # Sort by risk score descending
    results.sort(key=lambda x: x["risk_assessment"]["risk_score"], reverse=True)
    
    return {
        "items": results,
        "total": total,
        "limit": limit,
        "offset": offset,
        "filters": {
            "min_overdue_days": min_overdue_days
        }
    }


def get_failure_summary(db: Session) -> Dict[str, Any]:
    """
    Get aggregate failure statistics and insights.
    
    Returns:
        Dict with failure metrics, risk distribution, and trends
    """
    # Time windows
    today = date.today()
    last_7_days = datetime.now() - timedelta(days=7)
    last_30_days = datetime.now() - timedelta(days=30)
    
    # Failed payments by time window
    failed_7_days = db.query(func.count(Payment.id)).filter(
        Payment.status == "failed",
        Payment.created_at >= last_7_days
    ).scalar()
    
    failed_30_days = db.query(func.count(Payment.id)).filter(
        Payment.status == "failed",
        Payment.created_at >= last_30_days
    ).scalar()
    
    # Total failures
    total_failed = db.query(func.count(Payment.id)).filter(
        Payment.status == "failed"
    ).scalar()
    
    # Overdue invoices
    overdue_count = db.query(func.count(Invoice.id)).filter(
        Invoice.status == "unpaid",
        Invoice.due_date < today
    ).scalar()
    
    overdue_amount = db.query(func.coalesce(func.sum(Invoice.total_amount), 0)).filter(
        Invoice.status == "unpaid",
        Invoice.due_date < today
    ).scalar()
    
    # Exhausted retries
    exhausted_retries = _count_exhausted_retries(db)
    
    # Risk distribution (sample recent failed payments)
    recent_failed = (
        db.query(Payment)
        .filter(
            Payment.status == "failed",
            Payment.created_at >= last_30_days
        )
        .limit(100)
        .all()
    )
    
    risk_distribution = {"high": 0, "medium": 0, "low": 0, "unknown": 0}
    
    for payment in recent_failed:
        try:
            risk_result = calculate_risk_score(db, payment_id=payment.id)
            risk_distribution[risk_result.category] += 1
        except Exception:
            risk_distribution["unknown"] += 1
    
    # Payment success rate (last 30 days)
    total_payments_30d = db.query(func.count(Payment.id)).filter(
        Payment.created_at >= last_30_days,
        Payment.status.in_(["paid", "failed"])
    ).scalar()
    
    successful_payments_30d = db.query(func.count(Payment.id)).filter(
        Payment.created_at >= last_30_days,
        Payment.status == "paid"
    ).scalar()
    
    success_rate = (successful_payments_30d / total_payments_30d * 100) if total_payments_30d > 0 else 0
    
    return {
        "failures": {
            "last_7_days": failed_7_days,
            "last_30_days": failed_30_days,
            "total": total_failed
        },
        "overdue": {
            "count": overdue_count,
            "total_amount": float(overdue_amount)
        },
        "retries": {
            "exhausted_count": exhausted_retries
        },
        "risk_distribution": risk_distribution,
        "success_rate": {
            "last_30_days": round(success_rate, 2),
            "successful": successful_payments_30d,
            "total_attempts": total_payments_30d
        }
    }


def detect_payment_failure_patterns(
    db: Session,
    customer_id: int
) -> Dict[str, Any]:
    """
    Detect specific failure patterns for a customer.
    
    Returns:
        Dict with detected patterns and severity
    """
    patterns = []
    
    # Get customer payments
    payments = (
        db.query(Payment)
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .filter(Invoice.customer_id == customer_id)
        .order_by(desc(Payment.created_at))
        .limit(50)
        .all()
    )
    
    if not payments:
        return {
            "customer_id": customer_id,
            "patterns": [],
            "severity": "none",
            "message": "No payment history available"
        }
    
    # Pattern 1: High consecutive failure rate
    consecutive_failures = 0
    for p in payments:
        if p.status == "failed":
            consecutive_failures += 1
        elif p.status == "paid":
            break
    
    if consecutive_failures >= 5:
        patterns.append({
            "type": "chronic_failure",
            "severity": "high",
            "description": f"{consecutive_failures} consecutive payment failures",
            "recommendation": "Contact customer immediately - payment method likely invalid"
        })
    elif consecutive_failures >= 3:
        patterns.append({
            "type": "repeated_failure",
            "severity": "medium",
            "description": f"{consecutive_failures} consecutive payment failures",
            "recommendation": "Verify payment method with customer"
        })
    
    # Pattern 2: Sudden failure spike
    last_30_days = datetime.now() - timedelta(days=30)
    recent_payments = [p for p in payments if p.created_at >= last_30_days]
    
    if len(recent_payments) >= 5:
        recent_failures = len([p for p in recent_payments if p.status == "failed"])
        failure_rate = recent_failures / len(recent_payments)
        
        if failure_rate > 0.6:
            patterns.append({
                "type": "high_failure_rate",
                "severity": "medium",
                "description": f"{int(failure_rate * 100)}% failure rate in last 30 days",
                "recommendation": "Payment method may need updating"
            })
    
    # Pattern 3: Exhausted retries
    invoices = db.query(Invoice).filter(Invoice.customer_id == customer_id).all()
    exhausted_count = 0
    
    for invoice in invoices:
        retries = db.query(PaymentRetry).filter(
            PaymentRetry.invoice_id == invoice.id
        ).all()
        if retries and all(r.status in ("failed", "cancelled") for r in retries):
            exhausted_count += 1
    
    if exhausted_count > 0:
        patterns.append({
            "type": "exhausted_retries",
            "severity": "high",
            "description": f"{exhausted_count} invoices with exhausted retry attempts",
            "recommendation": "Manual intervention required - automatic retries have failed"
        })
    
    # Determine overall severity
    if any(p["severity"] == "high" for p in patterns):
        severity = "high"
    elif any(p["severity"] == "medium" for p in patterns):
        severity = "medium"
    else:
        severity = "low"
    
    return {
        "customer_id": customer_id,
        "patterns": patterns,
        "severity": severity,
        "total_payments_analyzed": len(payments)
    }


# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────────────────────

def _get_retry_info(db: Session, payment_id: int, invoice_id: int) -> Dict[str, Any]:
    """Get retry status for a payment/invoice."""
    retries = db.query(PaymentRetry).filter(
        PaymentRetry.invoice_id == invoice_id
    ).all()
    
    if not retries:
        return {
            "has_retries": False,
            "total_attempts": 0,
            "next_retry": None
        }
    
    pending_retries = [r for r in retries if r.status == "pending"]
    failed_retries = [r for r in retries if r.status == "failed"]
    
    next_retry = None
    if pending_retries:
        next_retry = min(pending_retries, key=lambda r: r.scheduled_date)
    
    return {
        "has_retries": True,
        "total_attempts": len(retries),
        "pending": len(pending_retries),
        "failed": len(failed_retries),
        "exhausted": all(r.status in ("failed", "cancelled") for r in retries),
        "next_retry_date": next_retry.scheduled_date.isoformat() if next_retry else None,
        "next_retry_attempt": next_retry.attempt_number if next_retry else None
    }


def _count_exhausted_retries(db: Session) -> int:
    """Count total exhausted retry sequences."""
    # Get all invoices with retries
    invoices_with_retries = (
        db.query(PaymentRetry.invoice_id)
        .distinct()
        .all()
    )
    
    exhausted = 0
    for (invoice_id,) in invoices_with_retries:
        retries = db.query(PaymentRetry).filter(
            PaymentRetry.invoice_id == invoice_id
        ).all()
        
        if retries and all(r.status in ("failed", "cancelled") for r in retries):
            exhausted += 1
    
    return exhausted
