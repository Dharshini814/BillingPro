from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import Optional, Any
from datetime import date, timedelta

from app.database import get_db
from app.core.auth import get_current_user
from app.models.invoice import Invoice
from app.models.subscription import Subscription
from app.models.customer import Customer
from app.models.plan import Plan
from app.models.user import User
from app.utils.tax_engine import calculate_tax, tax_result_to_dict


router = APIRouter(
    prefix="/invoices",
    tags=["Invoices"],
    dependencies=[Depends(get_current_user)],  # Phase 2: JWT auth required
)


# ──────────────────────────────────────────────────────────
# Response Formatter
# ──────────────────────────────────────────────────────────

def to_camel(inv: Invoice):
    # Extract payment method from payments
    payment_method = None
    if hasattr(inv, 'payments') and inv.payments:
        for payment in inv.payments:
            if hasattr(payment, 'payment_method') and payment.payment_method:
                payment_method = payment.payment_method
                break
    
    return {
        "id":             inv.id,
        "number":         inv.invoice_number,
        "customerId":     inv.customer_id,
        "customerName":   inv.customer.name if inv.customer else "Unknown Customer",
        "company":        inv.customer.company_name if inv.customer else "",
        "country":        inv.customer.country if inv.customer else "India",
        "currency":       inv.customer.currency if inv.customer else "INR",
        "subscriptionId": inv.subscription_id,
        # Use snapshotted plan_name if available (set at invoice creation),
        # so plan changes don't retroactively alter old invoice displays.
        "planName":       (
            inv.plan_name
            or (
                inv.subscription.plan.name
                if inv.subscription and inv.subscription.plan
                else ""
            )
        ),
        "amount":         inv.total_amount,
        "subtotal":       inv.subtotal,
        "taxAmount":      inv.tax_amount,
        "issuedAt":       inv.invoice_date.isoformat() if inv.invoice_date else None,
        "dueAt":          inv.due_date.isoformat() if inv.due_date else None,
        "status":         inv.status,
        "invoiceType":    getattr(inv, "invoice_type", None) or "regular",
        "notes":          getattr(inv, "notes", None),
        "createdAt":      inv.created_at.isoformat() if inv.created_at else None,
        "paymentMethod":  payment_method,
    }


def _make_invoice_number(db: Session) -> str:
    count = db.query(Invoice).count()
    candidate = f"INV-{(count + 1):05d}"
    while db.query(Invoice).filter(Invoice.invoice_number == candidate).first():
        count += 1
        candidate = f"INV-{(count + 1):05d}"
    return candidate


# ──────────────────────────────────────────────────────────
# Generate Invoices for Active Subscriptions
# ──────────────────────────────────────────────────────────

@router.post("/generate")
def generate_invoices(db: Session = Depends(get_db)):
    """
    Auto-generate invoices for all active subscriptions
    that do not yet have an unpaid invoice.
    Tax is calculated per-customer country using the tax engine.
    """
    active_subs = (
        db.query(Subscription)
        .options(
            joinedload(Subscription.plan),
            joinedload(Subscription.customer)
        )
        .filter(Subscription.status == "active")
        .all()
    )

    generated = []
    skipped   = []

    for sub in active_subs:
        existing = (
            db.query(Invoice)
            .filter(
                Invoice.subscription_id == sub.id,
                Invoice.status == "unpaid"
            )
            .first()
        )
        if existing:
            skipped.append(sub.id)
            continue

        plan = db.query(Plan).filter(Plan.id == sub.plan_id).first()
        subtotal = plan.price if plan else sub.amount

        # Country-based tax
        customer_country = sub.customer.country if sub.customer else "India"
        tax = calculate_tax(subtotal, customer_country)

        invoice_number = _make_invoice_number(db)

        invoice = Invoice(
            invoice_number=invoice_number,
            customer_id=sub.customer_id,
            subscription_id=sub.id,
            invoice_date=date.today(),
            due_date=date.today() + timedelta(days=7),
            subtotal=subtotal,
            tax_amount=tax.tax_amount,
            total_amount=tax.total,
            status="unpaid",
            plan_name=plan.name if plan else None,
        )
        db.add(invoice)
        db.flush()
        generated.append(invoice_number)

    db.commit()

    return {
        "message": f"Generated {len(generated)} invoice(s).",
        "generated": generated,
        "skipped_count": len(skipped),
    }


