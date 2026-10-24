"""
Phase 5: Operational Monitoring - Prometheus Metrics
=====================================================

Provides Prometheus-compatible metrics middleware and custom metrics for:
- HTTP request counts, latency, and response codes
- Database query performance
- Business metrics (subscriptions, payments, MRR)
- Error rates and types
"""

from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    generate_latest,
    CONTENT_TYPE_LATEST
)
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse
import time
from typing import Callable


# ═══════════════════════════════════════════════════════════════════
#  HTTP Metrics
# ═══════════════════════════════════════════════════════════════════

http_requests_total = Counter(
    "http_requests_total",
    "Total number of HTTP requests",
    ["method", "path", "status_code"]
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "path"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0]
)

http_requests_in_progress = Gauge(
    "http_requests_in_progress",
    "Number of HTTP requests currently being processed",
    ["method", "path"]
)


# ═══════════════════════════════════════════════════════════════════
#  Database Metrics
# ═══════════════════════════════════════════════════════════════════

db_queries_total = Counter(
    "db_queries_total",
    "Total number of database queries",
    ["query_type"]  # SELECT, INSERT, UPDATE, DELETE
)

db_query_duration_seconds = Histogram(
    "db_query_duration_seconds",
    "Database query latency in seconds",
    ["query_type"],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
)

db_connections_active = Gauge(
    "db_connections_active",
    "Number of active database connections"
)


# ═══════════════════════════════════════════════════════════════════
#  Business Metrics
# ═══════════════════════════════════════════════════════════════════

subscriptions_active = Gauge(
    "subscriptions_active",
    "Number of active subscriptions"
)

subscriptions_total = Counter(
    "subscriptions_total",
    "Total number of subscriptions created",
    ["status"]  # active, cancelled, expired
)

payments_total = Counter(
    "payments_total",
    "Total number of payments",
    ["status"]  # success, failed, pending
)

payments_amount_total = Counter(
    "payments_amount_total",
    "Total payment amount processed",
    ["currency", "status"]
)

invoices_generated_total = Counter(
    "invoices_generated_total",
    "Total number of invoices generated"
)

monthly_recurring_revenue = Gauge(
    "monthly_recurring_revenue",
    "Current Monthly Recurring Revenue (MRR) in INR equivalent"
)


# ═══════════════════════════════════════════════════════════════════
#  Error Metrics
# ═══════════════════════════════════════════════════════════════════

http_errors_total = Counter(
    "http_errors_total",
    "Total number of HTTP errors",
    ["method", "path", "status_code"]
)

application_errors_total = Counter(
    "application_errors_total",
    "Total number of application errors",
    ["error_type"]  # validation, authentication, database, business_logic
)


# ═══════════════════════════════════════════════════════════════════
#  Middleware
# ═══════════════════════════════════════════════════════════════════

class PrometheusMiddleware(BaseHTTPMiddleware):
    """
    Middleware to automatically collect HTTP request metrics.
    
    Tracks:
    - Request count per endpoint and status code
    - Request duration histogram
    - Requests in progress gauge
    - Error counts for 4xx/5xx responses
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip metrics endpoint to avoid recursion
        if request.url.path == "/metrics":
            return await call_next(request)
        
        method = request.method
        path = self._get_normalized_path(request.url.path)
        
        # Track in-progress requests
        http_requests_in_progress.labels(method=method, path=path).inc()
        
        start_time = time.time()
        
        try:
            response = await call_next(request)
            status_code = response.status_code
            
        except Exception as e:
            # Track unhandled exceptions
            http_errors_total.labels(
                method=method,
                path=path,
                status_code="500"
            ).inc()
            application_errors_total.labels(error_type="unhandled_exception").inc()
            raise
        
        finally:
            # Record request duration
            duration = time.time() - start_time
            http_request_duration_seconds.labels(method=method, path=path).observe(duration)
            
            # Decrement in-progress counter
            http_requests_in_progress.labels(method=method, path=path).dec()
        
        # Record request count
        http_requests_total.labels(
            method=method,
            path=path,
            status_code=str(status_code)
        ).inc()
        
        # Track errors (4xx and 5xx)
        if status_code >= 400:
            http_errors_total.labels(
                method=method,
                path=path,
                status_code=str(status_code)
            ).inc()
        
        return response
    
    def _get_normalized_path(self, path: str) -> str:
        """
        Normalize path to reduce cardinality of metrics.
        
        Replaces numeric IDs with placeholders:
        /customers/123 -> /customers/{id}
        /invoices/456/pdf -> /invoices/{id}/pdf
        """
        parts = path.strip("/").split("/")
        normalized = []
        
        for i, part in enumerate(parts):
            # If part is numeric and previous part suggests it's an ID
            if part.isdigit() and i > 0:
                normalized.append("{id}")
            else:
                normalized.append(part)
        
        return "/" + "/".join(normalized) if normalized else "/"


# ═══════════════════════════════════════════════════════════════════
#  Metrics Endpoint
# ═══════════════════════════════════════════════════════════════════

def get_metrics() -> Response:
    """
    Expose metrics in Prometheus format.
    
    Returns:
        Response: Prometheus text format metrics
    """
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )


# ═══════════════════════════════════════════════════════════════════
#  Helper Functions
# ═══════════════════════════════════════════════════════════════════

def track_payment(status: str, amount: float, currency: str = "INR"):
    """Track a payment event."""
    payments_total.labels(status=status).inc()
    payments_amount_total.labels(currency=currency, status=status).inc(amount)


def track_subscription(status: str):
    """Track a subscription event."""
    subscriptions_total.labels(status=status).inc()


def track_invoice():
    """Track invoice generation."""
    invoices_generated_total.inc()


def track_error(error_type: str):
    """Track an application error."""
    application_errors_total.labels(error_type=error_type).inc()


def update_mrr(mrr_value: float):
    """Update current MRR gauge."""
    monthly_recurring_revenue.set(mrr_value)


def update_active_subscriptions(count: int):
    """Update active subscriptions gauge."""
    subscriptions_active.set(count)
