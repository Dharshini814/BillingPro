"""
Customer resource ownership authorization.

Ensures that users can only access their own resources (invoices, payments, subscriptions)
unless they have admin privileges.
"""

from typing import Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.subscription import Subscription
from app.models.payment import Payment


def verify_customer_access(
    customer_email: str,
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Verify that the current user is authorized to access resources for the given customer email.
    
    Authorization rules:
    - Admin users can access all customer resources
    - Regular users can only access their own resources (email must match)
    
    Raises:
        HTTPException: 403 if user is not authorized to access the customer's resources
    """
    # Admin users have access to all resources
    if current_user.role == "admin":
        return
    
    # Regular users can only access their own resources
    if current_user.email.lower() != customer_email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this customer's resources"
        )


def verify_customer_id_access(
    customer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """
    Verify that the current user is authorized to access resources for the given customer ID.
    
    Authorization rules:
    - Admin users can access all customer resources
    - Regular users can only access their own resources (email must match customer's email)
    
    Raises:
        HTTPException: 403 if user is not authorized
        HTTPException: 404 if customer not found
    """
    # Admin users have access to all resources
    if current_user.role == "admin":
        return
    
    # Look up customer to verify ownership
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    # Regular users can only access their own resources
    if current_user.email.lower() != customer.email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this customer's resources"
        )


def verify_invoice_access(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Invoice:
    """
    Verify that the current user is authorized to access the given invoice.
    Returns the invoice if authorized.
    
    Authorization rules:
    - Admin users can access all invoices
    - Regular users can only access invoices for customers with matching email
    
    Raises:
        HTTPException: 403 if user is not authorized
        HTTPException: 404 if invoice not found
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    # Admin users have access to all invoices
    if current_user.role == "admin":
        return invoice
    
    # Regular users can only access their own invoices
    customer = db.query(Customer).filter(Customer.id == invoice.customer_id).first()
    if not customer or current_user.email.lower() != customer.email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this invoice"
        )
    
    return invoice


def verify_subscription_access(
    subscription_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Subscription:
    """
    Verify that the current user is authorized to access the given subscription.
    Returns the subscription if authorized.
    
    Authorization rules:
    - Admin users can access all subscriptions
    - Regular users can only access subscriptions for customers with matching email
    
    Raises:
        HTTPException: 403 if user is not authorized
        HTTPException: 404 if subscription not found
    """
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found"
        )
    
    # Admin users have access to all subscriptions
    if current_user.role == "admin":
        return subscription
    
    # Regular users can only access their own subscriptions
    customer = db.query(Customer).filter(Customer.id == subscription.customer_id).first()
    if not customer or current_user.email.lower() != customer.email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this subscription"
        )
    
    return subscription


def verify_payment_access(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Payment:
    """
    Verify that the current user is authorized to access the given payment.
    Returns the payment if authorized.
    
    Authorization rules:
    - Admin users can access all payments
    - Regular users can only access payments for their own invoices
    
    Raises:
        HTTPException: 403 if user is not authorized
        HTTPException: 404 if payment not found
    """
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Admin users have access to all payments
    if current_user.role == "admin":
        return payment
    
    # Regular users can only access their own payments
    invoice = db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated invoice not found"
        )
    
    customer = db.query(Customer).filter(Customer.id == invoice.customer_id).first()
    if not customer or current_user.email.lower() != customer.email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this payment"
        )
    
    return payment


def get_authorized_customer_email(
    customer_email: Optional[str],
    current_user: User = Depends(get_current_user),
) -> Optional[str]:
    """
    Get the authorized customer email for filtering resources.
    
    Authorization rules:
    - If user is admin and provides customer_email, use it (allows admin to filter)
    - If user is admin and doesn't provide customer_email, return None (show all)
    - If user is regular and provides customer_email, verify it matches their email
    - If user is regular and doesn't provide customer_email, use their email
    
    Returns:
        Optional[str]: The email to use for filtering, or None to show all (admin only)
    
    Raises:
        HTTPException: 403 if regular user tries to access another customer's resources
    """
    # Admin can filter by any email or see all
    if current_user.role == "admin":
        return customer_email
    
    # Regular user provided a different email - forbidden
    if customer_email and customer_email.lower() != current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own resources"
        )
    
    # Regular user: always filter by their own email
    return current_user.email
