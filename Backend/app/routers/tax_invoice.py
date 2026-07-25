"""
Task 5: Tax Calculation & PDF Invoice Generation
GET  /invoices/{invoice_id}/tax    – Get tax breakdown for an invoice
POST /invoices/{invoice_id}/tax    – Recalculate & save tax
GET  /invoices/{invoice_id}/pdf    – Download PDF invoice
"""

import io
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from typing import Any

from app.database import get_db
from app.models.invoice import Invoice
from app.models.subscription import Subscription
from app.models.plan import Plan
from app.models.customer import Customer

router = APIRouter(tags=["Tax & PDF"])

# Tax rates by type
TAX_RATES = {
    "GST_18": 0.18,
    "GST_12": 0.12,
    "GST_5": 0.05,
    "NONE": 0.0,
}

DEFAULT_TAX_TYPE = "GST_18"


def _compute_tax(subtotal: float, tax_type: str = DEFAULT_TAX_TYPE):
    rate = TAX_RATES.get(tax_type, 0.18)
    cgst = round(subtotal * rate / 2, 2)
    sgst = round(subtotal * rate / 2, 2)
    tax_amount = cgst + sgst
    total = round(subtotal + tax_amount, 2)
    return {
        "tax_type": tax_type,
        "rate_percent": rate * 100,
        "subtotal": subtotal,
        "cgst": cgst,
        "sgst": sgst,
        "tax_amount": tax_amount,
        "total": total
    }


# ─────────────────────────────────────────
# GET /invoices/{invoice_id}/tax
# ─────────────────────────────────────────
@router.get("/invoices/{invoice_id}/tax")
def get_invoice_tax(
    invoice_id: int,
    db: Session = Depends(get_db)
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Determine tax type from existing tax_amount / subtotal ratio
    if invoice.subtotal and invoice.subtotal > 0:
        ratio = (invoice.tax_amount or 0) / invoice.subtotal
        # Find closest
        closest = min(TAX_RATES.items(), key=lambda x: abs(x[1] - ratio))
        tax_type = closest[0]
    else:
        tax_type = DEFAULT_TAX_TYPE

    return _compute_tax(invoice.subtotal or 0, tax_type)


# ─────────────────────────────────────────
# POST /invoices/{invoice_id}/tax
# Recalculate & save tax
# ─────────────────────────────────────────
@router.post("/invoices/{invoice_id}/tax")
def update_invoice_tax(
    invoice_id: int,
    payload: Any = Body(...),
    db: Session = Depends(get_db)
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    tax_type = payload.get("tax_type", DEFAULT_TAX_TYPE)
    if tax_type not in TAX_RATES:
        raise HTTPException(status_code=400, detail=f"Invalid tax_type. Options: {list(TAX_RATES.keys())}")

    result = _compute_tax(invoice.subtotal or 0, tax_type)

    invoice.tax_amount = result["tax_amount"]
    invoice.total_amount = result["total"]
    db.commit()
    db.refresh(invoice)

    return {**result, "invoice_id": invoice_id, "updated": True}


# ─────────────────────────────────────────
# GET /invoices/{invoice_id}/pdf
# Generate and return PDF invoice
# ─────────────────────────────────────────
@router.get("/invoices/{invoice_id}/pdf")
def download_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db)
):
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

    pdf_bytes = _generate_pdf(invoice)

    filename = f"{invoice.invoice_number}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes))
        }
    )


def _fmt_inr(val):
    """Format as Indian Rupees."""
    try:
        v = float(val or 0)
        return f"\u20b9{v:,.2f}"
    except Exception:
        return "\u20b90.00"


