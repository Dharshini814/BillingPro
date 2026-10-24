"""
Test suite for payment idempotency and webhook deduplication.

Tests cover:
- Idempotency key prevents duplicate payment processing
- Same idempotency key returns identical result
- Webhook event deduplication
- Concurrent payment attempts handling
"""

import pytest
import uuid
from app.models.customer import Customer
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.webhook_event import WebhookEvent


@pytest.fixture
def test_customer(db_session):
    """Create a test customer."""
    # Use unique email to avoid conflicts with signup
    email = f"testcust_{uuid.uuid4().hex[:8]}@example.com"
    customer = Customer(
        name="Test Customer",
        email=email,
        country="India",
        currency="INR",
        status="Active"
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)
    return customer


@pytest.fixture
def test_plan(db_session):
    """Create a test plan."""
    plan = Plan(
        name="Basic Plan",
        price=100.0,
        billing_interval="monthly",
        trial_days=0,
        is_active=True
    )
    db_session.add(plan)
    db_session.commit()
    db_session.refresh(plan)
    return plan


@pytest.fixture
def test_subscription(db_session, test_customer, test_plan):
    """Create a test subscription."""
    from datetime import date, timedelta
    subscription = Subscription(
        customer_id=test_customer.id,
        plan_id=test_plan.id,
        status="active",
        amount=test_plan.price,
        billing_cycle="monthly",
        start_date=date.today(),
        next_billing_date=date.today() + timedelta(days=30)
    )
    db_session.add(subscription)
    db_session.commit()
    db_session.refresh(subscription)
    return subscription


@pytest.fixture
def test_invoice(db_session, test_customer, test_subscription):
    """Create a test unpaid invoice."""
    from datetime import date, timedelta
    invoice = Invoice(
        invoice_number=f"INV-TEST-{uuid.uuid4().hex[:8].upper()}",
        customer_id=test_customer.id,
        subscription_id=test_subscription.id,
        invoice_date=date.today(),
        due_date=date.today() + timedelta(days=7),
        subtotal=100.0,
        tax_amount=18.0,
        total_amount=118.0,
        status="unpaid",
        plan_name="Basic Plan"
    )
    db_session.add(invoice)
    db_session.commit()
    db_session.refresh(invoice)
    return invoice


@pytest.fixture
def user_token(client, test_customer):
    """Create a test user and return auth token."""
    # Use the same email as test_customer for authorization
    user_data = {
        "full_name": "Test User",
        "email": test_customer.email,
        "password": "testpass123",
        "role": "user"
    }
    client.post("/signup", json=user_data)
    response = client.post("/login", json={
        "email": user_data["email"],
        "password": user_data["password"]
    })
    return response.json()["access_token"]


