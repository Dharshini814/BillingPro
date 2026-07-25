"""
Run this ONCE before starting the backend for the first time
after upgrading to M2 Tasks 3-4-5.

Usage:
    python migrate.py

It safely adds new columns and creates new tables without touching existing data.
"""

import os
from dotenv import load_dotenv
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/resume_db")

# Parse DATABASE_URL
import urllib.parse as urlparse
result = urlparse.urlparse(DATABASE_URL)
conn_params = {
    "dbname":   result.path[1:],
    "user":     result.username,
    "password": result.password,
    "host":     result.hostname,
    "port":     result.port or 5432,
}

print(f"\n{'='*55}")
print(f"  Connecting to: {conn_params['dbname']} @ {conn_params['host']}")
print(f"{'='*55}\n")

conn = psycopg2.connect(**conn_params)
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cur = conn.cursor()

migrations = [
    # Add country and currency to customers table
    """
    ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS country  VARCHAR(100) DEFAULT 'India',
        ADD COLUMN IF NOT EXISTS currency VARCHAR(10)  DEFAULT 'INR';
    """,
    # Update existing customers to have default country/currency
    """
    UPDATE customers
    SET country  = 'India',
        currency = 'INR'
    WHERE country IS NULL OR country = '';
    """,
    # Create payment_retries table
    """
    CREATE TABLE IF NOT EXISTS payment_retries (
        id              SERIAL PRIMARY KEY,
        payment_id      INTEGER NOT NULL REFERENCES payments(id),
        invoice_id      INTEGER NOT NULL REFERENCES invoices(id),
        attempt_number  INTEGER NOT NULL DEFAULT 1,
        scheduled_date  DATE NOT NULL,
        status          VARCHAR(20) NOT NULL DEFAULT 'pending',
        attempted_at    TIMESTAMPTZ,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
    );
    """,
    # Create refunds table
    """
    CREATE TABLE IF NOT EXISTS refunds (
        id               SERIAL PRIMARY KEY,
        refund_reference VARCHAR(100) NOT NULL UNIQUE,
        payment_id       INTEGER NOT NULL REFERENCES payments(id),
        invoice_id       INTEGER NOT NULL REFERENCES invoices(id),
        customer_id      INTEGER NOT NULL REFERENCES customers(id),
        paid_amount      FLOAT NOT NULL,
        refund_amount    FLOAT NOT NULL,
        reason           TEXT,
        status           VARCHAR(20) NOT NULL DEFAULT 'completed',
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW()
    );
    """,
]

for i, sql in enumerate(migrations, 1):
    try:
        cur.execute(sql)
        label = sql.strip().split('\n')[0][:60]
        print(f"  ✅ Migration {i}: {label.strip()}")
    except Exception as e:
        print(f"  ⚠️  Migration {i} warning: {e}")

cur.close()
conn.close()

print(f"\n{'='*55}")
print("  ✅  Database migration complete!")
print(f"{'='*55}\n")
print("  Now start the backend:")
print("  uvicorn app.main:app --reload --port 8000\n")
