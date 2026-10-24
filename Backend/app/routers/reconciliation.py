"""
Reconciliation API endpoints for payment integrity monitoring.

Provides endpoints for:
- Payment reconciliation reports
- Payment statistics and monitoring
- Discrepancy detection
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from datetime import date, timedelta
from typing import Optional

from app.database import get_db
from app.core.auth import require_admin
from app.services.reconciliation import reconcile_payments, get_payment_summary


router = APIRouter(
    prefix="/reconciliation",
    tags=["Reconciliation"],
    dependencies=[Depends(require_admin)],  # Admin-only endpoints
)


@router.get("/payments")
def reconcile_payment_records(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """
    Reconcile payment records for consistency and integrity.
    
    Admin-only endpoint that checks for:
    - Paid invoices without payment records
    - Payment records without invoice updates
    - Amount mismatches
    - Duplicate payments
    
    Returns a report with discrepancies found.
    """
    # Parse dates
    start = None
    end = None
    
    if start_date:
        try:
            start = date.fromisoformat(start_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    
    if end_date:
        try:
            end = date.fromisoformat(end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    # Default to last 30 days if not specified
    if not start:
        start = date.today() - timedelta(days=30)
    if not end:
        end = date.today()
    
    # Validate date range
    if start > end:
        raise HTTPException(status_code=400, detail="start_date must be before end_date")
    
    if (end - start).days > 365:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 365 days")
    
    # Run reconciliation
    result = reconcile_payments(db, start_date=start, end_date=end)
    
    return result


@router.get("/payments/summary")
def get_payment_statistics(
    days: int = Query(30, ge=1, le=365, description="Number of days to include (1-365)"),
    db: Session = Depends(get_db)
):
    """
    Get payment summary statistics for the specified period.
    
    Returns:
    - Payment counts by status
    - Total amounts by status
    - Success rate
    - Period information
    """
    summary = get_payment_summary(db, days=days)
    return summary


@router.get("/health")
def reconciliation_health_check(db: Session = Depends(get_db)):
    """
    Quick health check for recent payment integrity.
    
    Checks the last 7 days for critical discrepancies.
    Returns status and count of issues found.
    """
    end_date = date.today()
    start_date = end_date - timedelta(days=7)
    
    result = reconcile_payments(db, start_date=start_date, end_date=end_date)
    
    critical_count = result["statistics"]["critical_discrepancies"]
    
    return {
        "status": "healthy" if critical_count == 0 else "issues_detected",
        "period_days": 7,
        "critical_discrepancies": critical_count,
        "total_discrepancies": result["statistics"]["total_discrepancies"],
        "message": "No critical issues found" if critical_count == 0 else f"{critical_count} critical discrepancies detected"
    }
