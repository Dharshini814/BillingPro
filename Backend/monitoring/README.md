# Phase 5: Operational Monitoring

## Overview

Comprehensive monitoring stack for BillingPro with:
- **Health Checks**: Kubernetes-style liveness/readiness/startup probes
- **Prometheus Metrics**: HTTP, database, and business metrics
- **Grafana Dashboards**: Pre-configured visualizations
- **Structured Logging**: JSON logs with correlation IDs
- **Alerting**: Production-ready alert rules

## Architecture

```
┌─────────────────┐
│  BillingPro API │
│   (FastAPI)     │
│                 │
│  /health/*      │◄──── Kubernetes Probes
│  /metrics       │◄──── Prometheus Scraper
│  Structured     │
│  JSON Logs      │◄──── Log Aggregator
└─────────────────┘
        │
        ▼
┌─────────────────┐
│   Prometheus    │
│  (Metrics DB)   │
└─────────────────┘
        │
        ▼
┌─────────────────┐
│    Grafana      │
│  (Dashboards)   │
└─────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
cd Backend
pip install -r requirements.txt
```

### 2. Start the API

```bash
uvicorn app.main:app --reload
```

The monitoring endpoints are now available:
- Health: http://localhost:8000/health
- Liveness: http://localhost:8000/health/live
- Readiness: http://localhost:8000/health/ready
- Startup: http://localhost:8000/health/startup
- Metrics: http://localhost:8000/metrics

### 3. Start Prometheus (Optional)

```bash
cd monitoring
prometheus --config.file=prometheus.yml
```

Access Prometheus at: http://localhost:9090

### 4. Start Grafana (Optional)

```bash
docker run -d -p 3000:3000 grafana/grafana
```

Access Grafana at: http://localhost:3000 (admin/admin)

## Health Check Endpoints

### GET /health
Overall health status with comprehensive checks.

**Response (200 OK - Healthy):**
```json
{
  "status": "healthy",
  "timestamp": "2026-10-22T10:30:45.123456Z",
  "uptime_seconds": 3600.52,
  "version": "2.1.0",
  "checks": {
    "database_connection": {
      "healthy": true,
      "latency_ms": 2.45,
      "error": null
    },
    "database_tables": {
      "healthy": true,
      "tables_checked": 6,
      "error": null
    }
  }
}
```

**Response (503 Service Unavailable - Unhealthy):**
```json
{
  "status": "unhealthy",
  "timestamp": "2026-10-22T10:30:45.123456Z",
  "uptime_seconds": 120.34,
  "version": "2.1.0",
  "checks": {
    "database_connection": {
      "healthy": false,
      "latency_ms": null,
      "error": "connection refused"
    },
    "database_tables": {
      "healthy": false,
      "tables_checked": 0,
      "error": "no connection"
    }
  }
}
```

### GET /health/live
Liveness probe - indicates if the application process is alive.

**Use Case**: Kubernetes liveness probe to restart crashed pods.

**Response (Always 200 OK):**
```json
{
  "status": "alive",
  "timestamp": "2026-10-22T10:30:45.123456Z",
  "uptime_seconds": 3600.52
}
```

### GET /health/ready
Readiness probe - indicates if the application can serve traffic.

**Use Case**: Kubernetes readiness probe to route traffic only to ready pods.

**Response (200 OK - Ready):**
```json
{
  "status": "ready",
  "timestamp": "2026-10-22T10:30:45.123456Z",
  "checks": {
    "database_connection": {"healthy": true, "latency_ms": 2.45},
    "database_tables": {"healthy": true, "tables_checked": 6}
  }
}
```

### GET /health/startup
Startup probe - indicates if initialization is complete.

**Use Case**: Kubernetes startup probe for slow-starting containers.

