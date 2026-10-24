import json
import logging
from datetime import date, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_

from app.models.customer import Customer
from app.models.subscription import Subscription
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.plan import Plan
from app.utils.tax_engine import calculate_tax

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Customer Tools (scoped to authenticated customer)
# ─────────────────────────────────────────────────────────────────────────────

def get_customer_subscriptions(db: Session, customer_id: int) -> List[Dict[str, Any]]:
    """Get the authenticated customer's active subscriptions with plan details."""
    subs = (
        db.query(Subscription)
        .options(joinedload(Subscription.plan))
        .filter(
            Subscription.customer_id == customer_id,
            Subscription.status.in_(["active", "trial", "past_due"])
        )
        .all()
    )

    result = []
    for s in subs:
        plan = s.plan
        result.append({
            "id": s.id,
            "plan_name": plan.name if plan else "Unknown",
            "plan_price": plan.price if plan else s.amount,
            "billing_cycle": s.billing_cycle,
            "status": s.status,
            "start_date": s.start_date.isoformat() if s.start_date else None,
            "next_billing_date": s.next_billing_date.isoformat() if s.next_billing_date else None,
            "amount": s.amount,
        })
    return result


def get_customer_invoices(db: Session, customer_id: int, status: str = "all") -> List[Dict[str, Any]]:
    """Get the customer's invoices, optionally filtered by status."""
    query = (
        db.query(Invoice)
        .options(joinedload(Invoice.subscription).joinedload(Subscription.plan))
        .filter(Invoice.customer_id == customer_id)
    )

    if status and status != "all":
        if status == "overdue":
            query = query.filter(Invoice.status == "unpaid", Invoice.due_date < date.today())
        else:
            query = query.filter(Invoice.status == status)

    invoices = query.order_by(Invoice.invoice_date.desc()).all()

    result = []
    for inv in invoices:
        plan_name = inv.plan_name or (inv.subscription.plan.name if inv.subscription and inv.subscription.plan else "Unknown")
        result.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "plan_name": plan_name,
            "amount": inv.total_amount,
            "subtotal": inv.subtotal,
            "tax_amount": inv.tax_amount,
            "status": inv.status,
            "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
            "due_date": inv.due_date.isoformat() if inv.due_date else None,
            "invoice_type": getattr(inv, "invoice_type", "regular"),
            "notes": getattr(inv, "notes", None),
        })
    return result


def get_customer_payments(db: Session, customer_id: int) -> List[Dict[str, Any]]:
    """Get the customer's payment history."""
    payments = (
        db.query(Payment)
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .filter(Invoice.customer_id == customer_id)
        .order_by(Payment.payment_date.desc())
        .all()
    )

    result = []
    for p in payments:
        result.append({
            "id": p.id,
            "payment_reference": p.payment_reference,
            "amount": p.amount,
            "payment_method": p.payment_method,
            "status": p.status,
            "payment_date": p.payment_date.isoformat() if p.payment_date else None,
            "invoice_id": p.invoice_id,
        })
    return result


def get_customer_latest_invoice(db: Session, customer_id: int) -> Optional[Dict[str, Any]]:
    """Get the customer's most recent invoice."""
    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.subscription).joinedload(Subscription.plan))
        .filter(Invoice.customer_id == customer_id)
        .order_by(Invoice.invoice_date.desc())
        .first()
    )

    if not invoice:
        return None

    plan_name = invoice.plan_name or (invoice.subscription.plan.name if invoice.subscription and invoice.subscription.plan else "Unknown")
    return {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "plan_name": plan_name,
        "amount": invoice.total_amount,
        "subtotal": invoice.subtotal,
        "tax_amount": invoice.tax_amount,
        "status": invoice.status,
        "invoice_date": invoice.invoice_date.isoformat() if invoice.invoice_date else None,
        "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
        "invoice_type": getattr(invoice, "invoice_type", "regular"),
        "notes": getattr(invoice, "notes", None),
    }


