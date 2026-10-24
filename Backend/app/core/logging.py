"""
Phase 5: Operational Monitoring - Structured Logging
====================================================

Provides structured JSON logging with:
- Correlation IDs for request tracing
- Contextual metadata (user, customer, entity)
- Log levels with severity
- Integration with FastAPI request lifecycle
"""

import logging
import json
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from contextvars import ContextVar
from uuid import uuid4

# Context variable to store correlation ID across async calls
correlation_id_var: ContextVar[Optional[str]] = ContextVar("correlation_id", default=None)


class StructuredFormatter(logging.Formatter):
    """
    Custom formatter that outputs structured JSON logs.
    
    Each log entry includes:
    - timestamp: ISO 8601 format with timezone
    - level: log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    - message: log message
    - correlation_id: request tracking ID
    - logger: logger name (module)
    - Additional context fields
    """
    
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": correlation_id_var.get(),
        }
        
        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields from logger.info("msg", extra={...})
        if hasattr(record, "extra_fields"):
            log_entry.update(record.extra_fields)
        
        # Add common record attributes
        log_entry["module"] = record.module
        log_entry["function"] = record.funcName
        log_entry["line"] = record.lineno
        
        return json.dumps(log_entry, ensure_ascii=False)


def setup_logging(log_level: str = "INFO"):
    """
    Configure structured logging for the application.
    
    Args:
        log_level: Minimum log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    """
    # Remove existing handlers
    root_logger = logging.getLogger()
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Create console handler with structured formatter
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredFormatter())
    
    # Configure root logger
    root_logger.addHandler(handler)
    root_logger.setLevel(getattr(logging, log_level.upper()))
    
    # Reduce noise from third-party libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


class StructuredLogger:
    """
    Enhanced logger with context-aware structured logging.
    
    Usage:
        logger = StructuredLogger(__name__)
        logger.info("User logged in", user_id=123, email="user@example.com")
    """
    
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
    
    def _log(self, level: int, message: str, **context: Any):
        """Internal method to log with context."""
        # Create a custom LogRecord with extra fields
        extra = {"extra_fields": context}
        self.logger.log(level, message, extra=extra)
    
    def debug(self, message: str, **context: Any):
        """Log debug message with context."""
        self._log(logging.DEBUG, message, **context)
    
    def info(self, message: str, **context: Any):
        """Log info message with context."""
        self._log(logging.INFO, message, **context)
    
    def warning(self, message: str, **context: Any):
        """Log warning message with context."""
        self._log(logging.WARNING, message, **context)
    
    def error(self, message: str, **context: Any):
        """Log error message with context."""
        self._log(logging.ERROR, message, **context)
    
    def critical(self, message: str, **context: Any):
        """Log critical message with context."""
        self._log(logging.CRITICAL, message, **context)
    
    def exception(self, message: str, **context: Any):
        """Log exception with traceback."""
        extra = {"extra_fields": context}
        self.logger.exception(message, extra=extra)


# ═══════════════════════════════════════════════════════════════════
#  Correlation ID Management
# ═══════════════════════════════════════════════════════════════════

def get_correlation_id() -> str:
    """
    Get current correlation ID, generating one if needed.
    
    Returns:
        str: Correlation ID for current request context
    """
    correlation_id = correlation_id_var.get()
    if correlation_id is None:
        correlation_id = str(uuid4())
        correlation_id_var.set(correlation_id)
    return correlation_id


def set_correlation_id(correlation_id: str):
    """
    Set correlation ID for current context.
    
    Args:
        correlation_id: Correlation ID to set
    """
    correlation_id_var.set(correlation_id)


def reset_correlation_id():
    """Reset correlation ID to None."""
    correlation_id_var.set(None)


# ═══════════════════════════════════════════════════════════════════
#  Middleware Integration
# ═══════════════════════════════════════════════════════════════════

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    Middleware to inject correlation IDs into requests.
    
    - Reads X-Correlation-ID header if present
    - Generates new ID if not present
    - Adds correlation ID to response headers
    - Sets correlation ID in context for logging
    """
    
    async def dispatch(self, request: Request, call_next: Callable):
        # Get correlation ID from header or generate new one
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid4()))
        
        # Set in context for loggers
        set_correlation_id(correlation_id)
        
        # Log request start
        logger = StructuredLogger(__name__)
        logger.info(
            "Request started",
            method=request.method,
            path=str(request.url.path),
            query_params=dict(request.query_params),
            client_host=request.client.host if request.client else None
        )
        
        try:
            response = await call_next(request)
            
            # Add correlation ID to response
            response.headers["X-Correlation-ID"] = correlation_id
            
            # Log request completion
            logger.info(
                "Request completed",
                method=request.method,
                path=str(request.url.path),
                status_code=response.status_code
            )
            
            return response
        
        except Exception as e:
            # Log unhandled exception
            logger.exception(
                "Unhandled exception in request",
                method=request.method,
                path=str(request.url.path),
                exception_type=type(e).__name__
            )
            raise
        
        finally:
            # Reset correlation ID
            reset_correlation_id()


# ═══════════════════════════════════════════════════════════════════
#  Convenience Functions
# ═══════════════════════════════════════════════════════════════════

def log_payment_event(
    event: str,
    payment_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    amount: Optional[float] = None,
    status: Optional[str] = None,
    **extra: Any
):
    """
    Log a payment-related event with standard context.
    
    Args:
        event: Event description
        payment_id: Payment ID
        customer_id: Customer ID
        amount: Payment amount
        status: Payment status
        **extra: Additional context fields
    """
    logger = StructuredLogger("app.payments")
    logger.info(
        event,
        payment_id=payment_id,
        customer_id=customer_id,
        amount=amount,
        status=status,
        **extra
    )


def log_subscription_event(
    event: str,
    subscription_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    plan_id: Optional[int] = None,
    status: Optional[str] = None,
    **extra: Any
):
    """
    Log a subscription-related event with standard context.
    
    Args:
        event: Event description
        subscription_id: Subscription ID
        customer_id: Customer ID
        plan_id: Plan ID
        status: Subscription status
        **extra: Additional context fields
    """
    logger = StructuredLogger("app.subscriptions")
    logger.info(
        event,
        subscription_id=subscription_id,
        customer_id=customer_id,
        plan_id=plan_id,
        status=status,
        **extra
    )


def log_auth_event(
    event: str,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    success: bool = True,
    **extra: Any
):
    """
    Log an authentication-related event.
    
    Args:
        event: Event description
        user_id: User ID
        username: Username
        success: Whether auth succeeded
        **extra: Additional context fields
    """
    logger = StructuredLogger("app.auth")
    
    if success:
        logger.info(event, user_id=user_id, username=username, **extra)
    else:
        logger.warning(event, user_id=user_id, username=username, **extra)


def log_error(
    message: str,
    error_type: str,
    error_details: Optional[Dict] = None,
    **extra: Any
):
    """
    Log an application error with context.
    
    Args:
        message: Error message
        error_type: Type of error (validation, database, business_logic, etc.)
        error_details: Additional error details
        **extra: Additional context fields
    """
    logger = StructuredLogger("app.errors")
    logger.error(
        message,
        error_type=error_type,
        error_details=error_details or {},
        **extra
    )
