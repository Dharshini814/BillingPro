"""
Risk Assessment API endpoints.

Provides risk scoring and payment intelligence insights for:
- Individual payments and customers
- Failed payment analysis
- Overdue invoice monitoring
- Failure pattern detection
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.core.auth import get_current_user, require_admin
from app.core.customer_auth import get_authorized_customer_email, verify_customer_access
from app.models.user import User
from app.services.risk_scoring import calculate_risk_score, RiskConfig
from app.services.payment_intelligence import (
    get_failed_payments_with_risk,
    get_overdue_invoices_with_risk,
    get_failure_summary,
    detect_payment_failure_patterns
)


router = APIRouter(prefix="/risk", tags=["Risk Assessment"])


@router.get("/payments/{payment_id}")
def assess_payment_risk(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get risk assessment for a specific payment.
    
    Requires authentication. Users can only access their own payments unless admin.
    
    Returns:
        Risk score (0-100), category, evidence, factors, and recommendations
    """
    try:
        # Calculate risk score (handles authorization internally via invoice/customer)
        risk_result = calculate_risk_score(db, payment_id=payment_id)
        
        # Verify customer access if not admin
        if current_user.role != "admin":
            from app.models.payment import Payment
            from app.models.invoice import Invoice
            
            payment = db.query(Payment).filter(Payment.id == payment_id).first()
            if not payment:
                raise HTTPException(status_code=404, detail="Payment not found")
            
            invoice = db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
            if not invoice:
                raise HTTPException(status_code=404, detail="Invoice not found")
            
            # Verify user has access to this customer's data
            authorized_email = get_authorized_customer_email(current_user, db)
            verify_customer_access(invoice.customer_id, authorized_email, db)
        
        return risk_result.to_dict()
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk assessment failed: {str(e)}")


@router.get("/customers/{customer_id}")
def assess_customer_risk(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get risk assessment for a customer's overall payment behavior.
    
    Requires authentication. Users can only access their own profile unless admin.
    """
    # Verify customer access
    if current_user.role != "admin":
        authorized_email = get_authorized_customer_email(current_user, db)
        verify_customer_access(customer_id, authorized_email, db)
    
    try:
        risk_result = calculate_risk_score(db, customer_id=customer_id)
        
        # Add pattern detection
        patterns = detect_payment_failure_patterns(db, customer_id)
        
        result = risk_result.to_dict()
        result["failure_patterns"] = patterns
        
        return result
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk assessment failed: {str(e)}")


@router.get("/invoices/{invoice_id}")
def assess_invoice_risk(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get risk assessment for a specific invoice.
    
    Requires authentication. Users can only access their own invoices unless admin.
    """
    try:
        # Calculate risk
        risk_result = calculate_risk_score(db, invoice_id=invoice_id)
        
        # Verify customer access if not admin
        if current_user.role != "admin":
            from app.models.invoice import Invoice
            
            invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
            if not invoice:
                raise HTTPException(status_code=404, detail="Invoice not found")
            
            authorized_email = get_authorized_customer_email(current_user, db)
            verify_customer_access(invoice.customer_id, authorized_email, db)
        
        return risk_result.to_dict()
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk assessment failed: {str(e)}")


@router.get("/failed-payments", dependencies=[Depends(require_admin)])
def list_failed_payments_with_risk(
    limit: int = Query(50, ge=1, le=100, description="Maximum results per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    min_risk_score: Optional[float] = Query(None, ge=0, le=100, description="Filter by minimum risk score"),
    risk_category: Optional[str] = Query(None, description="Filter by risk category (low, medium, high)"),
    days_back: int = Query(30, ge=1, le=365, description="Look back this many days"),
    db: Session = Depends(get_db)
):
    """
    List failed payments with risk assessment and retry information.
    
    Admin-only endpoint for monitoring payment failures.
    
    Returns paginated list of failed payments sorted by risk score.
    """
    if risk_category and risk_category.lower() not in ["low", "medium", "high"]:
        raise HTTPException(
            status_code=400,
            detail="risk_category must be 'low', 'medium', or 'high'"
        )
    
    try:
        result = get_failed_payments_with_risk(
            db=db,
            limit=limit,
            offset=offset,
            min_risk_score=min_risk_score,
            risk_category=risk_category,
            days_back=days_back
        )
        return result
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve failed payments: {str(e)}"
        )


@router.get("/overdue-invoices", dependencies=[Depends(require_admin)])
def list_overdue_invoices_with_risk(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    min_overdue_days: int = Query(0, ge=0, le=365, description="Minimum days overdue"),
    db: Session = Depends(get_db)
):
    """
    List overdue invoices with risk assessment.
    
    Admin-only endpoint for monitoring overdue payments.
    
    Returns paginated list sorted by risk score.
    """
    try:
        result = get_overdue_invoices_with_risk(
            db=db,
            limit=limit,
            offset=offset,
            min_overdue_days=min_overdue_days
        )
        return result
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve overdue invoices: {str(e)}"
        )


@router.get("/summary", dependencies=[Depends(require_admin)])
def get_risk_summary(db: Session = Depends(get_db)):
    """
    Get aggregate risk and failure statistics.
    
    Admin-only endpoint providing overview of:
    - Failed payment counts by time period
    - Overdue invoice totals
    - Exhausted retry counts
    - Risk distribution
    - Payment success rates
    
    Useful for dashboard widgets and monitoring.
    """
    try:
        summary = get_failure_summary(db)
        return summary
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate risk summary: {str(e)}"
        )


@router.get("/patterns/{customer_id}")
def detect_customer_patterns(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Detect failure patterns for a specific customer.
    
    Identifies:
    - Chronic consecutive failures
    - High failure rates
    - Exhausted retry sequences
    
    Returns detected patterns with severity and recommendations.
    """
    # Verify customer access
    if current_user.role != "admin":
        authorized_email = get_authorized_customer_email(current_user, db)
        verify_customer_access(customer_id, authorized_email, db)
    
    try:
        patterns = detect_payment_failure_patterns(db, customer_id)
        return patterns
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Pattern detection failed: {str(e)}"
        )


@router.get("/config")
def get_risk_config():
    """
    Get current risk scoring configuration.
    
    Returns weights, thresholds, and category boundaries.
    Useful for understanding how risk scores are calculated.
    """
    config = RiskConfig()
    
    return {
        "weights": {
            "consecutive_failures": config.WEIGHT_CONSECUTIVE_FAILURES,
            "retry_exhaustion": config.WEIGHT_RETRY_EXHAUSTION,
            "overdue_duration": config.WEIGHT_OVERDUE_DURATION,
            "failure_frequency": config.WEIGHT_FAILURE_FREQUENCY,
            "success_rate": config.WEIGHT_SUCCESS_RATE
        },
        "thresholds": {
            "consecutive_failures": config.CONSECUTIVE_FAILURES_THRESHOLDS,
            "exhausted_retries": config.EXHAUSTED_RETRIES_THRESHOLDS,
            "overdue_duration": config.OVERDUE_DURATION_THRESHOLDS,
            "failure_frequency": config.FREQUENCY_THRESHOLDS,
            "success_rate": config.SUCCESS_RATE_THRESHOLDS
        },
        "risk_categories": {
            "low": f"0-{config.RISK_CATEGORY_LOW}",
            "medium": f"{config.RISK_CATEGORY_LOW + 1}-{config.RISK_CATEGORY_MEDIUM}",
            "high": f"{config.RISK_CATEGORY_MEDIUM + 1}-100"
        },
        "frequency_window_days": config.FREQUENCY_WINDOW_DAYS
    }
