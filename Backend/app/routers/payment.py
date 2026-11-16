from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session, joinedload
from typing import Optional, Any
import uuid

from app.database import get_db
from app.core.auth import get_current_user
from app.models.payment import Payment
from app.models.invoice import Invoice
from app.models.audit_log import AuditLog
from app.models.payment_retry import PaymentRetry
from app.models.user import User


router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
    dependencies=[Depends(get_current_user)],  # Phase 2: JWT auth required
)



# ==========================
# Response Formatter
# ==========================

def to_camel(p: Payment) -> dict:

    customer_name = ""

    if p.invoice and p.invoice.customer:
        customer_name = p.invoice.customer.name


    return {

        "id": p.id,

        "customerName": customer_name,

        "invoiceId": p.invoice_id,

        "method": p.payment_method,

        "amount": p.amount,

        # invoice status (for display)
        "status":
            p.invoice.status
            if p.invoice
            else p.status,

        # actual payment row status (for Pay/Refund button logic)
        "paymentStatus": p.status,

        "dueDate":
            p.invoice.due_date.isoformat()
            if p.invoice and p.invoice.due_date else None,


        "processedAt":
            p.payment_date.isoformat()
            if p.payment_date else None,


        "reference":
            p.payment_reference,

        "createdAt":
            p.created_at.isoformat()
            if p.created_at else None,

        "paymentDate":
            p.payment_date.isoformat()
            if p.payment_date else (
                p.created_at.isoformat() if p.created_at else None
            )
    }





# ==========================
# GET ALL PAYMENTS
# ==========================