**Response (200 OK - Started):**
```json
{
  "status": "started",
  "timestamp": "2026-10-22T10:30:45.123456Z",
  "uptime_seconds": 5.23,
  "checks": {
    "minimum_uptime": {
      "healthy": true,
      "uptime_seconds": 5.23,
      "minimum_required": 2.0
    },
    "database_connection": {"healthy": true, "latency_ms": 2.45},
    "database_tables": {"healthy": true, "tables_checked": 6}
  }
}
```

## Prometheus Metrics

### HTTP Metrics
- `http_requests_total` - Total HTTP requests (counter)
- `http_request_duration_seconds` - Request latency histogram
- `http_requests_in_progress` - Concurrent requests (gauge)
- `http_errors_total` - HTTP error count (counter)

### Database Metrics
- `db_queries_total` - Total database queries (counter)
- `db_query_duration_seconds` - Query latency histogram
- `db_connections_active` - Active connections (gauge)

### Business Metrics
- `subscriptions_active` - Active subscriptions count (gauge)
- `subscriptions_total` - Total subscriptions by status (counter)
- `payments_total` - Total payments by status (counter)
- `payments_amount_total` - Payment amount by currency and status (counter)
- `invoices_generated_total` - Total invoices generated (counter)
- `monthly_recurring_revenue` - Current MRR (gauge)

### Error Metrics
- `application_errors_total` - Application errors by type (counter)

### Accessing Metrics

```bash
curl http://localhost:8000/metrics
```

Example output:
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/health",status_code="200"} 150.0
http_requests_total{method="POST",path="/payments/{id}",status_code="200"} 45.0

# HELP http_request_duration_seconds HTTP request latency in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.005",method="GET",path="/health"} 120.0
http_request_duration_seconds_bucket{le="0.01",method="GET",path="/health"} 145.0
...
```

## Structured Logging

### Configuration

Set log level via environment variable:
```bash
export LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR, CRITICAL
```

### Log Format

All logs are output as structured JSON:

```json
{
  "timestamp": "2026-10-22T10:30:45.123456Z",
  "level": "INFO",
  "logger": "app.payments",
  "message": "Payment processed successfully",
  "correlation_id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "module": "payment",
  "function": "process_payment",
  "line": 145,
  "payment_id": 12345,
  "customer_id": 678,
  "amount": 999.99,
  "status": "success"
}
```

### Correlation IDs

Every request gets a unique correlation ID for distributed tracing:

1. **Client sends header**: `X-Correlation-ID: abc123`
2. **Or server generates**: UUID if header missing
3. **All logs include**: correlation_id field
4. **Response includes**: `X-Correlation-ID` header

### Usage in Code

```python
from app.core.logging import StructuredLogger, log_payment_event

# Basic usage
logger = StructuredLogger(__name__)
logger.info("User action", user_id=123, action="login")

# Convenience functions
log_payment_event(
    "Payment processed",
    payment_id=456,
    customer_id=789,
    amount=99.99,
    status="success"
)
```

## Grafana Dashboards

Two pre-configured dashboards are included:

### 1. System Overview Dashboard
`grafana_dashboard_overview.json`

**Panels:**
- HTTP Request Rate
- HTTP Request Latency (p95)
- Requests In Progress
- HTTP Error Rate (4xx/5xx)
- Database Query Latency
- Active Database Connections

### 2. Business Metrics Dashboard
`grafana_dashboard_business.json`

**Panels:**
- Monthly Recurring Revenue (MRR)
- Active Subscriptions
- Payment Success Rate
- Subscription Events
- Payment Volume by Status
- Payment Amount Processed
- Invoice Generation Rate

### Importing Dashboards

1. Open Grafana: http://localhost:3000
2. Navigate to: Dashboards → Import
3. Upload JSON file or paste contents
4. Select Prometheus data source
5. Click "Import"

## Alert Rules

Pre-configured Prometheus alert rules in `alert_rules.yml`:

### API Alerts
- **HighHTTPErrorRate**: > 10 errors/sec for 5 minutes
- **CriticalHTTPErrorRate**: > 5 5xx errors/sec for 2 minutes
- **SlowAPIResponse**: p95 latency > 2s for 10 minutes

### Database Alerts
- **DatabaseConnectionFailure**: Unable to connect for 1 minute
- **SlowDatabaseQueries**: Average query time > 0.5s for 10 minutes

### Business Alerts
- **HighPaymentFailureRate**: > 10% failure rate for 10 minutes
- **CriticalPaymentFailureRate**: > 30% failure rate for 5 minutes
- **MRRDropDetected**: MRR decreasing > 1000 INR/hour
- **NoSubscriptionActivity**: No subscriptions for 4 hours
- **InvoiceGenerationStopped**: No invoices for 2 hours

### Health Alerts
- **ServiceDown**: API not responding for 1 minute

## Kubernetes Integration

### Liveness Probe
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 30
  timeoutSeconds: 5
  failureThreshold: 3
```

