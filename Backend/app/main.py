from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from dotenv import load_dotenv
import os

load_dotenv()

from app.database import Base, engine

# Phase 5: Operational Monitoring
from app.core.logging import setup_logging, CorrelationIdMiddleware
from app.core.metrics import PrometheusMiddleware, get_metrics

# Setup structured logging
log_level = os.getenv("LOG_LEVEL", "INFO")
setup_logging(log_level)

# ── Routers ──
from app.api.routes              import router
from app.routers.auth            import router as auth_router
from app.routers.customer        import router as customer_router
from app.routers.plan            import router as plan_router
from app.routers.subscription    import router as subscription_router
from app.routers.invoice         import router as invoice_router
from app.routers.payment import router as payment_router
from app.routers.audit_log       import router as audit_log_router
from app.routers.user            import router as user_router
from app.routers.settings        import router as settings_router
from app.routers.process_payment import router as process_payment_router
from app.routers.retry_refund    import router as retry_refund_router
from app.routers.dashboard       import router as dashboard_router
from app.routers.chatbot         import router as chatbot_router
from app.routers.reconciliation  import router as reconciliation_router
from app.routers.risk_assessment import router as risk_assessment_router
from app.routers.revenue         import router as revenue_router
from app.routers.health          import router as health_router  # Phase 5: Health checks

# ── Models (must import before create_all) ──
from app.models.user          import User
from app.models.customer      import Customer
from app.models.plan          import Plan
from app.models.subscription  import Subscription
from app.models.billing_cycle import BillingCycle
from app.models.invoice       import Invoice
from app.models.payment       import Payment
from app.models.payment_retry import PaymentRetry
from app.models.refund        import Refund
from app.models.audit_log     import AuditLog
from app.models.settings      import Settings
from app.models.webhook_event     import WebhookEvent          # Phase 2: webhook dedup
from app.models.secure_audit_log  import SecureAuditLog        # Phase 2: hash-chain audit
app = FastAPI(title="Vaultly Billing API", version="2.1.0")

# ── Phase 5: Monitoring Middleware (order matters!) ──
# 1. Correlation ID tracking (sets context for logging)
app.add_middleware(CorrelationIdMiddleware)

# 2. Prometheus metrics (tracks all requests)
app.add_middleware(PrometheusMiddleware)