class TestPaymentIdempotency:
    """Test payment idempotency key handling."""

    def test_duplicate_payment_with_same_idempotency_key(self, client, user_token, test_invoice):
        """Duplicate payment requests with same idempotency key should return same result."""
        idempotency_key = f"idem-{uuid.uuid4().hex}"
        payment_data = {
            "invoice_id": test_invoice.id,
            "payment_method": "card",
            "idempotency_key": idempotency_key
        }
        
        # First request
        response1 = client.post(
            "/payments/process",
            json=payment_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response1.status_code == 200
        result1 = response1.json()
        
        # Second request with same idempotency key
        response2 = client.post(
            "/payments/process",
            json=payment_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response2.status_code == 200
        result2 = response2.json()
        
        # Results should be identical
        assert result1["payment_id"] == result2["payment_id"]
        assert result1["payment_reference"] == result2["payment_reference"]
        assert result1["success"] == result2["success"]
        assert result2.get("idempotent") is True
        assert "Duplicate request" in result2["message"]

    def test_different_idempotency_keys_create_different_payments(self, client, user_token, test_invoice, db_session):
        """Different idempotency keys should create separate payment records."""
        key1 = f"idem-{uuid.uuid4().hex}"
        key2 = f"idem-{uuid.uuid4().hex}"
        
        payment_data1 = {
            "invoice_id": test_invoice.id,
            "payment_method": "card",
            "idempotency_key": key1
        }
        
        response1 = client.post(
            "/payments/process",
            json=payment_data1,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response1.status_code == 200
        
        # Reset invoice to unpaid for second attempt
        # (In real scenario, would be a different invoice)
        test_invoice.status = "unpaid"
        db_session.commit()
        
        payment_data2 = {
            "invoice_id": test_invoice.id,
            "payment_method": "upi",
            "idempotency_key": key2
        }
        
        response2 = client.post(
            "/payments/process",
            json=payment_data2,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        # May succeed or fail depending on 50% chance, but should not be duplicate
        result2 = response2.json()
        assert result2.get("idempotent") is not True

    def test_payment_without_idempotency_key(self, client, user_token, test_invoice):
        """Payment without idempotency key should still work."""
        payment_data = {
            "invoice_id": test_invoice.id,
            "payment_method": "card"
            # No idempotency_key
        }
        
        response = client.post(
            "/payments/process",
            json=payment_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        # Should succeed (or fail based on 50% mock), but not error
        assert response.status_code == 200
        result = response.json()
        assert "payment_id" in result

    def test_idempotency_key_stored_in_database(self, client, user_token, test_invoice, db_session):
        """Idempotency key should be stored in payment record."""
        idempotency_key = f"idem-{uuid.uuid4().hex}"
        payment_data = {
            "invoice_id": test_invoice.id,
            "payment_method": "card",
            "idempotency_key": idempotency_key
        }
        
        response = client.post(
            "/payments/process",
            json=payment_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        payment_id = response.json()["payment_id"]
        
        # Verify idempotency key is stored
        payment = db_session.query(Payment).filter(Payment.id == payment_id).first()
        assert payment is not None
        assert payment.idempotency_key == idempotency_key

    def test_idempotency_constraint_prevents_duplicate_keys(self, client, user_token, test_invoice, db_session):
        """Database constraint should prevent duplicate idempotency keys."""
        idempotency_key = f"idem-{uuid.uuid4().hex}"
        
        # First payment
        payment1 = Payment(
            invoice_id=test_invoice.id,
            payment_reference="PAY-TEST1",
            amount=test_invoice.total_amount,
            payment_method="card",
            status="paid",
            idempotency_key=idempotency_key
        )
        db_session.add(payment1)
        db_session.commit()
        
        # Second payment with same key should be returned by API, not created
        payment_data = {
            "invoice_id": test_invoice.id,
            "payment_method": "upi",
            "idempotency_key": idempotency_key
        }
        
        response = client.post(
            "/payments/process",
            json=payment_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        # Should return existing payment, not create new one
        assert response.status_code == 200
        result = response.json()
        assert result["payment_id"] == payment1.id
        assert result.get("idempotent") is True


class TestWebhookDeduplication:
    """Test webhook event deduplication."""

    def test_duplicate_webhook_event_ignored(self, client, test_invoice, db_session):
        """Duplicate webhook events with same event_id should be ignored."""
        event_id = f"evt_{uuid.uuid4().hex}"
        webhook_payload = {
            "event": "payment_success",
            "event_id": event_id,
            "invoice_id": test_invoice.id,
            "source": "test_gateway"
        }
        
        # First webhook
        response1 = client.post("/webhooks/payment", json=webhook_payload)
        assert response1.status_code == 200
        
        # Second webhook with same event_id
        response2 = client.post("/webhooks/payment", json=webhook_payload)
        assert response2.status_code == 200
        result2 = response2.json()
        
        # Should be marked as duplicate
        assert result2.get("duplicate") is True
        assert "already processed" in result2["message"].lower()

    def test_webhook_event_stored_in_database(self, client, test_invoice, db_session):
        """Webhook events should be stored for deduplication."""
        event_id = f"evt_{uuid.uuid4().hex}"
        webhook_payload = {
            "event": "payment_failed",
            "event_id": event_id,
            "invoice_id": test_invoice.id,
            "source": "test_gateway"
        }
        
        response = client.post("/webhooks/payment", json=webhook_payload)
        assert response.status_code == 200
        
        # Verify event is stored
        event = db_session.query(WebhookEvent).filter(
            WebhookEvent.event_id == event_id
        ).first()
        assert event is not None
        assert event.event_type == "payment_failed"
        assert event.status == "processed"

    def test_different_webhook_events_processed_separately(self, client, test_invoice):
        """Different webhook events should be processed separately."""
        event_id1 = f"evt_{uuid.uuid4().hex}"
        event_id2 = f"evt_{uuid.uuid4().hex}"
        
        webhook1 = {
            "event": "payment_success",
            "event_id": event_id1,
            "invoice_id": test_invoice.id
        }
        
        webhook2 = {
            "event": "payment_failed",
            "event_id": event_id2,
            "invoice_id": test_invoice.id
        }
        
        response1 = client.post("/webhooks/payment", json=webhook1)
        response2 = client.post("/webhooks/payment", json=webhook2)
        
        # Both should succeed
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        # Neither should be marked as duplicate
        assert response1.json().get("duplicate") is not True
        assert response2.json().get("duplicate") is not True


class TestConcurrentPayments:
    """Test handling of concurrent payment attempts."""

    def test_no_duplicate_payment_records(self, client, user_token, test_invoice, db_session):
        """Multiple payment attempts should not create duplicate payment records with idempotency."""
        idempotency_key = f"idem-{uuid.uuid4().hex}"
        payment_data = {
            "invoice_id": test_invoice.id,
            "payment_method": "card",
            "idempotency_key": idempotency_key
        }
        
        # Simulate concurrent requests (in practice, these would be truly concurrent)
        response1 = client.post(
            "/payments/process",
            json=payment_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        response2 = client.post(
            "/payments/process",
            json=payment_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        # Both should succeed
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        # Should refer to same payment
        assert response1.json()["payment_id"] == response2.json()["payment_id"]
        
        # Only one payment record should exist with this idempotency key
        payments = db_session.query(Payment).filter(
            Payment.idempotency_key == idempotency_key
        ).all()
        assert len(payments) == 1