# ──────────────────────────────────────────────────────────
# List Invoices
# ──────────────────────────────────────────────────────────

@router.get("/")
def get_invoices(
    status:    Optional[str] = Query("all"),
    search:    Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to:   Optional[str] = Query(None),
    customer_email: Optional[str] = Query(None),
    page:      int           = Query(1, ge=1),
    pageSize:  Optional[int] = Query(8),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.core.customer_auth import get_authorized_customer_email
    
    # Get the authorized email filter (enforces user can only see their own resources)
    authorized_email = get_authorized_customer_email(customer_email, current_user)
    
    query = (
        db.query(Invoice)
        .join(Customer, Invoice.customer_id == Customer.id, isouter=True)
        .options(
            joinedload(Invoice.customer),
            joinedload(Invoice.subscription).joinedload(Subscription.plan),
            joinedload(Invoice.payments)
        )
    )

    # Filter to authorized customer email (None = admin sees all)
    if authorized_email:
        from app.models.customer import Customer as CustomerModel
        customer = db.query(CustomerModel).filter(CustomerModel.email == authorized_email).first()
        if customer:
            query = query.filter(Invoice.customer_id == customer.id)
        else:
            return {"items": [], "total": 0, "page": page, "pageSize": pageSize}

    if status and status != "all":
        query = query.filter(Invoice.status == status)

    if search and search.strip():
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Invoice.invoice_number.ilike(s),
                Customer.name.ilike(s),
            )
        )

    if date_from:
        try:
            query = query.filter(Invoice.invoice_date >= date.fromisoformat(date_from))
        except ValueError:
            pass

    if date_to:
        try:
            query = query.filter(Invoice.invoice_date <= date.fromisoformat(date_to))
        except ValueError:
            pass

    total    = query.count()
    invoices = (
        query
        .order_by(Invoice.id.desc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .all()
    )

    return {
        "items":    [to_camel(inv) for inv in invoices],
        "total":    total,
        "page":     page,
        "pageSize": pageSize,
    }


# ──────────────────────────────────────────────────────────
# Get Single Invoice
# ──────────────────────────────────────────────────────────

@router.get("/{invoice_id}")
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = (
        db.query(Invoice)
        .options(
            joinedload(Invoice.customer),
            joinedload(Invoice.subscription).joinedload(Subscription.plan)
        )
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return to_camel(invoice)


# ──────────────────────────────────────────────────────────
# Create Invoice
# ──────────────────────────────────────────────────────────

@router.post("/")
def create_invoice(payload: Any = Body(...), db: Session = Depends(get_db)):
    invoice_date = (
        payload.get("invoice_date") or payload.get("issuedAt") or date.today().isoformat()
    )
    due_date = (
        payload.get("due_date") or payload.get("dueAt") or date.today().isoformat()
    )
    subtotal = float(payload.get("subtotal", payload.get("amount", 0)))
    tax_val  = float(payload.get("tax_amount", payload.get("taxAmount", -1)))

    # If no tax provided, auto-calculate from customer country
    if tax_val < 0:
        customer_id = payload.get("customer_id")
        customer = db.query(Customer).filter(Customer.id == customer_id).first() if customer_id else None
        country = customer.country if customer else "India"
        tax_obj = calculate_tax(subtotal, country)
        tax_val = tax_obj.tax_amount
        total   = tax_obj.total
    else:
        total = subtotal + tax_val

    inv_number = payload.get("invoice_number") or payload.get("number") or _make_invoice_number(db)

    # Resolve plan_name snapshot
    snap_plan_name = payload.get("plan_name") or payload.get("planName")
    if not snap_plan_name and payload.get("subscription_id"):
        from app.models.subscription import Subscription as _Sub
        _sub = db.query(_Sub).filter(_Sub.id == payload["subscription_id"]).first()
        if _sub and _sub.plan:
            snap_plan_name = _sub.plan.name

    invoice = Invoice(
        invoice_number=inv_number,
        customer_id=payload["customer_id"],
        subscription_id=payload.get("subscription_id"),
        invoice_date=date.fromisoformat(str(invoice_date)),
        due_date=date.fromisoformat(str(due_date)),
        subtotal=subtotal,
        tax_amount=tax_val,
        total_amount=total,
        status=payload.get("status", "unpaid"),
        plan_name=snap_plan_name,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    invoice = (
        db.query(Invoice)
        .options(
            joinedload(Invoice.customer),
            joinedload(Invoice.subscription).joinedload(Subscription.plan)
        )
        .filter(Invoice.id == invoice.id)
        .first()
    )
    return to_camel(invoice)


# ──────────────────────────────────────────────────────────
# Update Invoice
# ──────────────────────────────────────────────────────────

@router.put("/{invoice_id}")
def update_invoice(invoice_id: int, payload: Any = Body(...), db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if "status" in payload:
        invoice.status = payload["status"]

    db.commit()
    db.refresh(invoice)

    invoice = (
        db.query(Invoice)
        .options(
            joinedload(Invoice.customer),
            joinedload(Invoice.subscription).joinedload(Subscription.plan)
        )
        .filter(Invoice.id == invoice_id)
        .first()
    )
    return to_camel(invoice)


# ──────────────────────────────────────────────────────────
# Delete Invoice
# ──────────────────────────────────────────────────────────

@router.delete("/{invoice_id}")
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    db.delete(invoice)
    db.commit()
    return {"message": "Invoice deleted successfully"}


# ──────────────────────────────────────────────────────────
# GET /invoices/{id}/tax  – Tax breakdown for an invoice
# ──────────────────────────────────────────────────────────

@router.get("/{invoice_id}/tax")
def get_invoice_tax(invoice_id: int, db: Session = Depends(get_db)):
    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.customer))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    country = invoice.customer.country if invoice.customer else "India"
    tax = calculate_tax(invoice.subtotal or 0, country)
    return {**tax_result_to_dict(tax), "invoice_id": invoice_id}


# ──────────────────────────────────────────────────────────
# POST /invoices/{id}/tax  – Recalculate & save tax
# ──────────────────────────────────────────────────────────

@router.post("/{invoice_id}/tax")
def update_invoice_tax(
    invoice_id: int,
    payload: Any = Body(...),
    db: Session = Depends(get_db)
):
    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.customer))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Allow overriding country per request, else use customer's country
    country = payload.get("country") or (
        invoice.customer.country if invoice.customer else "India"
    )

    tax = calculate_tax(invoice.subtotal or 0, country)
    invoice.tax_amount   = tax.tax_amount
    invoice.total_amount = tax.total
    db.commit()

    return {**tax_result_to_dict(tax), "invoice_id": invoice_id, "updated": True}