# 3. CORS (last middleware, first to process response)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────
#  STARTUP MIGRATIONS
#  Runs every time the server starts.
#  All SQL is idempotent (IF NOT EXISTS / IF EXISTS).
#  This means you NEVER need to run any manual SQL.
# ─────────────────────────────────────────────────────
MIGRATIONS = [
    # ── customers: add country + currency ──────────────
    ("customers.country",
     "ALTER TABLE customers ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India'"),
    ("customers.currency",
     "ALTER TABLE customers ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR'"),
    ("customers.country defaults",
     "UPDATE customers SET country = 'India' WHERE country IS NULL OR country = ''"),
    ("customers.currency defaults",
     "UPDATE customers SET currency = 'INR' WHERE currency IS NULL OR currency = ''"),

    # ── customers: wallet_balance (mirrors alembic c3d4e5f6a7b8) ───────────────────────
    ("customers.wallet_balance",
     "ALTER TABLE customers ADD COLUMN IF NOT EXISTS wallet_balance FLOAT NOT NULL DEFAULT 0.0"),

    # ── plans: is_active soft-archive flag ─────────────────────
    ("plans.is_active",
     "ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"),

    # ── invoices: type + notes for prorated/wallet invoices ────
    ("invoices.invoice_type",
     "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(30) DEFAULT 'regular'"),
    ("invoices.notes",
     "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT"),

    # ── payment_retries table ──────────────────────────
    ("table:payment_retries", """
        CREATE TABLE IF NOT EXISTS payment_retries (
            id             SERIAL PRIMARY KEY,
            payment_id     INTEGER NOT NULL REFERENCES payments(id),
            invoice_id     INTEGER NOT NULL REFERENCES invoices(id),
            attempt_number INTEGER NOT NULL DEFAULT 1,
            scheduled_date DATE NOT NULL,
            status         VARCHAR(20) NOT NULL DEFAULT 'pending',
            attempted_at   TIMESTAMPTZ,
            created_at     TIMESTAMPTZ DEFAULT NOW(),
            updated_at     TIMESTAMPTZ DEFAULT NOW()
        )
    """),

    # ── refunds table ──────────────────────────────────
    ("table:refunds", """
        CREATE TABLE IF NOT EXISTS refunds (
            id               SERIAL PRIMARY KEY,
            refund_reference VARCHAR(100) NOT NULL UNIQUE,
            payment_id       INTEGER NOT NULL REFERENCES payments(id),
            invoice_id       INTEGER NOT NULL REFERENCES invoices(id),
            customer_id      INTEGER NOT NULL REFERENCES customers(id),
            paid_amount      FLOAT NOT NULL,
            refund_amount    FLOAT NOT NULL,
            reason           TEXT,
            status           VARCHAR(20) NOT NULL DEFAULT 'pending_approval',
            requested_by     VARCHAR(20) DEFAULT 'user',
            created_at       TIMESTAMPTZ DEFAULT NOW(),
            updated_at       TIMESTAMPTZ DEFAULT NOW()
        )
    """),
    # ── refunds: add requested_by if missing (for existing tables) ──
    ("refunds.requested_by",
     "ALTER TABLE refunds ADD COLUMN IF NOT EXISTS requested_by VARCHAR(20) DEFAULT 'user'"),

    # ══════════════════════════════════════════════════════
    #  Phase 2: Security Foundation Migrations
    # ══════════════════════════════════════════════════════

    # ── payments: idempotency key ──
    ("payments.idempotency_key",
     "ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR UNIQUE"),

    # ── webhook_events table ──
    ("table:webhook_events", """
        CREATE TABLE IF NOT EXISTS webhook_events (
            id             SERIAL PRIMARY KEY,
            event_id       VARCHAR NOT NULL UNIQUE,
            event_type     VARCHAR NOT NULL,
            source         VARCHAR DEFAULT 'mock_gateway',
            payload        JSONB,
            status         VARCHAR DEFAULT 'processed',
            processed_at   TIMESTAMPTZ DEFAULT NOW(),
            created_at     TIMESTAMPTZ DEFAULT NOW()
        )
    """),
    ("index:webhook_events.event_id",
     "CREATE INDEX IF NOT EXISTS ix_webhook_events_event_id ON webhook_events(event_id)"),

    # ── secure_audit_logs table ──
    ("table:secure_audit_logs", """
        CREATE TABLE IF NOT EXISTS secure_audit_logs (
            id             SERIAL PRIMARY KEY,
            timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            user_id        INTEGER,
            user_name      VARCHAR,
            action         VARCHAR NOT NULL,
            entity_type    VARCHAR,
            entity_id      INTEGER,
            description    TEXT,
            old_value      JSONB,
            new_value      JSONB,
            ip_address     VARCHAR,
            previous_hash  VARCHAR(128),
            record_hash    VARCHAR(128) NOT NULL
        )
    """),
]


def run_migrations():
    with engine.begin() as conn:
        # Get database name (works for both PostgreSQL and SQLite)
        try:
            db_name = conn.execute(text("SELECT current_database()")).scalar()
        except Exception:
            # Fallback for SQLite (used in tests)
            db_name = "test_db"
        
        print(f"\n{'='*55}")
        print(f"  [OK]  Connected to database: {db_name}")
        print(f"{'='*55}")

        for label, sql in MIGRATIONS:
            try:
                conn.execute(text(sql.strip()))
                print(f"  [OK]  {label}")
            except Exception as e:
                # Non-fatal — table/column may already exist in correct form
                print(f"  [WARN]   {label}: {str(e)[:80]}")

        print(f"{'='*55}\n")


# Run migrations before anything else
run_migrations()

# Auto-create any remaining tables via SQLAlchemy ORM
Base.metadata.create_all(bind=engine)
print("  [OK]  All tables ready.\n")


# ── Register routers ──
app.include_router(health_router)            # Phase 5: Health checks (register first for priority)
app.include_router(router)
app.include_router(auth_router)
app.include_router(customer_router)
app.include_router(plan_router)
app.include_router(subscription_router)
app.include_router(invoice_router)
app.include_router(payment_router)
app.include_router(audit_log_router)
app.include_router(user_router)
app.include_router(settings_router)
app.include_router(process_payment_router)   # Task 3
app.include_router(retry_refund_router)      # Task 4
app.include_router(dashboard_router)
app.include_router(chatbot_router)           # AI Chatbot
app.include_router(reconciliation_router)    # Phase 2: Reconciliation
app.include_router(risk_assessment_router)   # Phase 3: Risk Assessment & Payment Intelligence
app.include_router(revenue_router)           # Phase 4: Revenue Intelligence
# invoice router handles Task 5 (/invoices/{id}/tax and /invoices/{id}/pdf)


@app.get("/")
def root():
    return {"message": "Vaultly Backend Running 🚀", "db": "billing_db", "version": "2.1.0"}


# ── Phase 5: Prometheus Metrics Endpoint ──
@app.get("/metrics")
def metrics():
    """Expose Prometheus metrics for scraping."""
    return get_metrics()



