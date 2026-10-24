"""
Revenue Intelligence Router
Admin-only endpoints for revenue analytics, MRR tracking, and forecasting.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional

from app.database import get_db
from app.core.auth import get_current_user, require_admin
from app.models.user import User
from app.services.revenue_intelligence import RevenueIntelligenceService


router = APIRouter(prefix="/revenue", tags=["Revenue Intelligence"])


@router.get("/mrr")
async def get_current_mrr(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get current Monthly Recurring Revenue (MRR).
    Admin only.
    """
    service = RevenueIntelligenceService(db)
    current_mrr = service.get_current_mrr()
    
    return {
        "current_mrr": float(current_mrr),
        "currency": "USD",
        "as_of": datetime.utcnow().isoformat()
    }


@router.get("/mrr-trend")
async def get_mrr_trend(
    months: int = Query(default=6, ge=1, le=24, description="Number of months to retrieve"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get historical MRR trend for the past N months.
    Admin only.
    
    Note: Approximation based on subscription start/cancel dates.
    Does not capture mid-month amount changes.
    """
    service = RevenueIntelligenceService(db)
    trend = service.get_mrr_trend(months=months)
    
    return {
        "trend": trend,
        "months": months,
        "limitation": "Approximation based on subscription start/cancel dates only"
    }


@router.get("/collection-metrics")
async def get_collection_metrics(
    days: int = Query(default=30, ge=1, le=365, description="Number of days to analyze"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get revenue collection metrics for the past N days.
    Admin only.
    
    Includes:
    - Collection rate
    - Average days to payment
    - Overdue revenue
    - Current accounts receivable
    """
    service = RevenueIntelligenceService(db)
    metrics = service.get_collection_metrics(days=days)
    
    return metrics


@router.get("/movements")
async def get_mrr_movements(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get MRR movements (new, churned) for a date range.
    Admin only.
    
    Defaults to last 30 days if dates not provided.
    
    Note: Expansion/contraction not available (requires subscription change log).
    """
    # Parse dates or use defaults
    if end_date:
        end = datetime.fromisoformat(end_date)
    else:
        end = datetime.utcnow()
    
    if start_date:
        start = datetime.fromisoformat(start_date)
    else:
        start = end - timedelta(days=30)
    
    service = RevenueIntelligenceService(db)
    movements = service.get_mrr_movements(start_date=start, end_date=end)
    
    return movements


@router.get("/forecast")
async def forecast_mrr(
    months: int = Query(default=3, ge=1, le=12, description="Months to forecast ahead"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Forecast MRR for the next N months.
    Admin only.
    
    Method: Simple moving average with linear trend adjustment.
    Requires at least 3 months of historical data.
    
    WARNING: Simple statistical forecast. Confidence decreases with distance.
    Not ML-based. Review assumptions regularly.
    """
    service = RevenueIntelligenceService(db)
    forecast = service.forecast_mrr(months_ahead=months)
    
    return forecast


@router.get("/insights")
async def get_revenue_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get deterministic revenue insights based on pattern detection.
    Admin only.
    
    Detects:
    - MRR decline
    - Churn spikes
    - Collection degradation
    - High overdue revenue
    - Growth acceleration
    
    Returns insights with evidence and recommendations.
    """
    service = RevenueIntelligenceService(db)
    insights = service.generate_insights()
    
    return {
        "insights": insights,
        "generated_at": datetime.utcnow().isoformat()
    }


@router.get("/summary")
async def get_revenue_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get comprehensive revenue intelligence summary.
    Admin only.
    
    Combines MRR, trend, collection metrics, forecast, and insights in one call.
    Optimized for dashboard display.
    """
    service = RevenueIntelligenceService(db)
    summary = service.get_revenue_summary()
    
    return summary