# ──────────────────────────────────────────────────────────
# GET /invoices/{id}/pdf  – Download PDF invoice
# ──────────────────────────────────────────────────────────

@router.get("/{invoice_id}/pdf")
def download_invoice_pdf(invoice_id: int, db: Session = Depends(get_db)):
    import io
    from fastapi.responses import StreamingResponse
    from datetime import datetime

    invoice = (
        db.query(Invoice)
        .options(
            joinedload(Invoice.customer),
            joinedload(Invoice.subscription).joinedload(Subscription.plan)
        )
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    country  = invoice.customer.country if invoice.customer else "India"
    currency = invoice.customer.currency if invoice.customer else "INR"
    tax      = calculate_tax(invoice.subtotal or 0, country)

    pdf_bytes = _generate_pdf(invoice, tax, currency)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{invoice.invoice_number}.pdf"',
            "Content-Length": str(len(pdf_bytes)),
        }
    )


def _fmt_currency(val: float, currency: str = "INR") -> str:
    currency_symbols = {
        "INR": "\u20b9",
        "USD": "$",
        "GBP": "\u00a3",
        "EUR": "\u20ac",
        "AUD": "A$",
        "CAD": "CA$",
        "SGD": "S$",
        "AED": "AED ",
        "JPY": "\u00a5",
    }
    sym = currency_symbols.get(currency.upper(), f"{currency} ")
    return f"{sym}{val:,.2f}"


