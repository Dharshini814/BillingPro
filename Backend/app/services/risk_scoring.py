"""
Risk scoring service for payment failure prediction and customer risk assessment.

Implements a deterministic, rule-based scoring system from 0-100 based on:
- Consecutive payment failures
- Retry exhaustion
- Overdue invoice duration
- Failure frequency in time windows
- Historical payment success rate

All scoring rules are configurable and explainable.
"""

from typing import Dict, List, Any, Optional, Tuple
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from app.models.payment import Payment
from app.models.invoice import Invoice
from app.models.payment_retry import PaymentRetry
from app.models.customer import Customer


# ─────────────────────────────────────────────────────────────────────────────
# Configuration: Risk Scoring Weights (0-100 total)
# ─────────────────────────────────────────────────────────────────────────────

class RiskConfig:
    """Configurable risk scoring parameters."""
    
    # Factor weights (should sum to 100)
    WEIGHT_CONSECUTIVE_FAILURES = 30
    WEIGHT_RETRY_EXHAUSTION = 25
    WEIGHT_OVERDUE_DURATION = 20
    WEIGHT_FAILURE_FREQUENCY = 15
    WEIGHT_SUCCESS_RATE = 10
    
    # Thresholds for consecutive failures
    CONSECUTIVE_FAILURES_THRESHOLDS = {
        0: 0,    # No failures
        2: 10,   # 1-2 failures
        4: 20,   # 3-4 failures
        999: 30  # 5+ failures
    }
    
    # Thresholds for exhausted retries
    EXHAUSTED_RETRIES_THRESHOLDS = {
        0: 0,    # No exhausted retries
        1: 15,   # 1 exhausted retry sequence
        999: 25  # 2+ exhausted sequences
    }
    
    # Thresholds for overdue duration (days)
    OVERDUE_DURATION_THRESHOLDS = {
        0: 0,    # Not overdue
        7: 5,    # 1-7 days
        30: 10,  # 8-30 days
        60: 15,  # 31-60 days
        999: 20  # 60+ days
    }
    
    # Failure frequency window
    FREQUENCY_WINDOW_DAYS = 30
    FREQUENCY_THRESHOLDS = {
        1: 0,    # 0-1 failures
        3: 7,    # 2-3 failures
        999: 15  # 4+ failures
    }
    
    # Success rate thresholds (percentage)
    SUCCESS_RATE_THRESHOLDS = {
        80: 0,   # >80% success
        50: 5,   # 50-80% success
        0: 10    # <50% success
    }
    
    # Risk category thresholds
    RISK_CATEGORY_LOW = 30
    RISK_CATEGORY_MEDIUM = 60
    # HIGH is anything above MEDIUM


class RiskScore:
    """Risk assessment result with score, category, and evidence."""
    
    def __init__(
        self,
        score: float,
        category: str,
        evidence: Dict[str, Any],
        factors: Dict[str, float],
        recommendations: List[str],
        data_quality: str = "sufficient"
    ):
        self.score = score
        self.category = category
        self.evidence = evidence
        self.factors = factors
        self.recommendations = recommendations
        self.data_quality = data_quality
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "risk_score": round(self.score, 2),
            "risk_category": self.category,
            "evidence": self.evidence,
            "factor_scores": {k: round(v, 2) for k, v in self.factors.items()},
            "recommendations": self.recommendations,
            "data_quality": self.data_quality
        }