### Readiness Probe
```yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3
```

### Startup Probe
```yaml
startupProbe:
  httpGet:
    path: /health/startup
    port: 8000
  initialDelaySeconds: 0
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 30
```

## Testing

Run health check tests:

```bash
cd Backend
pytest tests/test_health.py -v
```

Expected output:
```
tests/test_health.py::TestHealthEndpoints::test_overall_health_check_returns_200 PASSED
tests/test_health.py::TestHealthEndpoints::test_liveness_probe_always_succeeds PASSED
tests/test_health.py::TestHealthEndpoints::test_readiness_probe_checks_database PASSED
...
```

## Production Deployment

### 1. Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/billing_db

# Optional
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR, CRITICAL
```

### 2. Prometheus Configuration

Update `prometheus.yml` with your API URL:

```yaml
scrape_configs:
  - job_name: 'billingpro-api'
    static_configs:
      - targets: ['your-api-host:8000']
```

### 3. Log Aggregation

Configure log forwarding to your aggregation service:
- Fluentd
- Logstash
- AWS CloudWatch
- Google Cloud Logging
- Azure Monitor

### 4. Alerting

Configure Alertmanager targets in `prometheus.yml`:

```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

## Monitoring Best Practices

1. **Set up alerts**: Configure critical alerts first (service down, high error rate)
2. **Monitor business metrics**: Track MRR, payment success rate, active subscriptions
3. **Track trends**: Use dashboards to identify gradual degradation
4. **Correlation IDs**: Always include in customer support tickets
5. **Log retention**: Keep logs for at least 30 days
6. **Metric retention**: Keep detailed metrics for 7 days, aggregated for 90 days

## Troubleshooting

### Metrics not appearing in Prometheus

1. Check `/metrics` endpoint is accessible:
   ```bash
   curl http://localhost:8000/metrics
   ```

2. Verify Prometheus can reach the API:
   ```bash
   curl http://localhost:9090/targets
   ```

3. Check Prometheus logs for scrape errors

### Health checks failing

1. Check database connectivity:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

2. Review application logs:
   ```bash
   # Logs are in JSON format
   tail -f /var/log/billingpro/app.log | jq .
   ```

3. Test health endpoint directly:
   ```bash
   curl -v http://localhost:8000/health
   ```

### Structured logs not parsing

1. Verify LOG_LEVEL is set correctly
2. Check log format is JSON (not mixed with uvicorn access logs)
3. Configure log aggregator to parse JSON

## Next Steps

1. **Deploy monitoring stack**: Set up Prometheus + Grafana in production
2. **Configure alerting**: Set up Alertmanager with email/Slack notifications
3. **Add custom metrics**: Track domain-specific business metrics
4. **Set up log aggregation**: Forward logs to centralized service
5. **Create runbooks**: Document response procedures for each alert

## Support

For issues or questions:
- Check health endpoints first
- Review structured logs with correlation ID
- Check Grafana dashboards for trends
- Review Prometheus alerts
