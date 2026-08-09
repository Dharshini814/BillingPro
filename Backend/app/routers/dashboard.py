from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta

from app.database import get_db
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.subscription import Subscription
from app.models.customer import Customer

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    # ── KPIs ──────────────────────────────────────────────────────────────────
    total_revenue = db.query(func.coalesce(func.sum(Invoice.total_amount), 0)) \
        .filter(Invoice.status == "paid").scalar()

    active_subs = db.query(func.count(Subscription.id)) \
        .filter(Subscription.status == "active").scalar()

    mrr = db.query(func.coalesce(func.sum(Subscription.amount), 0)) \
        .filter(Subscription.status == "active").scalar()

    failed_payments = db.query(func.count(Payment.id)) \
        .filter(Payment.status == "failed").scalar()

    customers_count = db.query(func.count(Customer.id)).scalar()

    pending_invoices = db.query(func.count(Invoice.id)) \
        .filter(Invoice.status == "unpaid").scalar()

    # ── Revenue Trend (last 6 months) ─────────────────────────────────────────
    today = date.today()
    revenue_trend = []
    for i in range(5, -1, -1):
        month_start = (today.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        if month_start.month == 12:
            month_end = month_start.replace(year=month_start.year + 1, month=1, day=1)
        else:
            month_end = month_start.replace(month=month_start.month + 1, day=1)

        rev = db.query(func.coalesce(func.sum(Invoice.total_amount), 0)) \
            .filter(
                Invoice.status == "paid",
                Invoice.invoice_date >= month_start,
                Invoice.invoice_date < month_end
            ).scalar()

        revenue_trend.append({
            "month": month_start.strftime("%b"),
            "revenue": float(rev)
        })

    # ── Plan Distribution ─────────────────────────────────────────────────────
    from app.models.plan import Plan
    plan_rows = (
        db.query(Plan.name, func.count(Subscription.id).label("count"))
        .join(Subscription, Subscription.plan_id == Plan.id)
        .filter(Subscription.status == "active")
        .group_by(Plan.name)
        .all()
    )
    plan_distribution = [{"name": row.name, "value": row.count} for row in plan_rows]

    # ── Subscription Growth (last 6 months) ───────────────────────────────────
    sub_growth = []
    for i in range(5, -1, -1):
        month_start = (today.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        if month_start.month == 12:
            month_end = month_start.replace(year=month_start.year + 1, month=1, day=1)
        else:
            month_end = month_start.replace(month=month_start.month + 1, day=1)

        new_subs = db.query(func.count(Subscription.id)) \
            .filter(
                Subscription.start_date >= month_start,
                Subscription.start_date < month_end
            ).scalar()

        sub_growth.append({
            "month": month_start.strftime("%b"),
            "subscriptions": new_subs
        })

    # ── Payment Success Rate (last 6 months) ──────────────────────────────────
    payment_success_rate = []
    for i in range(5, -1, -1):
        month_start = (today.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        if month_start.month == 12:
            month_end = month_start.replace(year=month_start.year + 1, month=1, day=1)
        else:
            month_end = month_start.replace(month=month_start.month + 1, day=1)

        total_p = db.query(func.count(Payment.id)) \
            .filter(
                Payment.payment_date >= month_start,
                Payment.payment_date < month_end
            ).scalar()

        success_p = db.query(func.count(Payment.id)) \
            .filter(
                Payment.status == "paid",
                Payment.payment_date >= month_start,
                Payment.payment_date < month_end
            ).scalar()

        rate = round((success_p / total_p) * 100, 1) if total_p > 0 else 0

        payment_success_rate.append({
            "month": month_start.strftime("%b"),
            "rate": rate
        })

    return {
        "kpis": {
            "totalRevenue": float(total_revenue),
            "activeSubscriptions": active_subs,
            "mrr": float(mrr),
            "failedPayments": failed_payments,
            "customersCount": customers_count,
            "pendingInvoices": pending_invoices,
        },
        "revenueTrend": revenue_trend,
        "planDistribution": plan_distribution,
        "subscriptionGrowth": sub_growth,
        "paymentSuccessRate": payment_success_rate,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  M3 – Task 1: Admin Dashboard & Subscription Metrics
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """
    Returns high-level KPIs:
      total_customers, active_subscriptions, cancelled_subscriptions,
      mrr, churn_rate, trial_conversion_rate
    """
    from app.models.plan import Plan

    total_customers = db.query(func.count(Customer.id)).scalar() or 0

    active_subscriptions = (
        db.query(func.count(Subscription.id))
        .filter(Subscription.status == "active")
        .scalar() or 0
    )

    cancelled_subscriptions = (
        db.query(func.count(Subscription.id))
        .filter(Subscription.status == "cancelled")
        .scalar() or 0
    )

    trial_subscriptions = (
        db.query(func.count(Subscription.id))
        .filter(Subscription.status == "trial")
        .scalar() or 0
    )

    past_due_subscriptions = (
        db.query(func.count(Subscription.id))
        .filter(Subscription.status == "past_due")
        .scalar() or 0
    )

    total_subscriptions = (
        db.query(func.count(Subscription.id)).scalar() or 0
    )

    # MRR: sum of amount for active subscriptions (monthly equivalent)
    mrr = (
        db.query(func.coalesce(func.sum(Subscription.amount), 0))
        .filter(Subscription.status == "active")
        .scalar() or 0
    )

    # Churn Rate = cancelled / total * 100
    churn_rate = round((cancelled_subscriptions / total_subscriptions * 100), 2) \
        if total_subscriptions > 0 else 0.0

    # Trial Conversion Rate = those who moved from trial -> active / total trials ever started
    # We approximate: count active subs that started as trial (had trial status at some point)
    # Since we track cancelled_at and status, we count subs that are now active
    # and were once trial (start_date exists = they went through lifecycle).
    # Simpler reliable approximation: active / (active + trial) * 100 (conversion funnel)
    total_trials_started = active_subscriptions + trial_subscriptions
    trial_conversion_rate = round(
        (active_subscriptions / total_trials_started * 100), 2
    ) if total_trials_started > 0 else 0.0

    return {
        "total_customers": total_customers,
        "active_subscriptions": active_subscriptions,
        "cancelled_subscriptions": cancelled_subscriptions,
        "trial_subscriptions": trial_subscriptions,
        "past_due_subscriptions": past_due_subscriptions,
        "mrr": float(mrr),
        "churn_rate": churn_rate,
        "trial_conversion_rate": trial_conversion_rate,
    }


@router.get("/revenue-by-plan")
def get_revenue_by_plan(db: Session = Depends(get_db)):
    """
    Returns revenue grouped by plan for active subscriptions.
    [{"plan": "Basic", "revenue": 50000}, ...]
    """
    from app.models.plan import Plan

    rows = (
        db.query(Plan.name, func.coalesce(func.sum(Subscription.amount), 0).label("revenue"))
        .join(Subscription, Subscription.plan_id == Plan.id)
        .filter(Subscription.status == "active")
        .group_by(Plan.name)
        .all()
    )

    return [{"plan": row.name, "revenue": float(row.revenue)} for row in rows]


@router.get("/subscription-metrics")
def get_subscription_metrics(db: Session = Depends(get_db)):
    """
    Returns counts for each subscription status.
    """
    statuses = ["active", "trial", "past_due", "cancelled"]
    result = {}
    for s in statuses:
        count = (
            db.query(func.count(Subscription.id))
            .filter(Subscription.status == s)
            .scalar() or 0
        )
        result[s] = count

    total = sum(result.values())
    return {
        "active": result["active"],
        "trial": result["trial"],
        "past_due": result["past_due"],
        "cancelled": result["cancelled"],
        "total": total,
    }