def calculate_risk_score(
    db: Session,
    customer_id: Optional[int] = None,
    invoice_id: Optional[int] = None,
    payment_id: Optional[int] = None,
    config: RiskConfig = None
) -> RiskScore:
    """
    Calculate risk score for a customer, invoice, or payment.
    
    Args:
        db: Database session
        customer_id: Optional customer ID to assess
        invoice_id: Optional invoice ID to assess
        payment_id: Optional payment ID to assess
        config: Optional custom configuration (defaults to RiskConfig)
    
    Returns:
        RiskScore object with score, category, evidence, and recommendations
    
    Raises:
        ValueError: If no identifier provided or entity not found
    """
    if config is None:
        config = RiskConfig()
    
    # Determine entity to assess
    customer = None
    invoice = None
    payment = None
    
    if payment_id:
        payment = db.query(Payment).filter(Payment.id == payment_id).first()
        if not payment:
            raise ValueError(f"Payment {payment_id} not found")
        invoice_id = payment.invoice_id
    
    if invoice_id:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise ValueError(f"Invoice {invoice_id} not found")
        customer_id = invoice.customer_id
    
    if customer_id:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            raise ValueError(f"Customer {customer_id} not found")
    
    if not customer:
        raise ValueError("Must provide customer_id, invoice_id, or payment_id")
    
    # Gather evidence and calculate factor scores
    evidence = {}
    factors = {}
    
    # Factor 1: Consecutive Failures
    consecutive_failures, consecutive_details = _calculate_consecutive_failures(
        db, customer.id
    )
    evidence["consecutive_failures"] = consecutive_failures
    evidence["consecutive_failures_details"] = consecutive_details
    factors["consecutive_failures"] = _score_by_threshold(
        consecutive_failures,
        config.CONSECUTIVE_FAILURES_THRESHOLDS,
        config.WEIGHT_CONSECUTIVE_FAILURES
    )
    
    # Factor 2: Retry Exhaustion
    exhausted_retries, exhausted_details = _calculate_exhausted_retries(
        db, customer.id
    )
    evidence["exhausted_retries"] = exhausted_retries
    evidence["exhausted_retries_details"] = exhausted_details
    factors["retry_exhaustion"] = _score_by_threshold(
        exhausted_retries,
        config.EXHAUSTED_RETRIES_THRESHOLDS,
        config.WEIGHT_RETRY_EXHAUSTION
    )
    
    # Factor 3: Overdue Duration
    overdue_days, overdue_details = _calculate_overdue_duration(
        db, customer.id, invoice_id
    )
    evidence["overdue_days"] = overdue_days
    evidence["overdue_details"] = overdue_details
    factors["overdue_duration"] = _score_by_threshold(
        overdue_days,
        config.OVERDUE_DURATION_THRESHOLDS,
        config.WEIGHT_OVERDUE_DURATION
    )
    
    # Factor 4: Failure Frequency
    failure_count, frequency_details = _calculate_failure_frequency(
        db, customer.id, config.FREQUENCY_WINDOW_DAYS
    )
    evidence["recent_failures"] = failure_count
    evidence["failure_frequency_details"] = frequency_details
    factors["failure_frequency"] = _score_by_threshold(
        failure_count,
        config.FREQUENCY_THRESHOLDS,
        config.WEIGHT_FAILURE_FREQUENCY
    )
    
    # Factor 5: Success Rate
    success_rate, rate_details = _calculate_success_rate(db, customer.id)
    evidence["payment_success_rate"] = success_rate
    evidence["success_rate_details"] = rate_details
    factors["success_rate"] = _score_success_rate(
        success_rate,
        config.SUCCESS_RATE_THRESHOLDS,
        config.WEIGHT_SUCCESS_RATE
    )
    
    # Calculate total score
    total_score = sum(factors.values())
    
    # Determine risk category
    if total_score <= config.RISK_CATEGORY_LOW:
        category = "low"
    elif total_score <= config.RISK_CATEGORY_MEDIUM:
        category = "medium"
    else:
        category = "high"
    
    # Generate recommendations
    recommendations = _generate_recommendations(
        category, evidence, consecutive_failures, exhausted_retries,
        overdue_days, failure_count, success_rate
    )
    
    # Assess data quality
    data_quality = _assess_data_quality(rate_details)
    
    return RiskScore(
        score=total_score,
        category=category,
        evidence=evidence,
        factors=factors,
        recommendations=recommendations,
        data_quality=data_quality
    )


# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions: Evidence Gathering
# ─────────────────────────────────────────────────────────────────────────────

