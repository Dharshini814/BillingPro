"""
Revenue Intelligence Service
Provides MRR tracking, revenue collection metrics, forecasting, and insights.

Design Principles:
- Deterministic calculations based on real database records
- No fabricated data - returns 'insufficient_data' when history inadequate
- Transparent assumptions in forecasting
- Admin-only access enforced at router level
"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from sqlalchemy import func, and_, or_
from sqlalchemy.orm import Session
from decimal import Decimal

from app.models.subscription import Subscription
from app.models.invoice import Invoice
from app.models.payment import Payment


class RevenueIntelligenceService:
    """Service for revenue intelligence and forecasting."""
    
    def __init__(self, db: Session):
        self.db = db
    
    @staticmethod
    def _normalize_to_mrr(amount: float, billing_cycle: str) -> float:
        """
        Normalize subscription amount to Monthly Recurring Revenue.
        
        - Monthly/monthly: amount / 1
        - Yearly/year/annual: amount / 12
        - Default (unknown): treated as monthly
        """
        if billing_cycle and billing_cycle.lower() in ('year', 'yearly', 'annual'):
            return amount / 12.0
        return amount
    
    # ==================== MRR Tracking ====================
    
    def get_current_mrr(self) -> Decimal:
        """
        Calculate current Monthly Recurring Revenue.
        Formula: SUM(normalized_amount WHERE status='active')
        
        Normalization:
        - Monthly subscriptions: amount / 1
        - Yearly subscriptions: amount / 12
        """
        subscriptions = self.db.query(Subscription).filter(
            Subscription.status == "active"
        ).all()
        
        total_mrr = sum(
            self._normalize_to_mrr(sub.amount, sub.billing_cycle)
            for sub in subscriptions
        )
        
        return Decimal(str(total_mrr))
    
    def get_mrr_trend(self, months: int = 6) -> List[Dict]:
        """
        Calculate historical MRR trend for the past N months.
        
        Method: Reconstruct MRR at end of each month by:
        1. Finding subscriptions active at that point in time
        2. Active = start_date <= month_end AND (cancelled_at is NULL OR cancelled_at > month_end)
        3. Normalize yearly subscriptions to monthly equivalents
        
        Limitations:
        - Approximation based on start/cancel dates only
        - Does not capture mid-month amount changes (no change log exists)
        - Assumes amount at creation was constant until cancellation
        """
        trend = []
        today = datetime.utcnow().date()
        
        for i in range(months - 1, -1, -1):
            # Calculate month end date
            if i == 0:
                month_end = today
            else:
                month_start = today.replace(day=1) - timedelta(days=i*30)
                # Get last day of that month
                next_month = month_start.replace(day=28) + timedelta(days=4)
                month_end = next_month - timedelta(days=next_month.day)
            
            # Find subscriptions active at month_end
            subscriptions = self.db.query(Subscription).filter(
                and_(
                    Subscription.start_date <= month_end,
                    or_(
                        Subscription.cancelled_at.is_(None),
                        Subscription.cancelled_at > month_end
                    )
                )
            ).all()
            
            # Calculate normalized MRR
            mrr = sum(
                self._normalize_to_mrr(sub.amount, sub.billing_cycle)
                for sub in subscriptions
            )
            
            trend.append({
                "month": month_end.strftime("%Y-%m"),
                "mrr": float(mrr),
                "date": month_end.isoformat()
            })
        
        return trend
    
    def get_mrr_movements(self, start_date: datetime, end_date: datetime) -> Dict:
        """
        Calculate MRR movements (new, churned, expansion, contraction).
        
        Method:
        - New MRR: Sum of amounts from subscriptions that became active in period
        - Churned MRR: Sum of amounts from subscriptions cancelled in period
        - Expansion/Contraction: NOT IMPLEMENTED (no change log exists)
        
        Limitations:
        - New MRR only counts subscriptions that reached active status
        - Trials that never converted are not counted
        - Expansion/contraction cannot be reliably detected without subscription change history
        - Returns 'not_available' for these metrics with explanation
        """
        # New MRR: subscriptions created AND active in period
        # Note: This counts subscriptions that became active, not just created
        new_subscriptions = self.db.query(Subscription).filter(
            and_(
                Subscription.created_at >= start_date,
                Subscription.created_at <= end_date,
                Subscription.status == "active"  # Only count active subscriptions
            )
        ).all()
        
        new_mrr = sum(
            self._normalize_to_mrr(sub.amount, sub.billing_cycle)
            for sub in new_subscriptions
        )
        new_count = len(new_subscriptions)
        
        # Churned MRR: subscriptions cancelled in period
        churned_subscriptions = self.db.query(Subscription).filter(
            and_(
                Subscription.cancelled_at >= start_date,
                Subscription.cancelled_at <= end_date,
                Subscription.cancelled_at.isnot(None)
            )
        ).all()
        
        churned_mrr = sum(
            self._normalize_to_mrr(sub.amount, sub.billing_cycle)
            for sub in churned_subscriptions
        )
        churned_count = len(churned_subscriptions)
        
        return {
            "period_start": start_date.date().isoformat(),
            "period_end": end_date.date().isoformat(),
            "new_mrr": float(new_mrr),
            "new_count": new_count,
            "churned_mrr": float(churned_mrr),
            "churned_count": churned_count,
            "expansion_mrr": None,
            "expansion_count": None,
            "contraction_mrr": None,
            "contraction_count": None,
            "net_mrr_change": float(new_mrr - churned_mrr),
            "limitation": "Expansion/contraction not available - requires subscription change log. New MRR only counts subscriptions that became active."
        }
    
    # ==================== Collection Metrics ====================
    
    def get_collection_metrics(self, days: int = 30) -> Dict:
        """
        Calculate revenue collection metrics for the past N days.
        
        Metrics:
        - Collection Rate: (paid_invoices_amount / total_invoices_amount) * 100
        - Average Days to Payment: AVG(payment_date - invoice_date) for paid invoices
        - Overdue Revenue: SUM(Invoice.total_amount WHERE status='unpaid' AND due_date < today)
        - Current AR: SUM(Invoice.total_amount WHERE status='unpaid')
        
        Limitations:
        - Does not account for refunds (paid-then-refunded invoices still count as collected)
        - Assumes invoice.status='paid' means full amount collected (no partial payment detection)
        - Sums all amounts in original currency (no currency conversion)
        - Uses Payment.created_at as proxy for payment date (Invoice model lacks paid_at field)
        """
        start_date = datetime.utcnow() - timedelta(days=days)
        today = datetime.utcnow().date()
        
        # Total invoices issued in period
        total_invoices = self.db.query(
            func.sum(Invoice.total_amount),
            func.count(Invoice.id)
        ).filter(
            Invoice.created_at >= start_date
        ).first()
        
        total_amount = float(total_invoices[0] or 0)
        total_count = total_invoices[1] or 0
        
        # Paid invoices in period
        paid_invoices = self.db.query(
            func.sum(Invoice.total_amount),
            func.count(Invoice.id)
        ).filter(
            and_(
                Invoice.created_at >= start_date,
                Invoice.status == "paid"
            )
        ).first()
        
        paid_amount = float(paid_invoices[0] or 0)
        paid_count = paid_invoices[1] or 0
        
        # Collection rate
        collection_rate = (paid_amount / total_amount * 100) if total_amount > 0 else 0
        
        # Average days to payment (for paid invoices in period)
        # Use payment creation date as proxy for payment date
        paid_invoice_records = self.db.query(Invoice, Payment).join(
            Payment, Invoice.id == Payment.invoice_id
        ).filter(
            and_(
                Invoice.created_at >= start_date,
                Invoice.status == "paid",
                Payment.created_at.isnot(None)
            )
        ).all()
        
        days_to_payment = []
        for invoice, payment in paid_invoice_records:
            delta = (payment.created_at.date() - invoice.created_at.date()).days
            days_to_payment.append(delta)
        
        avg_days_to_payment = sum(days_to_payment) / len(days_to_payment) if days_to_payment else 0
        
        # Overdue revenue (all unpaid invoices past due date)
        overdue_revenue = self.db.query(
            func.sum(Invoice.total_amount),
            func.count(Invoice.id)
        ).filter(
            and_(
                Invoice.status == "unpaid",
                Invoice.due_date < today
            )
        ).first()
        
        overdue_amount = float(overdue_revenue[0] or 0)
        overdue_count = overdue_revenue[1] or 0
        
        # Current AR (all unpaid invoices)
        current_ar = self.db.query(
            func.sum(Invoice.total_amount),
            func.count(Invoice.id)
        ).filter(
            Invoice.status == "unpaid"
        ).first()
        
        ar_amount = float(current_ar[0] or 0)
        ar_count = current_ar[1] or 0
        
        return {
            "period_days": days,
            "period_start": start_date.date().isoformat(),
            "period_end": datetime.utcnow().date().isoformat(),
            "total_invoiced": total_amount,
            "total_invoice_count": total_count,
            "total_collected": paid_amount,
            "paid_invoice_count": paid_count,
            "collection_rate": round(collection_rate, 2),
            "avg_days_to_payment": round(avg_days_to_payment, 1),
            "overdue_revenue": overdue_amount,
            "overdue_invoice_count": overdue_count,
            "current_ar": ar_amount,
            "current_ar_count": ar_count,
            "limitations": [
                "Refunds not accounted for in collection metrics",
                "Partial payments not detected",
                "Multi-currency amounts summed without conversion"
            ]
        }
    
    # ==================== Forecasting ====================
    
    def forecast_mrr(self, months_ahead: int = 3) -> Dict:
        """
        Forecast MRR for the next N months.
        
        Method: Simple moving average with linear trend adjustment
        1. Calculate average MRR over past 3 months
        2. Calculate linear trend (slope) from past 3 months
        3. Project forward: forecast[i] = avg_mrr + trend * i
        
        Uncertainty: Increases with forecast distance
        - Near-term (1 month): Recent trend most likely to continue
        - Medium-term (2-3 months): Higher uncertainty
        - Long-term (4+ months): Significant uncertainty
        
        Returns 'insufficient_data' if less than 3 months of history available.
        
        Limitations:
        - Linear trend assumption may not hold during seasonal changes
        - Does not account for known future events (e.g., large customer churns)
        - Simple statistical method, not ML-based
        - Uncertainty labels are qualitative, not statistically derived
        """
        # Get past 3 months MRR
        trend_data = self.get_mrr_trend(months=3)
        
        if len(trend_data) < 3:
            return {
                "status": "insufficient_data",
                "message": "Need at least 3 months of history for forecasting",
                "available_months": len(trend_data)
            }
        
        # Extract MRR values
        mrr_values = [month["mrr"] for month in trend_data]
        
        # Calculate average MRR
        avg_mrr = sum(mrr_values) / len(mrr_values)
        
        # Calculate linear trend (simple: last_value - first_value / periods)
        trend_per_month = (mrr_values[-1] - mrr_values[0]) / (len(mrr_values) - 1)
        
        # Generate forecasts
        forecasts = []
        current_mrr = mrr_values[-1]
        today = datetime.utcnow().date()
        
        for i in range(1, months_ahead + 1):
            # Project forward
            forecast_value = current_mrr + (trend_per_month * i)
            
            # Calculate forecast date (approximate month end)
            forecast_date = today + timedelta(days=30 * i)
            forecast_date = forecast_date.replace(day=28)
            
            # Uncertainty increases with distance
            uncertainty_labels = {1: "Near-term", 2: "Medium-term", 3: "Long-term"}
            uncertainty = uncertainty_labels.get(i, "Extended")
            
            forecasts.append({
                "month": forecast_date.strftime("%Y-%m"),
                "forecasted_mrr": round(max(0, forecast_value), 2),
                "uncertainty": uncertainty,
                "date": forecast_date.isoformat()
            })
        
        return {
            "status": "success",
            "method": "moving_average_with_trend",
            "assumptions": [
                "Linear trend continues from past 3 months",
                "No major market changes or large customer events",
                "Historical subscription behavior remains consistent"
            ],
            "current_mrr": round(current_mrr, 2),
            "avg_mrr_3m": round(avg_mrr, 2),
            "trend_per_month": round(trend_per_month, 2),
            "forecasts": forecasts,
            "warning": "Simple statistical forecast based on linear trend. Uncertainty increases with distance. Does not account for seasonal patterns or known future events."
        }
    
    # ==================== Insights ====================
    
    def generate_insights(self) -> List[Dict]:
        """
        Generate deterministic revenue insights based on pattern detection.
        
        Insights (with evidence):
        1. MRR decline detection: >10% drop in last month vs 3-month average
        2. Churn spike detection: Churn rate >15% in last 30 days
        3. Collection degradation: Collection rate <80% in last 30 days
        4. High overdue warning: Overdue revenue >20% of current AR
        5. Growth acceleration: MRR growth >20% month-over-month
        
        Returns insights only when patterns are detected with supporting data.
        """
        insights = []
        
        # Get data for analysis
        current_mrr = float(self.get_current_mrr())
        trend_3m = self.get_mrr_trend(months=3)
        collection_30d = self.get_collection_metrics(days=30)
        movements_30d = self.get_mrr_movements(
            start_date=datetime.utcnow() - timedelta(days=30),
            end_date=datetime.utcnow()
        )
        
        # Insight 1: MRR decline detection
        if len(trend_3m) >= 3:
            avg_mrr_3m = sum(m["mrr"] for m in trend_3m[:-1]) / (len(trend_3m) - 1)
            if avg_mrr_3m > 0:
                decline_pct = ((current_mrr - avg_mrr_3m) / avg_mrr_3m) * 100
                if decline_pct < -10:
                    insights.append({
                        "type": "warning",
                        "category": "mrr_decline",
                        "title": "MRR Decline Detected",
                        "message": f"MRR has declined {abs(decline_pct):.1f}% from 3-month average",
                        "evidence": {
                            "current_mrr": current_mrr,
                            "avg_mrr_3m": round(avg_mrr_3m, 2),
                            "decline_percentage": round(decline_pct, 2)
                        },
                        "recommendation": "Review recent churned customers and identify patterns"
                    })
        
        # Insight 2: Churn spike detection
        if current_mrr > 0 and movements_30d["churned_mrr"] > 0:
            churn_rate = (movements_30d["churned_mrr"] / (current_mrr + movements_30d["churned_mrr"])) * 100
            if churn_rate > 15:
                insights.append({
                    "type": "warning",
                    "category": "churn_spike",
                    "title": "High Churn Rate",
                    "message": f"Churn rate of {churn_rate:.1f}% in last 30 days exceeds threshold",
                    "evidence": {
                        "churned_mrr": movements_30d["churned_mrr"],
                        "churned_count": movements_30d["churned_count"],
                        "churn_rate": round(churn_rate, 2)
                    },
                    "recommendation": "Conduct exit interviews and analyze cancellation reasons"
                })
        
        # Insight 3: Collection degradation
        if collection_30d["collection_rate"] < 80 and collection_30d["total_invoice_count"] >= 5:
            insights.append({
                "type": "warning",
                "category": "collection_degradation",
                "title": "Low Collection Rate",
                "message": f"Collection rate of {collection_30d['collection_rate']:.1f}% is below healthy threshold",
                "evidence": {
                    "collection_rate": collection_30d["collection_rate"],
                    "total_invoiced": collection_30d["total_invoiced"],
                    "total_collected": collection_30d["total_collected"]
                },
                "recommendation": "Review payment retry settings and dunning process"
            })
        
        # Insight 4: High overdue warning
        if collection_30d["current_ar"] > 0:
            overdue_pct = (collection_30d["overdue_revenue"] / collection_30d["current_ar"]) * 100
            if overdue_pct > 20:
                insights.append({
                    "type": "alert",
                    "category": "high_overdue",
                    "title": "High Overdue Revenue",
                    "message": f"{overdue_pct:.1f}% of AR is overdue",
                    "evidence": {
                        "overdue_revenue": collection_30d["overdue_revenue"],
                        "overdue_count": collection_30d["overdue_invoice_count"],
                        "current_ar": collection_30d["current_ar"],
                        "overdue_percentage": round(overdue_pct, 2)
                    },
                    "recommendation": "Prioritize collection efforts on overdue accounts"
                })
        
        # Insight 5: Growth acceleration (positive signal)
        if len(trend_3m) >= 2:
            prev_mrr = trend_3m[-2]["mrr"]
            if prev_mrr > 0:
                growth_pct = ((current_mrr - prev_mrr) / prev_mrr) * 100
                if growth_pct > 20:
                    insights.append({
                        "type": "success",
                        "category": "growth_acceleration",
                        "title": "Strong MRR Growth",
                        "message": f"MRR grew {growth_pct:.1f}% month-over-month",
                        "evidence": {
                            "current_mrr": current_mrr,
                            "previous_mrr": prev_mrr,
                            "growth_percentage": round(growth_pct, 2),
                            "new_mrr": movements_30d["new_mrr"],
                            "new_customers": movements_30d["new_count"]
                        },
                        "recommendation": "Analyze successful acquisition channels and scale"
                    })
        
        # If no patterns detected
        if not insights:
            insights.append({
                "type": "info",
                "category": "healthy",
                "title": "Revenue Metrics Healthy",
                "message": "No concerning patterns detected in revenue metrics",
                "evidence": {
                    "current_mrr": current_mrr,
                    "collection_rate": collection_30d["collection_rate"],
                    "overdue_percentage": round((collection_30d["overdue_revenue"] / collection_30d["current_ar"] * 100) if collection_30d["current_ar"] > 0 else 0, 2)
                },
                "recommendation": "Continue monitoring key metrics"
            })
        
        return insights
    
    def get_revenue_summary(self) -> Dict:
        """
        Get comprehensive revenue intelligence summary.
        Combines MRR, collection metrics, and insights in one call.
        """
        current_mrr = float(self.get_current_mrr())
        trend_6m = self.get_mrr_trend(months=6)
        collection_30d = self.get_collection_metrics(days=30)
        forecast = self.forecast_mrr(months_ahead=3)
        insights = self.generate_insights()
        
        # Calculate MRR growth rate
        mrr_growth_rate = 0
        if len(trend_6m) >= 2:
            prev_mrr = trend_6m[-2]["mrr"]
            if prev_mrr > 0:
                mrr_growth_rate = ((current_mrr - prev_mrr) / prev_mrr) * 100
        
        return {
            "current_mrr": current_mrr,
            "mrr_growth_rate": round(mrr_growth_rate, 2),
            "collection_rate": collection_30d["collection_rate"],
            "overdue_revenue": collection_30d["overdue_revenue"],
            "current_ar": collection_30d["current_ar"],
            "mrr_trend": trend_6m,
            "forecast": forecast,
            "insights": insights,
            "generated_at": datetime.utcnow().isoformat()
        }
