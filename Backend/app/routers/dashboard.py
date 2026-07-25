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
