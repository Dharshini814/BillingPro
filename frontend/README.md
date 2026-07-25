# Vaultly Billing – Frontend

React + Vite frontend for the Vaultly SaaS billing platform.

---

## ⚙️ Setup & Run

```bash
npm install
npm run dev
```
Frontend runs on http://localhost:5173

Make sure the backend is running on http://localhost:8000 first.

---

## 🆕 New Pages (M2 Tasks 3–5)

### Payment Dashboard (`/payment-dashboard`)
- Lists all invoices with status tabs (All / Unpaid / Paid / Failed / Refunded)
- **Pay** button on unpaid/failed invoices → opens modal → processes via `/payments/process`
- Shows transaction ID, result (success/failure), updated invoice status
- **Download PDF** button on every row → calls `/invoices/{id}/pdf` → real PDF download

### Failed Payments (`/failed-payments`)
Two tabs:
- **Failed Payment Queue** – shows retry schedule (Attempt 1 Day 1 / Attempt 2 Day 3 / Attempt 3 Day 7), invoice + subscription status
- **Refund History** – all issued refunds with reference number, customer, amounts, status
- **Run Due Retries** button → calls `/payment-retries/run`
- **Issue Refund** button (on paid invoices in queue) → opens modal with editable amount + reason

### Customers (`/customers`)
- Now has **Add Customer** button with full modal form
- Country dropdown (30+ countries) with auto-currency selection
- Tax note in form showing country-specific rate

---

## 🔑 No Mock APIs
`USE_MOCK = false` in `src/services/api.js` — every call goes to the real FastAPI backend.
