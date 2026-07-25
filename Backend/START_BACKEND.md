# Backend Startup

```bash
cd Backend

# Install dependencies
pip install -r requirements.txt

# Set your .env (copy from .env.example)
# DATABASE_URL=postgresql://postgres:password@localhost:5432/resume_db

# Run Alembic migrations (creates new tables)
alembic upgrade head

# OR let FastAPI auto-create tables on startup (Base.metadata.create_all)
# This happens automatically in main.py

# Start server
uvicorn app.main:app --reload --port 8000
```

## New API Endpoints (M2 Tasks 3–5)

### Task 3 – Mock Payment Gateway
| Method | Path | Description |
|--------|------|-------------|
| POST | /payments/process | Process payment (80% success, 20% fail) |
| POST | /webhooks/payment | Handle payment events |

### Task 4 – Retry & Refunds
| Method | Path | Description |
|--------|------|-------------|
| GET | /payment-retries/ | List failed payment retry queue |
| POST | /payment-retries/run | Process all due retries |
| POST | /refunds | Issue a refund |
| GET | /refunds | List refund history |
| GET | /refunds/{id} | Get single refund |

### Task 5 – Tax & PDF Invoice
| Method | Path | Description |
|--------|------|-------------|
| GET | /invoices/{id}/tax | Get tax breakdown |
| POST | /invoices/{id}/tax | Recalculate & save tax |
| GET | /invoices/{id}/pdf | Download PDF invoice |