def _generate_pdf(invoice: Invoice) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm
    )

    styles = getSampleStyleSheet()
    GOLD = colors.HexColor("#D4A800")
    DARK = colors.HexColor("#1a1a2e")
    GRAY = colors.HexColor("#666666")
    LIGHT = colors.HexColor("#f4f6ff")

    def style(name, **kwargs):
        s = ParagraphStyle(name, **kwargs)
        return s

    brand_style = style("brand", fontSize=26, fontName="Helvetica-Bold", textColor=GOLD)
    h2_style = style("h2", fontSize=18, fontName="Helvetica-Bold", textColor=DARK)
    label_style = style("label", fontSize=9, fontName="Helvetica", textColor=GRAY)
    value_style = style("value", fontSize=12, fontName="Helvetica-Bold", textColor=DARK)
    subval_style = style("subval", fontSize=10, fontName="Helvetica", textColor=GRAY)
    right_style = style("right", fontSize=11, fontName="Helvetica-Bold", textColor=DARK, alignment=TA_RIGHT)

    customer = invoice.customer
    plan = invoice.subscription.plan if invoice.subscription else None

    issue_date = invoice.invoice_date.strftime("%d %b %Y") if invoice.invoice_date else "—"
    due_date = invoice.due_date.strftime("%d %b %Y") if invoice.due_date else "—"

    STATUS_COLORS = {
        "paid": colors.HexColor("#1a8a57"),
        "unpaid": colors.HexColor("#c17b00"),
        "failed": colors.HexColor("#d32f2f"),
        "refunded": colors.HexColor("#7b1fa2"),
    }
    status_color = STATUS_COLORS.get(invoice.status, GRAY)

    # Tax breakdown
    subtotal = invoice.subtotal or 0
    tax_amount = invoice.tax_amount or 0
    total = invoice.total_amount or (subtotal + tax_amount)
    cgst = round(tax_amount / 2, 2)
    sgst = round(tax_amount / 2, 2)

    elements = []

    # ── Header ──
    header_data = [
        [
            Paragraph("Vaultly", brand_style),
            Paragraph("INVOICE", style("inv", fontSize=20, fontName="Helvetica-Bold", textColor=DARK, alignment=TA_RIGHT))
        ]
    ]
    header_table = Table(header_data, colWidths=["60%", "40%"])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 4 * mm))

    # Invoice meta under heading
    meta_data = [
        [
            Paragraph("", label_style),
            Paragraph(f"<b>{invoice.invoice_number}</b>", style("invno", fontSize=12, fontName="Helvetica-Bold", textColor=DARK, alignment=TA_RIGHT))
        ],
        [
            Paragraph("", label_style),
            Paragraph(f"Issued: {issue_date}", style("meta", fontSize=10, fontName="Helvetica", textColor=GRAY, alignment=TA_RIGHT))
        ],
        [
            Paragraph("", label_style),
            Paragraph(f"Due: {due_date}", style("meta2", fontSize=10, fontName="Helvetica", textColor=GRAY, alignment=TA_RIGHT))
        ],
    ]
    meta_table = Table(meta_data, colWidths=["60%", "40%"])
    elements.append(meta_table)
    elements.append(Spacer(1, 3 * mm))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=GOLD))
    elements.append(Spacer(1, 5 * mm))

    # ── Bill To + Plan Info ──
    bill_data = [
        [
            Paragraph("BILLED TO", label_style),
            Paragraph("PLAN", label_style),
            Paragraph("STATUS", label_style),
        ],
        [
            Paragraph(customer.name if customer else "—", value_style),
            Paragraph(plan.name if plan else "Subscription", value_style),
            Paragraph(invoice.status.upper(), style("st", fontSize=11, fontName="Helvetica-Bold", textColor=status_color)),
        ],
        [
            Paragraph(customer.company_name or "" if customer else "", subval_style),
            Paragraph(f"{plan.billing_interval.capitalize() if plan else ''}", subval_style),
            Paragraph("", subval_style),
        ],
        [
            Paragraph(customer.email if customer else "", subval_style),
            Paragraph("", subval_style),
            Paragraph("", subval_style),
        ],
    ]
    bill_table = Table(bill_data, colWidths=["40%", "35%", "25%"])
    elements.append(bill_table)
    elements.append(Spacer(1, 6 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#eeeeee")))
    elements.append(Spacer(1, 5 * mm))

    # ── Line Items Table ──
    item_data = [
        [
            Paragraph("Description", style("th", fontSize=10, fontName="Helvetica-Bold", textColor=GRAY)),
            Paragraph("Qty", style("th2", fontSize=10, fontName="Helvetica-Bold", textColor=GRAY, alignment=TA_RIGHT)),
            Paragraph("Amount", style("th3", fontSize=10, fontName="Helvetica-Bold", textColor=GRAY, alignment=TA_RIGHT)),
        ],
        [
            Paragraph(f"{plan.name if plan else 'Subscription Plan'} – {plan.billing_interval.capitalize() if plan else 'Monthly'}", style("desc", fontSize=11, fontName="Helvetica", textColor=DARK)),
            Paragraph("1", style("qty", fontSize=11, fontName="Helvetica", textColor=DARK, alignment=TA_RIGHT)),
            Paragraph(_fmt_inr(subtotal), style("amt", fontSize=11, fontName="Helvetica-Bold", textColor=DARK, alignment=TA_RIGHT)),
        ],
        [
            Paragraph("CGST (9%)", style("tax", fontSize=10, fontName="Helvetica", textColor=GRAY)),
            Paragraph("", style("noop", fontSize=10)),
            Paragraph(_fmt_inr(cgst), style("tamtc", fontSize=10, fontName="Helvetica", textColor=GRAY, alignment=TA_RIGHT)),
        ],
        [
            Paragraph("SGST (9%)", style("tax2", fontSize=10, fontName="Helvetica", textColor=GRAY)),
            Paragraph("", style("noop2", fontSize=10)),
            Paragraph(_fmt_inr(sgst), style("tamt2", fontSize=10, fontName="Helvetica", textColor=GRAY, alignment=TA_RIGHT)),
        ],
    ]

    item_table = Table(item_data, colWidths=["60%", "15%", "25%"])
    item_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e0e0e0")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    elements.append(item_table)
    elements.append(Spacer(1, 6 * mm))

    # ── Totals ──
    totals_data = [
        ["Subtotal", _fmt_inr(subtotal)],
        ["Tax (GST 18%)", _fmt_inr(tax_amount)],
        ["TOTAL", _fmt_inr(total)],
    ]
    totals_table = Table(
        totals_data,
        colWidths=["70%", "30%"],
        hAlign="RIGHT"
    )
    totals_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -2), "Helvetica"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -2), 11),
        ("FONTSIZE", (0, -1), (-1, -1), 13),
        ("TEXTCOLOR", (0, -1), (-1, -1), GOLD),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEABOVE", (0, -1), (-1, -1), 1.5, GOLD),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(totals_table)

    elements.append(Spacer(1, 10 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#eeeeee")))
    elements.append(Spacer(1, 4 * mm))

    # Footer
    footer_style = style("footer", fontSize=9, fontName="Helvetica", textColor=GRAY, alignment=TA_CENTER)
    elements.append(Paragraph("Thank you for your business · Vaultly Billing System", footer_style))
    generated = datetime.now().strftime("%d %b %Y %H:%M")
    elements.append(Paragraph(f"Generated on {generated}", footer_style))

    doc.build(elements)
    return buf.getvalue()