def get_customer_billing_summary(db: Session, customer_id: int) -> Dict[str, Any]:
    """Get a summary of the customer's billing activity."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return {"error": "Customer not found"}

    # Count invoices by status
    total_invoices = db.query(func.count(Invoice.id)).filter(Invoice.customer_id == customer_id).scalar() or 0
    paid_invoices = db.query(func.count(Invoice.id)).filter(Invoice.customer_id == customer_id, Invoice.status == "paid").scalar() or 0
    unpaid_invoices = db.query(func.count(Invoice.id)).filter(Invoice.customer_id == customer_id, Invoice.status == "unpaid").scalar() or 0
    overdue_invoices = db.query(func.count(Invoice.id)).filter(
        Invoice.customer_id == customer_id,
        Invoice.status == "unpaid",
        Invoice.due_date < date.today()
    ).scalar() or 0

    # Total paid amount
    total_paid = db.query(func.coalesce(func.sum(Payment.amount), 0)).join(Invoice).filter(
        Invoice.customer_id == customer_id,
        Payment.status == "paid"
    ).scalar() or 0

    # Failed payments
    failed_payments = db.query(func.count(Payment.id)).join(Invoice).filter(
        Invoice.customer_id == customer_id,
        Payment.status == "failed"
    ).scalar() or 0

    # Active subscriptions
    active_subs = db.query(func.count(Subscription.id)).filter(
        Subscription.customer_id == customer_id,
        Subscription.status.in_(["active", "trial", "past_due"])
    ).scalar() or 0

    # Wallet balance
    wallet_balance = customer.wallet_balance or 0.0

    currency = customer.currency or "INR"
    currency_symbols = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£"}
    symbol = currency_symbols.get(currency, currency + " ")

    return {
        "customer_name": customer.name,
        "currency": currency,
        "total_invoices": total_invoices,
        "paid_invoices": paid_invoices,
        "unpaid_invoices": unpaid_invoices,
        "overdue_invoices": overdue_invoices,
        "total_paid": float(total_paid),
        "total_paid_formatted": f"{symbol}{float(total_paid):,.2f}",
        "failed_payments": failed_payments,
        "active_subscriptions": active_subs,
        "wallet_balance": wallet_balance,
        "wallet_balance_formatted": f"{symbol}{wallet_balance:,.2f}",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Admin Tools (require admin role)
# ─────────────────────────────────────────────────────────────────────────────

def get_admin_dashboard_summary(db: Session) -> Dict[str, Any]:
    """Get high-level business KPIs."""
    total_customers = db.query(func.count(Customer.id)).scalar() or 0

    active_subscriptions = db.query(func.count(Subscription.id)).filter(Subscription.status == "active").scalar() or 0
    cancelled_subscriptions = db.query(func.count(Subscription.id)).filter(Subscription.status == "cancelled").scalar() or 0
    trial_subscriptions = db.query(func.count(Subscription.id)).filter(Subscription.status == "trial").scalar() or 0
    past_due_subscriptions = db.query(func.count(Subscription.id)).filter(Subscription.status == "past_due").scalar() or 0

    total_subscriptions = db.query(func.count(Subscription.id)).scalar() or 0

    mrr = db.query(func.coalesce(func.sum(Subscription.amount), 0)).filter(Subscription.status == "active").scalar() or 0

    churn_rate = round((cancelled_subscriptions / total_subscriptions * 100), 2) if total_subscriptions > 0 else 0.0
    total_trials_started = active_subscriptions + trial_subscriptions
    trial_conversion_rate = round((active_subscriptions / total_trials_started * 100), 2) if total_trials_started > 0 else 0.0

    return {
        "total_customers": total_customers,
        "active_subscriptions": active_subscriptions,
        "cancelled_subscriptions": cancelled_subscriptions,
        "trial_subscriptions": trial_subscriptions,
        "past_due_subscriptions": past_due_subscriptions,
        "mrr": float(mrr),
        "mrr_formatted": f"${float(mrr):,.2f}",
        "churn_rate": churn_rate,
        "trial_conversion_rate": trial_conversion_rate,
    }


def get_admin_revenue_by_plan(db: Session) -> List[Dict[str, Any]]:
    """Get revenue grouped by plan for active subscriptions."""
    rows = (
        db.query(Plan.name, func.coalesce(func.sum(Subscription.amount), 0).label("revenue"))
        .join(Subscription, Subscription.plan_id == Plan.id)
        .filter(Subscription.status == "active")
        .group_by(Plan.name)
        .all()
    )
    return [{"plan": row.name, "revenue": float(row.revenue), "revenue_formatted": f"${float(row.revenue):,.2f}"} for row in rows]


def get_admin_subscription_metrics(db: Session) -> Dict[str, Any]:
    """Get subscription counts by status."""
    statuses = ["active", "trial", "past_due", "cancelled"]
    result = {}
    for s in statuses:
        count = db.query(func.count(Subscription.id)).filter(Subscription.status == s).scalar() or 0
        result[s] = count
    total = sum(result.values())
    return {"active": result["active"], "trial": result["trial"], "past_due": result["past_due"], "cancelled": result["cancelled"], "total": total}


def get_admin_failed_payments(db: Session, limit: int = 20) -> List[Dict[str, Any]]:
    """Get list of recent failed payments with customer details."""
    payments = (
        db.query(Payment)
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .join(Customer, Invoice.customer_id == Customer.id)
        .filter(Payment.status == "failed")
        .order_by(Payment.payment_date.desc())
        .limit(limit)
        .all()
    )

    result = []
    for p in payments:
        result.append({
            "id": p.id,
            "payment_reference": p.payment_reference,
            "amount": p.amount,
            "payment_method": p.payment_method,
            "payment_date": p.payment_date.isoformat() if p.payment_date else None,
            "customer_name": p.invoice.customer.name if p.invoice and p.invoice.customer else "Unknown",
            "customer_email": p.invoice.customer.email if p.invoice and p.invoice.customer else "Unknown",
            "invoice_number": p.invoice.invoice_number if p.invoice else "Unknown",
        })
    return result


def get_admin_expiring_subscriptions(db: Session, days: int = 30) -> List[Dict[str, Any]]:
    """Get subscriptions expiring within specified days."""
    target_date = date.today() + timedelta(days=days)

    subs = (
        db.query(Subscription)
        .options(
            joinedload(Subscription.customer),
            joinedload(Subscription.plan)
        )
        .filter(
            Subscription.status.in_(["active", "trial"]),
            Subscription.next_billing_date.isnot(None),
            Subscription.next_billing_date <= target_date
        )
        .order_by(Subscription.next_billing_date.asc())
        .all()
    )

    result = []
    for s in subs:
        result.append({
            "id": s.id,
            "customer_name": s.customer.name if s.customer else "Unknown",
            "customer_email": s.customer.email if s.customer else "Unknown",
            "plan_name": s.plan.name if s.plan else "Unknown",
            "amount": s.amount,
            "billing_cycle": s.billing_cycle,
            "status": s.status,
            "next_billing_date": s.next_billing_date.isoformat() if s.next_billing_date else None,
            "days_until_renewal": (s.next_billing_date - date.today()).days if s.next_billing_date else None,
        })
    return result


def find_customer_by_email(db: Session, email: str) -> Optional[Dict[str, Any]]:
    """Find a customer by email address."""
    customer = db.query(Customer).filter(func.lower(Customer.email) == email.lower()).first()
    if not customer:
        return None

    # Get related data
    active_subs = db.query(func.count(Subscription.id)).filter(
        Subscription.customer_id == customer.id,
        Subscription.status.in_(["active", "trial", "past_due"])
    ).scalar() or 0

    total_paid = db.query(func.coalesce(func.sum(Payment.amount), 0)).join(Invoice).filter(
        Invoice.customer_id == customer.id,
        Payment.status == "paid"
    ).scalar() or 0

    return {
        "id": customer.id,
        "name": customer.name,
        "email": customer.email,
        "company_name": customer.company_name,
        "phone": customer.phone,
        "status": customer.status,
        "country": customer.country,
        "currency": customer.currency,
        "wallet_balance": customer.wallet_balance or 0.0,
        "active_subscriptions": active_subs,
        "total_paid": float(total_paid),
        "created_at": customer.created_at.isoformat() if customer.created_at else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Tool Execution Functions (called by the AI service)
# ─────────────────────────────────────────────────────────────────────────────

def execute_customer_tool(db: Session, customer_id: int, tool_name: str, arguments: Dict) -> Any:
    """Execute a customer-scoped tool and return JSON-serializable result."""
    try:
        if tool_name == "get_customer_subscriptions":
            return get_customer_subscriptions(db, customer_id)
        elif tool_name == "get_customer_invoices":
            return get_customer_invoices(db, customer_id, arguments.get("status", "all"))
        elif tool_name == "get_customer_payments":
            return get_customer_payments(db, customer_id)
        elif tool_name == "get_customer_latest_invoice":
            return get_customer_latest_invoice(db, customer_id)
        elif tool_name == "get_customer_billing_summary":
            return get_customer_billing_summary(db, customer_id)
        else:
            return {"error": f"Unknown tool: {tool_name}"}
    except Exception as e:
        logger.error(f"Error executing customer tool {tool_name}: {e}")
        return {"error": str(e)}


def execute_admin_tool(db: Session, tool_name: str, arguments: Dict) -> Any:
    """Execute an admin tool and return JSON-serializable result."""
    try:
        if tool_name == "get_admin_dashboard_summary":
            return get_admin_dashboard_summary(db)
        elif tool_name == "get_admin_revenue_by_plan":
            return get_admin_revenue_by_plan(db)
        elif tool_name == "get_admin_subscription_metrics":
            return get_admin_subscription_metrics(db)
        elif tool_name == "get_admin_failed_payments":
            return get_admin_failed_payments(db, arguments.get("limit", 20))
        elif tool_name == "get_admin_expiring_subscriptions":
            return get_admin_expiring_subscriptions(db, arguments.get("days", 30))
        elif tool_name == "find_customer_by_email":
            email = arguments.get("email")
            if not email:
                return {"error": "email parameter required"}
            return find_customer_by_email(db, email)
        else:
            return {"error": f"Unknown tool: {tool_name}"}
    except Exception as e:
        logger.error(f"Error executing admin tool {tool_name}: {e}")
        return {"error": str(e)}