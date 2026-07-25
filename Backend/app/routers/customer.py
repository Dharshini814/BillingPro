from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional

from app.database import get_db

from app.models.customer import Customer
from app.models.audit_log import AuditLog

from app.schemas.customer import CustomerCreate, CustomerUpdate


router = APIRouter(
    prefix="/customers",
    tags=["Customers"]
)


def to_camel(c: Customer) -> dict:

    return {
        "id": c.id,
        "name": c.name,
        "email": c.email,
        "company": c.company_name or "",
        "phone": c.phone or "",
        "address": c.address or "",
        "status": c.status,
        "country": c.country or "India",
        "currency": c.currency or "INR",
        "joined": c.created_at.isoformat()
            if c.created_at else None,
        "plan": None,
        "mrr": 0,
    }



# ==========================
# LIST CUSTOMERS
# ==========================

@router.get("/")
def get_customers(

    search: Optional[str] = Query(None),

    status: Optional[str] = Query("all"),

    page: int = Query(1, ge=1),

    pageSize: Optional[int] = Query(None),

    page_size: Optional[int] = Query(None),

    db: Session = Depends(get_db)

):

    limit = pageSize or page_size or 8


    q = db.query(Customer)


    if search:

        q = q.filter(
            or_(
                Customer.name.ilike(f"%{search}%"),
                Customer.email.ilike(f"%{search}%"),
                Customer.company_name.ilike(f"%{search}%"),
            )
        )


    if status and status != "all":

        q = q.filter(
            Customer.status == status
        )


    total = q.count()


    items = (
        q.order_by(Customer.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )


    return {

        "items": [
            to_camel(c)
            for c in items
        ],

        "total": total,

        "page": page,

        "pageSize": limit

    }





# ==========================
# GET CUSTOMER
# ==========================

@router.get("/{customer_id}")
def get_customer(

    customer_id: int,

    db: Session = Depends(get_db)

):

    c = (
        db.query(Customer)
        .filter(
            Customer.id == customer_id
        )
        .first()
    )


    if not c:

        raise HTTPException(
            status_code=404,
            detail="Customer not found"
        )


    return to_camel(c)





# ==========================
# CREATE CUSTOMER
# ==========================

@router.post("/")
def create_customer(

    customer: CustomerCreate,

    db: Session = Depends(get_db)

):


    existing = (
        db.query(Customer)
        .filter(
            Customer.email == customer.email
        )
        .first()
    )


    if existing:

        raise HTTPException(
            status_code=400,
            detail="Email already exists"
        )



    c = Customer(

        name=customer.name,

        email=customer.email,

        company_name=customer.company_name,

        phone=customer.phone,

        address=customer.address,

        status=customer.status,

        country=getattr(customer, 'country', None) or "India",

        currency=getattr(customer, 'currency', None) or "INR",

    )


    db.add(c)

    db.commit()

    db.refresh(c)



    audit = AuditLog(

        entity_type="customer",

        entity_id=c.id,

        action="created",

        module="customers",

        description="Customer created",

        old_value=None,

        new_value={

            "name": c.name,

            "email": c.email,

            "company": c.company_name

        },

        performed_by=None,

        user_name=None,

        ip_address=None

    )


    db.add(audit)

    db.commit()



    return to_camel(c)





# ==========================
# UPDATE CUSTOMER
# ==========================

@router.put("/{customer_id}")
def update_customer(

    customer_id: int,

    customer_data: CustomerUpdate,

    db: Session = Depends(get_db)

):


    c = (
        db.query(Customer)
        .filter(
            Customer.id == customer_id
        )
        .first()
    )


    if not c:

        raise HTTPException(
            status_code=404,
            detail="Customer not found"
        )


    old_data = {

        "name": c.name,

        "email": c.email,

        "company": c.company_name,

        "status": c.status

    }



    c.name = customer_data.name

    c.email = customer_data.email

    c.company_name = customer_data.company_name

    c.phone = customer_data.phone

    c.address = customer_data.address

    c.status = customer_data.status

    c.country = getattr(customer_data, 'country', None) or "India"

    c.currency = getattr(customer_data, 'currency', None) or "INR"



    db.commit()

    db.refresh(c)



    audit = AuditLog(

        entity_type="customer",

        entity_id=c.id,

        action="updated",

        module="customers",

        description="Customer updated",

        old_value=old_data,

        new_value={

            "name": c.name,

            "email": c.email,

            "company": c.company_name,

            "status": c.status

        }

    )


    db.add(audit)

    db.commit()



    return to_camel(c)





# ==========================
# DELETE CUSTOMER
# ==========================

@router.delete("/{customer_id}")
def delete_customer(

    customer_id: int,

    db: Session = Depends(get_db)

):


    c = (
        db.query(Customer)
        .filter(
            Customer.id == customer_id
        )
        .first()
    )


    if not c:

        raise HTTPException(
            status_code=404,
            detail="Customer not found"
        )


    audit = AuditLog(

        entity_type="customer",

        entity_id=c.id,

        action="deleted",

        module="customers",

        description="Customer deleted",

        old_value={

            "name": c.name,

            "email": c.email

        },

        new_value=None

    )


    db.add(audit)


    db.delete(c)

    db.commit()



    return {

        "message":
        "Customer deleted successfully"

    }