def _generate_pdf(invoice, tax, currency: str) -> bytes:
    import io
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    )
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_RIGHT, TA_CENTER
    from datetime import datetime

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=20*mm, leftMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm
    )

    GOLD  = colors.HexColor("#D4A800")
    DARK  = colors.HexColor("#1a1a2e")
    GRAY  = colors.HexColor("#666666")
    LIGHT = colors.HexColor("#f4f6ff")

    def ps(name, **kw):
        return ParagraphStyle(name, **kw)

    elements = []
    customer = invoice.customer
    plan     = invoice.subscription.plan if invoice.subscription else None

    issue_date = invoice.invoice_date.strftime("%d %b %Y") if invoice.invoice_date else "—"
    due_date   = invoice.due_date.strftime("%d %b %Y") if invoice.due_date else "—"

    STATUS_COLORS = {
        "paid":     colors.HexColor("#1a8a57"),
        "unpaid":   colors.HexColor("#c17b00"),
        "failed":   colors.HexColor("#d32f2f"),
        "refunded": colors.HexColor("#7b1fa2"),
    }
    status_color = STATUS_COLORS.get(invoice.status, GRAY)

    # ── Header ──
    header = Table([[
        Paragraph("Vaultly", ps("br", fontSize=26, fontName="Helvetica-Bold", textColor=GOLD)),
        Paragraph("INVOICE", ps("ir", fontSize=20, fontName="Helvetica-Bold", textColor=DARK, alignment=TA_RIGHT)),
    ]], colWidths=["60%", "40%"])
    elements += [header, Spacer(1, 3*mm)]

    meta = Table([[
        Paragraph("", ps("x", fontSize=9)),
        Paragraph(f"<b>{invoice.invoice_number}</b>", ps("n", fontSize=12, fontName="Helvetica-Bold", textColor=DARK, alignment=TA_RIGHT)),
    ],[
        Paragraph("", ps("x2", fontSize=9)),
        Paragraph(f"Issued: {issue_date}", ps("m", fontSize=10, textColor=GRAY, alignment=TA_RIGHT)),
    ],[
        Paragraph("", ps("x3", fontSize=9)),
        Paragraph(f"Due: {due_date}", ps("m2", fontSize=10, textColor=GRAY, alignment=TA_RIGHT)),
    ]], colWidths=["60%", "40%"])
    elements += [meta, Spacer(1, 3*mm),
                 HRFlowable(width="100%", thickness=1.5, color=GOLD),
                 Spacer(1, 5*mm)]

    # ── Bill To / Plan / Status ──
    bill = Table([[
        Paragraph("BILLED TO", ps("lbl", fontSize=9, textColor=GRAY, fontName="Helvetica-Bold")),
        Paragraph("PLAN", ps("lbl2", fontSize=9, textColor=GRAY, fontName="Helvetica-Bold")),
        Paragraph("STATUS", ps("lbl3", fontSize=9, textColor=GRAY, fontName="Helvetica-Bold")),
    ],[
        Paragraph(customer.name if customer else "—", ps("val", fontSize=12, fontName="Helvetica-Bold", textColor=DARK)),
        Paragraph(plan.name if plan else "Subscription", ps("val2", fontSize=12, fontName="Helvetica-Bold", textColor=DARK)),
        Paragraph(invoice.status.upper(), ps("st", fontSize=11, fontName="Helvetica-Bold", textColor=status_color)),
    ],[
        Paragraph(customer.company_name or "" if customer else "", ps("sub", fontSize=10, textColor=GRAY)),
        Paragraph(f"{plan.billing_interval.capitalize() if plan else ''}", ps("sub2", fontSize=10, textColor=GRAY)),
        Paragraph(tax.country, ps("sub3", fontSize=10, textColor=GRAY)),
    ],[
        Paragraph(customer.email if customer else "", ps("sub4", fontSize=10, textColor=GRAY)),
        Paragraph("", ps("sub5", fontSize=10)),
        Paragraph("", ps("sub6", fontSize=10)),
    ]], colWidths=["40%", "35%", "25%"])
    elements += [bill, Spacer(1, 6*mm),
                 HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#eeeeee")),
                 Spacer(1, 5*mm)]

    # ── Line Items ──
    items_data = [[
        Paragraph("Description",  ps("th",  fontSize=10, fontName="Helvetica-Bold", textColor=GRAY)),
        Paragraph("Qty",          ps("th2", fontSize=10, fontName="Helvetica-Bold", textColor=GRAY, alignment=TA_RIGHT)),
        Paragraph("Amount",       ps("th3", fontSize=10, fontName="Helvetica-Bold", textColor=GRAY, alignment=TA_RIGHT)),
    ],[
        Paragraph(f"{plan.name if plan else 'Subscription Plan'} – {plan.billing_interval.capitalize() if plan else 'Monthly'}",
                  ps("desc", fontSize=11, textColor=DARK)),
        Paragraph("1",            ps("qty", fontSize=11, textColor=DARK, alignment=TA_RIGHT)),
        Paragraph(_fmt_currency(tax.subtotal, currency),
                  ps("amt", fontSize=11, fontName="Helvetica-Bold", textColor=DARK, alignment=TA_RIGHT)),
    ]]

    # Tax line(s)
    if tax.is_india:
        items_data.append([
            Paragraph(f"CGST ({tax.rate_percent/2:.1f}%)", ps("t1", fontSize=10, textColor=GRAY)),
            Paragraph("", ps("np", fontSize=10)),
            Paragraph(_fmt_currency(tax.cgst, currency), ps("ta1", fontSize=10, textColor=GRAY, alignment=TA_RIGHT)),
        ])
        items_data.append([
            Paragraph(f"SGST ({tax.rate_percent/2:.1f}%)", ps("t2", fontSize=10, textColor=GRAY)),
            Paragraph("", ps("np2", fontSize=10)),
            Paragraph(_fmt_currency(tax.sgst, currency), ps("ta2", fontSize=10, textColor=GRAY, alignment=TA_RIGHT)),
        ])
    elif tax.tax_amount > 0:
        items_data.append([
            Paragraph(f"{tax.tax_type} ({tax.rate_percent:.1f}%)", ps("t3", fontSize=10, textColor=GRAY)),
            Paragraph("", ps("np3", fontSize=10)),
            Paragraph(_fmt_currency(tax.tax_amount, currency), ps("ta3", fontSize=10, textColor=GRAY, alignment=TA_RIGHT)),
        ])

    item_table = Table(items_data, colWidths=["60%", "15%", "25%"])
    item_table.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0), LIGHT),
        ("GRID",         (0, 0), (-1, -1), 0.25, colors.HexColor("#e0e0e0")),
        ("TOPPADDING",   (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 8),
        ("LEFTPADDING",  (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    elements += [item_table, Spacer(1, 6*mm)]

    # ── Totals ──
    totals_data = [
        ["Subtotal", _fmt_currency(tax.subtotal, currency)],
        [f"{tax.tax_type} ({tax.rate_percent:.1f}%)", _fmt_currency(tax.tax_amount, currency)],
        ["TOTAL", _fmt_currency(tax.total, currency)],
    ]
    totals_table = Table(totals_data, colWidths=["70%", "30%"], hAlign="RIGHT")
    totals_table.setStyle(TableStyle([
        ("FONTNAME",    (0, 0), (-1, -2), "Helvetica"),
        ("FONTNAME",    (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, -2), 11),
        ("FONTSIZE",    (0, -1), (-1, -1), 13),
        ("TEXTCOLOR",   (0, -1), (-1, -1), GOLD),
        ("ALIGN",       (1, 0), (1, -1), "RIGHT"),
        ("LINEABOVE",   (0, -1), (-1, -1), 1.5, GOLD),
        ("TOPPADDING",  (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
    ]))
    elements += [totals_table, Spacer(1, 10*mm),
                 HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#eeeeee")),
                 Spacer(1, 4*mm)]

    generated = datetime.now().strftime("%d %b %Y %H:%M")
    footer_s  = ps("ft", fontSize=9, textColor=GRAY, alignment=TA_CENTER)
    elements += [
        Paragraph("Thank you for your business · Vaultly Billing System", footer_s),
        Paragraph(f"Generated on {generated}", footer_s),
    ]

    doc.build(elements)
    return buf.getvalue()


# ─────────────────────────────────────────────────────────────────────────────
# Pay Invoice (user-initiated): applies wallet credit, marks invoice paid,
# transitions subscription from trial → active
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{invoice_id}/pay")
def pay_invoice(invoice_id: int, payload: Any = Body(default={}), db: Session = Depends(get_db)):
    from app.models.payment import Payment
    from app.models.customer import Customer
    from app.models.subscription import Subscription
    from app.models.audit_log import AuditLog
    from app.utils.tax_engine import calculate_tax
    import uuid as _uuid

    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status not in ("unpaid", "failed"):
        raise HTTPException(status_code=400, detail=f"Invoice is already {invoice.status}")

    customer = db.query(Customer).filter(Customer.id == invoice.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Apply wallet balance
    wallet_applied = round(min(customer.wallet_balance or 0.0, invoice.total_amount), 2)
    amount_charged = round(invoice.total_amount - wallet_applied, 2)
    customer.wallet_balance = round((customer.wallet_balance or 0.0) - wallet_applied, 2)

    # Mark invoice paid
    invoice.status = "paid"

    # Create payment record
    pay_ref = f"PAY-{_uuid.uuid4().hex[:8].upper()}"
    # Use method from request body; auto-set to Wallet if fully wallet-covered
    requested_method = payload.get("payment_method") if isinstance(payload, dict) else None
    if wallet_applied >= invoice.total_amount:
        method = "Wallet"
    elif requested_method:
        method = requested_method
    else:
        method = "UPI"
    payment = Payment(
        invoice_id=invoice.id,
        payment_reference=pay_ref,
        amount=invoice.total_amount,
        payment_method=method,
        status="paid",
        payment_date=datetime.utcnow(),
    )
    db.add(payment)
    db.flush()

    # Transition subscription trial → active
    if invoice.subscription_id:
        sub = db.query(Subscription).filter(Subscription.id == invoice.subscription_id).first()
        if sub and sub.status in ("trial", "past_due"):
            sub.status = "active"
            sub.status_changed_at = datetime.utcnow()

    # Audit
    audit = AuditLog(
        entity_type="invoice",
        entity_id=invoice.id,
        action="paid",
        module="invoices",
        description=(
            f"Invoice {invoice.invoice_number} paid by customer. "
            f"Amount: ₹{invoice.total_amount:.2f}, "
            f"Wallet applied: ₹{wallet_applied:.2f}, "
            f"Charged: ₹{amount_charged:.2f}."
        ),
        new_value={
            "invoice_number": invoice.invoice_number,
            "total": invoice.total_amount,
            "wallet_applied": wallet_applied,
            "amount_charged": amount_charged,
            "payment_ref": pay_ref,
        },
    )
    db.add(audit)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise e

    return {
        "success": True,
        "invoiceId": invoice.id,
        "invoiceNumber": invoice.invoice_number,
        "invoiceStatus": invoice.status,
        "paymentReference": pay_ref,
        "amount": invoice.total_amount,
        "walletApplied": wallet_applied,
        "amountCharged": amount_charged,
        "message": f"Invoice {invoice.invoice_number} paid successfully.",
    }
