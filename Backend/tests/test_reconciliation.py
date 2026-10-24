"""
Test suite for payment reconciliation and integrity monitoring.

Tests cover:
- Reconciliation endpoint functionality
- Discrepancy detection
- Payment summary statistics
- State validation improvements
"""

import pytest
import uuid
from datetime import date, datetime, timedelta
from app.models.customer import Customer
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.services.reconciliation import reconcile_payments, get_payment_summary


@pytest.fixture
def admin_token(client):
    """Create admin user and return auth token."""
    admin_data = {
        "full_name": "Admin User",
        "email": "admin@example.com",
        "password": "admin123",
        "role": "admin"
    }
    client.post("/signup", json=admin_data)
    response = client.post("/login", json={
        "email": admin_data["email"],
        "password": admin_data["password"]
    })
    return response.json()["access_token"]


@pytest.fixture
def test_data(db_session):
    """Create test customer, plan, subscription, and invoice."""
    customer = Customer(
        name="Test Customer",
        email=f"reconcile_{uuid.uuid4().hex[:8]}@example.com",
        country="India",
        currency="INR",
        status="Active"
    )
    db_session.add(customer)
    
    plan = Plan(
        name="Test Plan",
        price=100.0,
        billing_interval="monthly",
        trial_days=0,
        is_active=True
    )
    db_session.add(plan)
    db_session.flush()
    
    subscription = Subscription(
        customer_id=customer.id,
        plan_id=plan.id,
        status="active",
        amount=plan.price,
        billing_cycle="monthly",
        start_date=date.today(),
        next_billing_date=date.today() + timedelta(days=30)
    )
    db_session.add(subscription)
    db_session.flush()
    
    invoice = Invoice(
        invoice_number=f"INV-REC-{uuid.uuid4().hex[:8].upper()}",
        customer_id=customer.id,
        subscription_id=subscription.id,
        invoice_date=date.today(),
        due_date=date.today() + timedelta(days=7),
        subtotal=100.0,
        tax_amount=18.0,
        total_amount=118.0,
        status="unpaid",
        plan_name="Test Plan"
    )
    db_session.add(invoice)
    db_session.commit()
    
    db_session.refresh(customer)
    db_session.refresh(invoice)
    
    return {
        "customer": customer,
        "plan": plan,
        "subscription": subscription,
        "invoice": invoice
    }


