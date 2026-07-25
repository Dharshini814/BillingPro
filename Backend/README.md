# Vaultly Billing – Backend

FastAPI + PostgreSQL backend for the Vaultly SaaS billing platform.

---

## ⚙️ Setup & Run

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure database
The `.env` file is already set to your database:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/resume_db
```
Change the username/password if yours is different.

### 3. Run the database migration (ONE TIME)
If the `customers` table already exists, add the two new columns:
```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR';
```
Run this in **pgAdmin** or **psql**. All other new tables (`payment_retries`, `refunds`)
are created automatically when the server starts.

### 4. Start the server
```bash
uvicorn app.main:app --reload --port 8000
```

On startup you will see:
```
✅  Connected to PostgreSQL database: resume_db
✅  Tables verified / created.
```

### 5. View all APIs
Open http://localhost:8000/docs in your browser.

---

## 📋 New API Endpoints (M2 Tasks 3–5)

### Task 3 – Mock Payment Gateway
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/payments/process` | Process payment (80% success, 20% fail). Creates payment record, triggers webhook internally. |
| POST | `/webhooks/payment` | Handle events: `payment_success`, `payment_failed`, `payment_refunded` |

**Process Payment Request:**
```json
{ "invoice_id": 1, "amount": 499 }
```
**Webhook Request:**
```json
{ "event": "payment_success", "invoice_id": 1 }
```

---

### Task 4 – Retry & Refunds
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payment-retries/` | List retry queue (`?status=all/pending/success/failed`) |
| POST | `/payment-retries/run` | Process all due retries (scheduled by date) |
| POST | `/refunds` | Issue a refund (prorated or custom amount) |
| GET | `/refunds` | List all refunds |
| GET | `/refunds/{id}` | Single refund detail |

**Retry schedule:** Day 1 → Day 3 → Day 7. After 3 failures → subscription cancelled.

**Refund Request:**
```json
{ "invoice_id": 1, "refund_amount": 666, "reason": "Customer cancellation" }
```
Leave out `refund_amount` for automatic prorated calculation.

---

### Task 5 – Tax & PDF Invoice
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/invoices/{id}/tax` | Get tax breakdown for an invoice |
| POST | `/invoices/{id}/tax` | Recalculate tax (pass `{ "country": "India" }`) |
| GET | `/invoices/{id}/pdf` | Download PDF invoice |

---

## 🌍 Tax Rates by Country

| Country | Tax Type | Rate |
|---------|----------|------|
| India | GST (CGST 9% + SGST 9%) | **18%** |
| USA | Sales Tax | 10% |
| UK | VAT | 20% |
| Germany | VAT | 19% |
| UAE | VAT | 5% |
| Canada | GST | 5% |
| Australia | GST | 10% |
| Singapore | GST | 9% |
| Japan | Consumption Tax | 10% |
| Others | – | 0% |

Tax is **automatically applied** when generating invoices, based on the customer's country.

---

## 🗄️ Database Tables

All tables in `resume_db`:
- `users` – Auth users
- `customers` – Customer records (now with `country`, `currency`)
- `plans` – Subscription plans
- `subscriptions` – Customer subscriptions
- `billing_cycles` – Billing cycle records
- `invoices` – Invoice records
- `payments` – Payment transactions
- `payment_retries` – ⭐ NEW: Retry schedule for failed payments
- `refunds` – ⭐ NEW: Refund records
- `audit_logs` – Action audit trail
- `settings` – App settings
