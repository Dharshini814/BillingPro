from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import Base, engine

# ── Routers ──
from app.api.routes              import router
from app.routers.auth            import router as auth_router
from app.routers.customer        import router as customer_router
from app.routers.plan            import router as plan_router
from app.routers.subscription    import router as subscription_router
from app.routers.invoice         import router as invoice_router
from app.routers.payment         import router as payment_router
from app.routers.audit_log       import router as audit_log_router
from app.routers.user            import router as user_router
from app.routers.settings        import router as settings_router
from app.routers.process_payment import router as process_payment_router
from app.routers.retry_refund    import router as retry_refund_router
from app.routers.dashboard       import router as dashboard_router

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

app = FastAPI(title="Vaultly Billing API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
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
]


def run_migrations():
    with engine.begin() as conn:
        db_name = conn.execute(text("SELECT current_database()")).scalar()
        print(f"\n{'='*55}")
        print(f"  ✅  Connected to PostgreSQL: {db_name}")
        print(f"{'='*55}")

        for label, sql in MIGRATIONS:
            try:
                conn.execute(text(sql.strip()))
                print(f"  ✅  {label}")
            except Exception as e:
                # Non-fatal — table/column may already exist in correct form
                print(f"  ⚠️   {label}: {str(e)[:80]}")

        print(f"{'='*55}\n")


# Run migrations before anything else
run_migrations()

# Auto-create any remaining tables via SQLAlchemy ORM
Base.metadata.create_all(bind=engine)
print("  ✅  All tables ready.\n")


# ── Register routers ──
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
# invoice router handles Task 5 (/invoices/{id}/tax and /invoices/{id}/pdf)


@app.get("/")
def root():
    return {"message": "Vaultly Backend Running 🚀", "db": "resume_db"}

@app.get("/health")
def health():
    return {"status": "ok"}