class TestReconciliationEndpoints:
    """Test reconciliation API endpoints."""

    def test_reconciliation_requires_admin(self, client):
        """Reconciliation endpoints should require admin role."""
        # Try without auth
        response = client.get("/reconciliation/payments")
        assert response.status_code == 401
        
        # Try with regular user
        user_data = {
            "full_name": "Regular User",
            "email": "user@example.com",
            "password": "user123",
            "role": "user"
        }
        client.post("/signup", json=user_data)
        login_response = client.post("/login", json={
            "email": user_data["email"],
            "password": user_data["password"]
        })
        user_token = login_response.json()["access_token"]
        
        response = client.get(
            "/reconciliation/payments",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403

    def test_reconciliation_endpoint_returns_report(self, client, admin_token, test_data):
        """Reconciliation endpoint should return valid report."""
        response = client.get(
            "/reconciliation/payments",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check report structure
        assert "reconciliation_period" in data
        assert "statistics" in data
        assert "discrepancies" in data
        assert "status" in data
        
        assert "start_date" in data["reconciliation_period"]
        assert "end_date" in data["reconciliation_period"]
        
        assert "total_paid_invoices" in data["statistics"]
        assert "total_successful_payments" in data["statistics"]
        assert "total_discrepancies" in data["statistics"]

    def test_reconciliation_with_date_range(self, client, admin_token):
        """Reconciliation should accept date range parameters."""
        start_date = (date.today() - timedelta(days=7)).isoformat()
        end_date = date.today().isoformat()
        
        response = client.get(
            f"/reconciliation/payments?start_date={start_date}&end_date={end_date}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["reconciliation_period"]["start_date"] == start_date
        assert data["reconciliation_period"]["end_date"] == end_date

    def test_payment_summary_endpoint(self, client, admin_token):
        """Payment summary endpoint should return statistics."""
        response = client.get(
            "/reconciliation/payments/summary?days=30",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "period_days" in data
        assert "by_status" in data
        assert "success_rate" in data
        assert "total_attempts" in data

    def test_reconciliation_health_check(self, client, admin_token):
        """Health check endpoint should return status."""
        response = client.get(
            "/reconciliation/health",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "status" in data
        assert "critical_discrepancies" in data
        assert "message" in data
        assert data["status"] in ("healthy", "issues_detected")


class TestDiscrepancyDetection:
    """Test discrepancy detection in reconciliation."""

    def test_detect_paid_invoice_without_payment(self, db_session, test_data):
        """Should detect invoice marked as paid without payment record."""
        # Mark invoice as paid without creating payment
        invoice = test_data["invoice"]
        invoice.status = "paid"
        db_session.commit()
        
        # Run reconciliation
        result = reconcile_payments(db_session, start_date=date.today(), end_date=date.today())
        
        # Should find discrepancy
        assert result["statistics"]["total_discrepancies"] > 0
        assert result["status"] == "discrepancies_found"
        
        # Check for specific discrepancy type
        missing_payment = [
            d for d in result["discrepancies"]
            if d["type"] == "missing_payment_record"
        ]
        assert len(missing_payment) > 0

    def test_detect_payment_without_invoice_update(self, db_session, test_data):
        """Should detect successful payment where invoice is not marked paid."""
        invoice = test_data["invoice"]
        
        # Create successful payment but don't update invoice status
        payment = Payment(
            invoice_id=invoice.id,
            payment_reference=f"PAY-{uuid.uuid4().hex[:8].upper()}",
            amount=invoice.total_amount,
            payment_method="card",
            status="paid",
            payment_date=datetime.now()
        )
        db_session.add(payment)
        invoice.status = "unpaid"  # Keep as unpaid
        db_session.commit()
        
        # Run reconciliation
        result = reconcile_payments(db_session, start_date=date.today(), end_date=date.today())
        
        # Should find discrepancy
        assert result["statistics"]["total_discrepancies"] > 0
        
        # Check for mismatch
        mismatches = [
            d for d in result["discrepancies"]
            if d["type"] == "payment_invoice_status_mismatch"
        ]
        assert len(mismatches) > 0

    def test_detect_amount_mismatch(self, db_session, test_data):
        """Should detect when payment amount doesn't match invoice amount."""
        invoice = test_data["invoice"]
        
        # Create payment with different amount
        payment = Payment(
            invoice_id=invoice.id,
            payment_reference=f"PAY-{uuid.uuid4().hex[:8].upper()}",
            amount=invoice.total_amount + 50.0,  # Wrong amount
            payment_method="card",
            status="paid",
            payment_date=datetime.now()
        )
        db_session.add(payment)
        invoice.status = "paid"
        db_session.commit()
        
        # Run reconciliation
        result = reconcile_payments(db_session, start_date=date.today(), end_date=date.today())
        
        # Should find amount mismatch
        amount_mismatches = [
            d for d in result["discrepancies"]
            if d["type"] == "amount_mismatch"
        ]
        assert len(amount_mismatches) > 0

    def test_clean_reconciliation(self, db_session, test_data):
        """Should return clean status when no discrepancies exist."""
        invoice = test_data["invoice"]
        
        # Create proper payment and update invoice
        payment = Payment(
            invoice_id=invoice.id,
            payment_reference=f"PAY-{uuid.uuid4().hex[:8].upper()}",
            amount=invoice.total_amount,
            payment_method="card",
            status="paid",
            payment_date=datetime.now()
        )
        db_session.add(payment)
        invoice.status = "paid"
        db_session.commit()
        
        # Run reconciliation
        result = reconcile_payments(db_session, start_date=date.today(), end_date=date.today())
        
        # Should be clean
        assert result["status"] == "clean"
        assert result["statistics"]["total_discrepancies"] == 0


class TestPaymentStatistics:
    """Test payment summary statistics."""

    def test_payment_summary_by_status(self, db_session, test_data):
        """Should correctly summarize payments by status."""
        invoice = test_data["invoice"]
        
        # Create payments with different statuses
        for status in ["paid", "failed", "pending"]:
            payment = Payment(
                invoice_id=invoice.id,
                payment_reference=f"PAY-{status}-{uuid.uuid4().hex[:4].upper()}",
                amount=100.0,
                payment_method="card",
                status=status,
                payment_date=datetime.now() if status == "paid" else None
            )
            db_session.add(payment)
        db_session.commit()
        
        # Get summary
        summary = get_payment_summary(db_session, days=1)
        
        assert "by_status" in summary
        assert "paid" in summary["by_status"]
        assert "failed" in summary["by_status"]
        assert summary["by_status"]["paid"]["count"] >= 1
        assert summary["by_status"]["failed"]["count"] >= 1

    def test_success_rate_calculation(self, db_session, test_data):
        """Should correctly calculate payment success rate."""
        invoice = test_data["invoice"]
        
        # Create 3 successful and 1 failed payment
        for i in range(3):
            payment = Payment(
                invoice_id=invoice.id,
                payment_reference=f"PAY-SUCCESS-{i}-{uuid.uuid4().hex[:4].upper()}",
                amount=100.0,
                payment_method="card",
                status="paid",
                payment_date=datetime.now()
            )
            db_session.add(payment)
        
        failed_payment = Payment(
            invoice_id=invoice.id,
            payment_reference=f"PAY-FAILED-{uuid.uuid4().hex[:4].upper()}",
            amount=100.0,
            payment_method="card",
            status="failed"
        )
        db_session.add(failed_payment)
        db_session.commit()
        
        # Get summary
        summary = get_payment_summary(db_session, days=1)
        
        # Success rate should be 75% (3 out of 4)
        assert summary["success_rate"] == 75.0
        assert summary["total_attempts"] >= 4