def _calculate_consecutive_failures(
    db: Session,
    customer_id: int
) -> Tuple[int, Dict[str, Any]]:
    """
    Calculate consecutive payment failures for a customer.
    
    Returns:
        (consecutive_count, details_dict)
    """
    # Get all payments for customer ordered by date
    payments = (
        db.query(Payment)
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .filter(Invoice.customer_id == customer_id)
        .order_by(Payment.created_at.desc())
        .limit(20)  # Look at last 20 payments
        .all()
    )
    
    if not payments:
        return 0, {"message": "No payment history"}
    
    consecutive = 0
    for payment in payments:
        if payment.status == "failed":
            consecutive += 1
        elif payment.status == "paid":
            break  # Stop at first success
        # Ignore pending/unpaid (not yet attempted)
    
    details = {
        "count": consecutive,
        "total_payments_checked": len(payments),
        "most_recent_status": payments[0].status if payments else None
    }
    
    return consecutive, details


def _calculate_exhausted_retries(
    db: Session,
    customer_id: int
) -> Tuple[int, Dict[str, Any]]:
    """
    Count invoices where all retry attempts have been exhausted.
    
    Returns:
        (exhausted_count, details_dict)
    """
    # Find invoices for this customer
    invoice_ids = [
        inv.id for inv in
        db.query(Invoice.id).filter(Invoice.customer_id == customer_id).all()
    ]
    
    if not invoice_ids:
        return 0, {"message": "No invoices found"}
    
    # For each invoice, check if all retries are exhausted
    exhausted_count = 0
    exhausted_invoices = []
    
    for invoice_id in invoice_ids:
        retries = db.query(PaymentRetry).filter(
            PaymentRetry.invoice_id == invoice_id
        ).all()
        
        if not retries:
            continue
        
        # Check if all retries are failed or cancelled
        all_exhausted = all(
            r.status in ("failed", "cancelled") for r in retries
        )
        
        if all_exhausted and len(retries) > 0:
            exhausted_count += 1
            exhausted_invoices.append(invoice_id)
    
    details = {
        "exhausted_invoice_count": exhausted_count,
        "exhausted_invoice_ids": exhausted_invoices[:5],  # Limit to 5 for brevity
        "total_invoices_checked": len(invoice_ids)
    }
    
    return exhausted_count, details


def _calculate_overdue_duration(
    db: Session,
    customer_id: int,
    invoice_id: Optional[int] = None
) -> Tuple[int, Dict[str, Any]]:
    """
    Calculate maximum overdue duration in days.
    
    Returns:
        (max_overdue_days, details_dict)
    """
    today = date.today()
    
    # Query unpaid invoices
    query = db.query(Invoice).filter(
        Invoice.customer_id == customer_id,
        Invoice.status == "unpaid",
        Invoice.due_date < today
    )
    
    if invoice_id:
        query = query.filter(Invoice.id == invoice_id)
    
    overdue_invoices = query.all()
    
    if not overdue_invoices:
        return 0, {"message": "No overdue invoices"}
    
    # Calculate overdue days for each
    overdue_days_list = [
        (today - inv.due_date).days for inv in overdue_invoices
    ]
    
    max_overdue = max(overdue_days_list)
    
    details = {
        "max_overdue_days": max_overdue,
        "overdue_invoice_count": len(overdue_invoices),
        "overdue_invoices": [
            {
                "invoice_id": inv.id,
                "invoice_number": inv.invoice_number,
                "days_overdue": (today - inv.due_date).days,
                "amount": float(inv.total_amount)
            }
            for inv in overdue_invoices[:5]  # Limit to 5
        ]
    }
    
    return max_overdue, details


def _calculate_failure_frequency(
    db: Session,
    customer_id: int,
    window_days: int
) -> Tuple[int, Dict[str, Any]]:
    """
    Count failed payments in recent time window.
    
    Returns:
        (failure_count, details_dict)
    """
    window_start = datetime.now() - timedelta(days=window_days)
    
    failures = (
        db.query(Payment)
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .filter(
            Invoice.customer_id == customer_id,
            Payment.status == "failed",
            Payment.created_at >= window_start
        )
        .all()
    )
    
    details = {
        "failure_count": len(failures),
        "window_days": window_days,
        "failures": [
            {
                "payment_id": p.id,
                "payment_reference": p.payment_reference,
                "amount": float(p.amount),
                "failed_at": p.created_at.isoformat() if p.created_at else None
            }
            for p in failures[:5]  # Limit to 5
        ]
    }
    
    return len(failures), details


