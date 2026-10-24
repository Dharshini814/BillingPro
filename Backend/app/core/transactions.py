"""
Transaction safety utilities for database operations.

Provides context managers and decorators for ensuring atomic operations
with proper error handling and rollback.
"""

from contextlib import contextmanager
from functools import wraps
from typing import Callable, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)


@contextmanager
def atomic_transaction(db: Session, description: str = "Transaction"):
    """
    Context manager for atomic database transactions with automatic rollback on error.
    
    Usage:
        with atomic_transaction(db, "Process payment"):
            # Database operations here
            payment = Payment(...)
            db.add(payment)
            # Automatically committed on success, rolled back on exception
    
    Args:
        db: SQLAlchemy session
        description: Human-readable description for logging
    
    Raises:
        Original exception after rollback
    """
    try:
        yield db
        db.commit()
        logger.debug(f"[TRANSACTION] {description} - COMMITTED")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"[TRANSACTION] {description} - ROLLED BACK: {str(e)[:200]}")
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"[TRANSACTION] {description} - ROLLED BACK (non-SQL): {str(e)[:200]}")
        raise


def validate_invoice_state_transition(from_status: str, to_status: str) -> bool:
    """
    Validate that an invoice state transition is allowed.
    
    Valid transitions:
        draft -> unpaid, cancelled
        unpaid -> paid, failed, cancelled
        failed -> unpaid (retry)
        paid -> refunded
        cancelled -> (no transitions allowed)
        refunded -> (no transitions allowed)
    
    Args:
        from_status: Current invoice status
        to_status: Target invoice status
    
    Returns:
        bool: True if transition is valid
    """
    valid_transitions = {
        "draft": {"unpaid", "cancelled"},
        "unpaid": {"paid", "failed", "cancelled", "overdue"},
        "failed": {"unpaid", "cancelled"},
        "overdue": {"paid", "failed", "cancelled"},
        "paid": {"refunded"},
        "cancelled": set(),  # Terminal state
        "refunded": set(),   # Terminal state
    }
    
    current_status = from_status.lower() if from_status else "draft"
    target_status = to_status.lower() if to_status else "unpaid"
    
    allowed = valid_transitions.get(current_status, set())
    return target_status in allowed


def validate_payment_state_transition(from_status: str, to_status: str) -> bool:
    """
    Validate that a payment state transition is allowed.
    
    Valid transitions:
        pending -> paid, failed
        unpaid -> paid, failed
        failed -> pending (retry)
        paid -> refunded
        refunded -> (no transitions allowed)
    
    Args:
        from_status: Current payment status
        to_status: Target payment status
    
    Returns:
        bool: True if transition is valid
    """
    valid_transitions = {
        "pending": {"paid", "failed"},
        "unpaid": {"paid", "failed"},
        "failed": {"pending"},  # Allow retry
        "paid": {"refunded"},
        "refunded": set(),  # Terminal state
    }
    
    current_status = from_status.lower() if from_status else "pending"
    target_status = to_status.lower() if to_status else "pending"
    
    allowed = valid_transitions.get(current_status, set())
    return target_status in allowed


def enforce_invoice_state_transition(invoice, new_status: str) -> None:
    """
    Enforce valid invoice state transition or raise exception.
    
    Args:
        invoice: Invoice model instance
        new_status: Target status
    
    Raises:
        HTTPException: 400 if transition is invalid
    """
    old_status = invoice.status
    
    if not validate_invoice_state_transition(old_status, new_status):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid invoice state transition: {old_status} -> {new_status}"
        )
    
    invoice.status = new_status
    logger.info(f"[STATE] Invoice #{invoice.id}: {old_status} -> {new_status}")


def enforce_payment_state_transition(payment, new_status: str) -> None:
    """
    Enforce valid payment state transition or raise exception.
    
    Args:
        payment: Payment model instance
        new_status: Target status
    
    Raises:
        HTTPException: 400 if transition is invalid
    """
    old_status = payment.status
    
    if not validate_payment_state_transition(old_status, new_status):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid payment state transition: {old_status} -> {new_status}"
        )
    
    payment.status = new_status
    logger.info(f"[STATE] Payment #{payment.id}: {old_status} -> {new_status}")


def verify_payment_amount_matches_invoice(payment_amount: float, invoice_amount: float, tolerance: float = 0.01) -> bool:
    """
    Verify that payment amount matches invoice amount within tolerance.
    
    Args:
        payment_amount: Amount from payment record
        invoice_amount: Amount from invoice record
        tolerance: Acceptable difference (default 0.01 for rounding)
    
    Returns:
        bool: True if amounts match within tolerance
    """
    return abs(payment_amount - invoice_amount) <= tolerance


def enforce_payment_amount_match(payment_amount: float, invoice_amount: float) -> None:
    """
    Enforce that payment amount matches invoice amount or raise exception.
    
    Args:
        payment_amount: Amount from payment record
        invoice_amount: Amount from invoice record
    
    Raises:
        HTTPException: 400 if amounts don't match
    """
    if not verify_payment_amount_matches_invoice(payment_amount, invoice_amount):
        raise HTTPException(
            status_code=400,
            detail=f"Payment amount ({payment_amount}) does not match invoice amount ({invoice_amount})"
        )