@router.get("/")
def get_payments(
    status: Optional[str] = Query("all"),
    customer_email: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(8),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.core.customer_auth import get_authorized_customer_email
    
    # Get the authorized email filter (enforces user can only see their own resources)
    authorized_email = get_authorized_customer_email(customer_email, current_user)
    
    q = (
        db.query(Payment)
        .options(
            joinedload(Payment.invoice)
            .joinedload(Invoice.customer)
        )
    )

    if status != "all":
        q = q.filter(Payment.status == status)

    # Filter to authorized customer email (None = admin sees all)
    if authorized_email:
        from app.models.customer import Customer as CustomerModel
        customer = db.query(CustomerModel).filter(CustomerModel.email == authorized_email).first()
        if customer:
            q = q.join(Invoice, Payment.invoice_id == Invoice.id).filter(Invoice.customer_id == customer.id)
        else:
            return {"items": [], "total": 0, "page": page, "pageSize": pageSize}


    total = q.count()


    payments = (
        q.order_by(
            Payment.id.desc()
        )
        .offset(
            (page - 1) * pageSize
        )
        .limit(pageSize)
        .all()
    )


    return {

        "items":
            [
                to_camel(p)
                for p in payments
            ],

        "total": total,

        "page": page,

        "pageSize": pageSize

    }





# ==========================
# GET PAYMENT BY ID
# ==========================

@router.get("/failed")
def get_failed_payments(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20),
    db: Session = Depends(get_db)
):
    """
    Failed Payment Queue — only payments where:
    - payment.status = 'failed'  AND
    - invoice is still unpaid/draft/failed (not yet recovered)
    """
    q = (
        db.query(Payment)
        .options(
            joinedload(Payment.invoice)
            .joinedload(Invoice.customer)
        )
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .filter(
            Payment.status == "failed",
            Invoice.status.in_(["unpaid", "draft", "failed", "overdue"])
        )
        .order_by(Payment.id.desc())
    )

    total = q.count()
    payments = q.offset((page - 1) * pageSize).limit(pageSize).all()

    items = []
    for p in payments:
        retries = (
            db.query(PaymentRetry)
            .filter(PaymentRetry.payment_id == p.id)
            .order_by(PaymentRetry.attempt_number.desc())
            .all()
        )
        attempt_number = retries[0].attempt_number if retries else 0
        next_retry = retries[0].scheduled_date.isoformat() if retries and retries[0].status == "pending" else None

        customer_name = p.invoice.customer.name if p.invoice and p.invoice.customer else ""

        items.append({
            "id":            p.id,
            "customerName":  customer_name,
            "invoiceNumber": p.invoice.invoice_number if p.invoice else None,
            "invoiceId":     p.invoice_id,
            "invoiceStatus": p.invoice.status if p.invoice else None,
            "amount":        p.amount,
            "method":        p.payment_method,
            "status":        p.status,          # always "failed"
            "paymentStatus": p.status,
            "reference":     p.payment_reference,
            "attemptNumber": attempt_number,
            "nextRetryDate": next_retry,
            "createdAt":     p.created_at.isoformat() if p.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "pageSize": pageSize}


@router.get("/{payment_id}")
def get_payment(

    payment_id: int,

    db: Session = Depends(get_db)

):

    payment = (
        db.query(Payment)
        .options(
            joinedload(Payment.invoice)
            .joinedload(Invoice.customer)
        )
        .filter(
            Payment.id == payment_id
        )
        .first()
    )


    if not payment:

        raise HTTPException(
            status_code=404,
            detail="Payment not found"
        )


    return to_camel(payment)





# ==========================
# CREATE PAYMENT
# ==========================

@router.post("/")
def create_payment(

    payload: Any = Body(...),

    db: Session = Depends(get_db)

):
    print("CREATE PAYMENT API HIT")


    payment = Payment(

        invoice_id =
            payload.get("invoice_id"),


        payment_reference =
            payload.get("payment_reference")
            or f"PAY-{uuid.uuid4().hex[:8].upper()}",


        amount =
            float(
                payload.get(
                    "amount",
                    0
                )
            ),


        payment_method =
            payload.get(
                "payment_method",
                payload.get(
                    "method",
                    "card"
                )
            ),


        status =
            payload.get(
                "status",
                "pending"
            )

    )


    db.add(payment)

    db.commit()

    db.refresh(payment)



    # Update invoice only after successful payment
    if payment.status == "paid":

        invoice = (
            db.query(Invoice)
            .filter(
                Invoice.id == payment.invoice_id
            )
            .first()
        )


        if invoice:

            invoice.status = "paid"

            db.commit()



    # Audit log

    audit = AuditLog(

        entity_type="Payment",

        entity_id=payment.id,

        action="CREATE",

        module="Payments",

        description=
            f"Payment {payment.id} created",

        new_value={

            "amount": payment.amount,

            "method": payment.payment_method,

            "status": payment.status

        }

    )


    db.add(audit)

    db.commit()
     
    print("AUDIT CREATED ID:", audit.id)



    payment = (
        db.query(Payment)
        .options(
            joinedload(Payment.invoice)
            .joinedload(Invoice.customer)
        )
        .filter(
            Payment.id == payment.id
        )
        .first()
    )


    return to_camel(payment)





# ==========================
# UPDATE PAYMENT
# ==========================

@router.put("/{payment_id}")
def update_payment(

    payment_id: int,

    payload: Any = Body(...),

    db: Session = Depends(get_db)

):


    payment = (
        db.query(Payment)
        .filter(
            Payment.id == payment_id
        )
        .first()
    )


    if not payment:

        raise HTTPException(
            status_code=404,
            detail="Payment not found"
        )



    if "status" in payload:

        payment.status = payload["status"]



    if "payment_method" in payload:

        payment.payment_method = payload["payment_method"]



    if "amount" in payload:

        payment.amount = float(
            payload["amount"]
        )



    db.commit()

    db.refresh(payment)



    audit = AuditLog(

        entity_type="Payment",

        entity_id=payment.id,

        action="UPDATE",

        module="Payments",

        description=
            f"Payment {payment.id} updated",

        new_value={

            "amount": payment.amount,

            "method": payment.payment_method,

            "status": payment.status

        }

    )


    db.add(audit)

    db.commit()



    return to_camel(payment)





# ==========================
# REFUND PAYMENT
# ==========================

@router.post("/{payment_id}/refund")
def refund_payment(

    payment_id: int,

    db: Session = Depends(get_db)

):


    payment = (
        db.query(Payment)
        .filter(
            Payment.id == payment_id
        )
        .first()
    )


    if not payment:

        raise HTTPException(
            status_code=404,
            detail="Payment not found"
        )



    payment.status = "refunded"



    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id == payment.invoice_id
        )
        .first()
    )


    if invoice:

        invoice.status = "unpaid"



    db.commit()

    db.refresh(payment)



    audit = AuditLog(

        entity_type="Payment",

        entity_id=payment.id,

        action="REFUND",

        module="Payments",

        description=
            f"Payment {payment.id} refunded",

        new_value={
            "status": "refunded"
        }

    )


    db.add(audit)

    db.commit()



    return to_camel(payment)





# ==========================
# DELETE PAYMENT
# ==========================

@router.delete("/{payment_id}")
def delete_payment(

    payment_id: int,

    db: Session = Depends(get_db)

):


    payment = (
        db.query(Payment)
        .filter(
            Payment.id == payment_id
        )
        .first()
    )


    if not payment:

        raise HTTPException(
            status_code=404,
            detail="Payment not found"
        )



    audit = AuditLog(

        entity_type="Payment",

        entity_id=payment.id,

        action="DELETE",

        module="Payments",

        description=
            f"Payment {payment.id} deleted"

    )


    db.add(audit)



    db.delete(payment)

    db.commit()



    return {

        "message":
            "Payment deleted successfully"

    }