def _calculate_success_rate(
    db: Session,
    customer_id: int
) -> Tuple[float, Dict[str, Any]]:
    """
    Calculate payment success rate percentage.
    
    Returns:
        (success_rate_percentage, details_dict)
    """
    # Get all payments for customer (exclude pending/unpaid - not yet attempted)
    payments = (
        db.query(Payment)
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .filter(
            Invoice.customer_id == customer_id,
            Payment.status.in_(["paid", "failed", "refunded"])
        )
        .all()
    )
    
    if not payments:
        return 100.0, {"message": "No payment history", "insufficient_data": True}
    
    successful = len([p for p in payments if p.status == "paid"])
    total = len(payments)
    rate = (successful / total * 100) if total > 0 else 0
    
    details = {
        "successful_payments": successful,
        "total_payments": total,
        "failed_payments": total - successful,
        "success_rate": round(rate, 2),
        "sufficient_data": total >= 5  # Need at least 5 payments for meaningful rate
    }
    
    return rate, details


# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions: Scoring
# ─────────────────────────────────────────────────────────────────────────────

def _score_by_threshold(
    value: int,
    thresholds: Dict[int, int],
    max_score: int
) -> float:
    """
    Score a value using threshold dictionary.
    
    Args:
        value: Value to score
        thresholds: Dict of {threshold: score} pairs
        max_score: Maximum possible score
    
    Returns:
        Score for this factor
    """
    # Sort thresholds ascending
    sorted_thresholds = sorted(thresholds.items())
    
    for threshold, score in sorted_thresholds:
        if value <= threshold:
            return score
    
    # If value exceeds all thresholds, return max score
    return max_score


def _score_success_rate(
    rate: float,
    thresholds: Dict[int, int],
    max_score: int
) -> float:
    """
    Score success rate (inverted - lower rate = higher score).
    """
    # Sort thresholds descending for success rate
    sorted_thresholds = sorted(thresholds.items(), reverse=True)
    
    for threshold, score in sorted_thresholds:
        if rate >= threshold:
            return score
    
    return max_score


# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions: Recommendations
# ─────────────────────────────────────────────────────────────────────────────

def _generate_recommendations(
    category: str,
    evidence: Dict[str, Any],
    consecutive_failures: int,
    exhausted_retries: int,
    overdue_days: int,
    recent_failures: int,
    success_rate: float
) -> List[str]:
    """Generate actionable recommendations based on risk factors."""
    recommendations = []
    
    if category == "high":
        recommendations.append("🔴 HIGH RISK: Manual review recommended before retry")
        
        if consecutive_failures >= 3:
            recommendations.append("Contact customer - multiple consecutive payment failures detected")
        
        if exhausted_retries > 0:
            recommendations.append("All automatic retries exhausted - manual intervention required")
        
        if overdue_days > 60:
            recommendations.append("Invoice severely overdue - consider collection workflow")
        
        recommendations.append("Verify payment method is valid before next attempt")
    
    elif category == "medium":
        recommendations.append("⚠️ MEDIUM RISK: Monitor closely")
        
        if recent_failures >= 2:
            recommendations.append("Recent payment failures - proactive communication recommended")
        
        if overdue_days > 0:
            recommendations.append(f"Invoice overdue by {overdue_days} days - send payment reminder")
        
        if success_rate < 80:
            recommendations.append("Below-average success rate - may need payment method update")
        
        recommendations.append("Consider shorter retry intervals with customer notification")
    
    else:  # low
        recommendations.append("✅ LOW RISK: Normal payment behavior")
        recommendations.append("Standard retry schedule appropriate")
        
        if success_rate == 100 and evidence.get("success_rate_details", {}).get("total_payments", 0) < 5:
            recommendations.append("Limited payment history - continue monitoring")
    
    return recommendations


def _assess_data_quality(rate_details: Dict[str, Any]) -> str:
    """Assess if we have sufficient data for meaningful risk assessment."""
    if rate_details.get("insufficient_data"):
        return "insufficient"
    
    total_payments = rate_details.get("total_payments", 0)
    
    if total_payments == 0:
        return "insufficient"
    elif total_payments < 5:
        return "limited"
    elif total_payments < 10:
        return "moderate"
    else:
        return "sufficient"
