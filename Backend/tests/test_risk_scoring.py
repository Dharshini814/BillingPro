"""
Test suite for risk scoring and payment intelligence.

Tests cover:
- Risk score calculation logic
- Individual risk factors
- Boundary conditions
- Missing/insufficient data handling
- Risk categories
- Recommendations generation
"""

import pytest
import uuid
from datetime import date, datetime, timedelta
from app.models.customer import Customer
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.payment_retry import PaymentRetry
from app.services.risk_scoring import (
    calculate_risk_score,
    RiskConfig,
    _calculate_consecutive_failures,
    _calculate_exhausted_retries,
    _calculate_overdue_duration,
    _calculate_failure_frequency,
    _calculate_success_rate
)


@pytest.fixture
def test_customer(db_session):
    """Create a test customer."""
    customer = Customer(
        name="Risk Test Customer",
        email=f"risk_{uuid.uuid4().hex[:8]}@example.com",
        country="India",
        currency="INR",
        status="Active"
    )
    db_session.add(customer)
    db_session.commit()
    return customer


@pytest.fixture
def test_plan(db_session):
    """Create a test plan."""
    plan = Plan(
        name=f"Test Plan {uuid.uuid4().hex[:6]}",
        description="Test plan for risk scoring",
        price=100.0,
        billing_cycle="monthly"
    )
    db_session.add(plan)
    db_session.commit()
    return plan


@pytest.fixture
def test_invoice(db_session, test_customer):
    """Create a test invoice."""
    invoice = Invoice(
        invoice_number=f"INV-RISK-{uuid.uuid4().hex[:8].upper()}",
        customer_id=test_customer.id,
        invoice_date=date.today() - timedelta(days=10),
        due_date=date.today() - timedelta(days=3),  # 3 days overdue
        subtotal=100.0,
        tax_amount=18.0,
        total_amount=118.0,
        status="unpaid"
    )
    db_session.add(invoice)
    db_session.commit()
    return invoice


class TestRiskScoreCalculation:
    """Test main risk score calculation function."""
    
    def test_calculate_risk_for_customer_with_no_data(self, db_session, test_customer):
        """Customer with no payment history should have low risk."""
        result = calculate_risk_score(db_session, customer_id=test_customer.id)
        
        assert result.score >= 0
        assert result.score <= 100
        assert result.category == "low"
        assert result.data_quality in ["insufficient", "limited"]
        assert "No payment history" in str(result.evidence)
    
    def test_calculate_risk_requires_identifier(self, db_session):
        """Should raise ValueError if no identifier provided."""
        with pytest.raises(ValueError, match="Must provide"):
            calculate_risk_score(db_session)
    
    def test_calculate_risk_with_nonexistent_customer(self, db_session):
        """Should raise ValueError for nonexistent customer."""
        with pytest.raises(ValueError, match="not found"):
            calculate_risk_score(db_session, customer_id=999999)
    
    def test_calculate_risk_for_invoice(self, db_session, test_invoice):
        """Should calculate risk from invoice ID."""
        result = calculate_risk_score(db_session, invoice_id=test_invoice.id)
        
        assert result.score >= 0
        assert result.evidence["overdue_days"] == 3  # Invoice is 3 days overdue
    
    def test_calculate_risk_for_payment(self, db_session, test_invoice, test_customer):
        """Should calculate risk from payment ID."""
        payment = Payment(
            invoice_id=test_invoice.id,
            payment_reference=f"PAY-{uuid.uuid4().hex[:8].upper()}",
            amount=118.0,
            payment_method="card",
            status="failed"
        )
        db_session.add(payment)
        db_session.commit()
        
        result = calculate_risk_score(db_session, payment_id=payment.id)
        
        assert result.score >= 0
        assert result.category in ["low", "medium", "high"]


class TestConsecutiveFailures:
    """Test consecutive failure detection and scoring."""
    
    def test_no_consecutive_failures(self, db_session, test_customer, test_invoice):
        """Customer with successful payment should have 0 consecutive failures."""
        payment = Payment(
            invoice_id=test_invoice.id,
            payment_reference="PAY-SUCCESS",
            amount=100.0,
            payment_method="card",
            status="paid"
        )
        db_session.add(payment)
        db_session.commit()
        
        consecutive, details = _calculate_consecutive_failures(db_session, test_customer.id)
        
        assert consecutive == 0
        assert details["most_recent_status"] == "paid"
    
    def test_multiple_consecutive_failures(self, db_session, test_customer):
        """Should count consecutive failures correctly."""
        # Create 3 invoices with failed payments
        for i in range(3):
            invoice = Invoice(
                invoice_number=f"INV-FAIL-{i}",
                customer_id=test_customer.id,
                invoice_date=date.today() - timedelta(days=i),
                due_date=date.today(),
                subtotal=100.0,
                tax_amount=0,
                total_amount=100.0,
                status="unpaid"
            )
            db_session.add(invoice)
            db_session.flush()
            
            payment = Payment(
                invoice_id=invoice.id,
                payment_reference=f"PAY-FAIL-{i}",
                amount=100.0,
                payment_method="card",
                status="failed",
                created_at=datetime.now() - timedelta(days=i)
            )
            db_session.add(payment)
        
        db_session.commit()
        
        consecutive, details = _calculate_consecutive_failures(db_session, test_customer.id)
        
        assert consecutive == 3
        assert details["count"] == 3
    
    def test_consecutive_failures_stops_at_success(self, db_session, test_customer):
        """Should stop counting at first success."""
        # Create failed payment
        invoice1 = Invoice(
            invoice_number="INV-FAIL",
            customer_id=test_customer.id,
            invoice_date=date.today(),
            due_date=date.today(),
            subtotal=100.0,
            tax_amount=0,
            total_amount=100.0,
            status="unpaid"
        )
        db_session.add(invoice1)
        db_session.flush()
        
        payment1 = Payment(
            invoice_id=invoice1.id,
            payment_reference="PAY-FAIL",
            amount=100.0,
            payment_method="card",
            status="failed",
            created_at=datetime.now() - timedelta(days=1)
        )
        db_session.add(payment1)
        
        # Create successful payment (older)
        invoice2 = Invoice(
            invoice_number="INV-SUCCESS",
            customer_id=test_customer.id,
            invoice_date=date.today() - timedelta(days=2),
            due_date=date.today(),
            subtotal=100.0,
            tax_amount=0,
            total_amount=100.0,
            status="paid"
        )
        db_session.add(invoice2)
        db_session.flush()
        
        payment2 = Payment(
            invoice_id=invoice2.id,
            payment_reference="PAY-SUCCESS",
            amount=100.0,
            payment_method="card",
            status="paid",
            created_at=datetime.now() - timedelta(days=2)
        )
        db_session.add(payment2)
        
        db_session.commit()
        
        consecutive, _ = _calculate_consecutive_failures(db_session, test_customer.id)
        
        assert consecutive == 1  # Only count the most recent failure


class TestRetryExhaustion:
    """Test retry exhaustion detection."""
    
    def test_no_retries(self, db_session, test_customer):
        """Customer with no retries should return 0."""
        exhausted, details = _calculate_exhausted_retries(db_session, test_customer.id)
        
        assert exhausted == 0
        assert "No invoices found" in details["message"]
    
    def test_exhausted_retries(self, db_session, test_customer, test_invoice):
        """Should detect fully exhausted retry sequences."""
        payment = Payment(
            invoice_id=test_invoice.id,
            payment_reference="PAY-EXHAUSTED",
            amount=100.0,
            payment_method="card",
            status="failed"
        )
        db_session.add(payment)
        db_session.flush()
        
        # Create 3 failed retries
        for attempt in [1, 2, 3]:
            retry = PaymentRetry(
                payment_id=payment.id,
                invoice_id=test_invoice.id,
                attempt_number=attempt,
                scheduled_date=date.today() + timedelta(days=attempt),
                status="failed",
                attempted_at=datetime.now()
            )
            db_session.add(retry)
        
        db_session.commit()
        
        exhausted, details = _calculate_exhausted_retries(db_session, test_customer.id)
        
        assert exhausted == 1
        assert test_invoice.id in details["exhausted_invoice_ids"]
    
    def test_pending_retries_not_exhausted(self, db_session, test_customer, test_invoice):
        """Pending retries should not count as exhausted."""
        payment = Payment(
            invoice_id=test_invoice.id,
            payment_reference="PAY-PENDING",
            amount=100.0,
            payment_method="card",
            status="failed"
        )
        db_session.add(payment)
        db_session.flush()
        
        # One failed, one pending
        retry1 = PaymentRetry(
            payment_id=payment.id,
            invoice_id=test_invoice.id,
            attempt_number=1,
            scheduled_date=date.today(),
            status="failed"
        )
        retry2 = PaymentRetry(
            payment_id=payment.id,
            invoice_id=test_invoice.id,
            attempt_number=2,
            scheduled_date=date.today() + timedelta(days=1),
            status="pending"
        )
        db_session.add(retry1)
        db_session.add(retry2)
        db_session.commit()
        
        exhausted, _ = _calculate_exhausted_retries(db_session, test_customer.id)
        
        assert exhausted == 0


class TestOverdueDuration:
    """Test overdue invoice duration calculation."""
    
    def test_no_overdue_invoices(self, db_session, test_customer):
        """Customer with no overdue invoices."""
        invoice = Invoice(
            invoice_number="INV-CURRENT",
            customer_id=test_customer.id,
            invoice_date=date.today(),
            due_date=date.today() + timedelta(days=30),  # Future due date
            subtotal=100.0,
            tax_amount=0,
            total_amount=100.0,
            status="unpaid"
        )
        db_session.add(invoice)
        db_session.commit()
        
        overdue_days, details = _calculate_overdue_duration(db_session, test_customer.id)
        
        assert overdue_days == 0
        assert "No overdue invoices" in details["message"]
    
    def test_overdue_invoice(self, db_session, test_customer):
        """Should calculate correct overdue days."""
        invoice = Invoice(
            invoice_number="INV-OVERDUE",
            customer_id=test_customer.id,
            invoice_date=date.today() - timedelta(days=45),
            due_date=date.today() - timedelta(days=15),  # 15 days overdue
            subtotal=100.0,
            tax_amount=0,
            total_amount=100.0,
            status="unpaid"
        )
        db_session.add(invoice)
        db_session.commit()
        
        overdue_days, details = _calculate_overdue_duration(db_session, test_customer.id)
        
        assert overdue_days == 15
        assert details["max_overdue_days"] == 15
        assert details["overdue_invoice_count"] == 1
    
    def test_multiple_overdue_returns_max(self, db_session, test_customer):
        """Should return maximum overdue duration."""
        # 10 days overdue
        invoice1 = Invoice(
            invoice_number="INV-OVERDUE-1",
            customer_id=test_customer.id,
            invoice_date=date.today() - timedelta(days=20),
            due_date=date.today() - timedelta(days=10),
            subtotal=100.0,
            tax_amount=0,
            total_amount=100.0,
            status="unpaid"
        )
        # 30 days overdue (max)
        invoice2 = Invoice(
            invoice_number="INV-OVERDUE-2",
            customer_id=test_customer.id,
            invoice_date=date.today() - timedelta(days=40),
            due_date=date.today() - timedelta(days=30),
            subtotal=100.0,
            tax_amount=0,
            total_amount=100.0,
            status="unpaid"
        )
        db_session.add(invoice1)
        db_session.add(invoice2)
        db_session.commit()
        
        overdue_days, details = _calculate_overdue_duration(db_session, test_customer.id)
        
        assert overdue_days == 30
        assert details["overdue_invoice_count"] == 2


class TestFailureFrequency:
    """Test failure frequency calculation."""
    
    def test_no_failures_in_window(self, db_session, test_customer, test_invoice):
        """No failures in time window."""
        # Create old successful payment (outside window)
        payment = Payment(
            invoice_id=test_invoice.id,
            payment_reference="PAY-OLD",
            amount=100.0,
            payment_method="card",
            status="paid",
            created_at=datetime.now() - timedelta(days=60)
        )
        db_session.add(payment)
        db_session.commit()
        
        failure_count, details = _calculate_failure_frequency(db_session, test_customer.id, 30)
        
        assert failure_count == 0
        assert details["window_days"] == 30
    
    def test_failures_within_window(self, db_session, test_customer):
        """Should count failures within time window."""
        # Create 4 failed payments within last 30 days
        for i in range(4):
            invoice = Invoice(
                invoice_number=f"INV-FREQ-{i}",
                customer_id=test_customer.id,
                invoice_date=date.today() - timedelta(days=i),
                due_date=date.today(),
                subtotal=100.0,
                tax_amount=0,
                total_amount=100.0,
                status="unpaid"
            )
            db_session.add(invoice)
            db_session.flush()
            
            payment = Payment(
                invoice_id=invoice.id,
                payment_reference=f"PAY-FREQ-{i}",
                amount=100.0,
                payment_method="card",
                status="failed",
                created_at=datetime.now() - timedelta(days=i)
            )
            db_session.add(payment)
        
        db_session.commit()
        
        failure_count, details = _calculate_failure_frequency(db_session, test_customer.id, 30)
        
        assert failure_count == 4
        assert details["failure_count"] == 4


class TestSuccessRate:
    """Test payment success rate calculation."""
    
    def test_no_payment_history(self, db_session, test_customer):
        """No payment history should return 100% with insufficient data flag."""
        rate, details = _calculate_success_rate(db_session, test_customer.id)
        
        assert rate == 100.0
        assert details.get("insufficient_data") is True
    
    def test_100_percent_success_rate(self, db_session, test_customer):
        """All successful payments should return 100%."""
        # Create 5 successful payments
        for i in range(5):
            invoice = Invoice(
                invoice_number=f"INV-SUCCESS-{i}",
                customer_id=test_customer.id,
                invoice_date=date.today() - timedelta(days=i),
                due_date=date.today(),
                subtotal=100.0,
                tax_amount=0,
                total_amount=100.0,
                status="paid"
            )
            db_session.add(invoice)
            db_session.flush()
            
            payment = Payment(
                invoice_id=invoice.id,
                payment_reference=f"PAY-SUCCESS-{i}",
                amount=100.0,
                payment_method="card",
                status="paid"
            )
            db_session.add(payment)
        
        db_session.commit()
        
        rate, details = _calculate_success_rate(db_session, test_customer.id)
        
        assert rate == 100.0
        assert details["successful_payments"] == 5
        assert details["total_payments"] == 5
        assert details["sufficient_data"] is True
    
    def test_50_percent_success_rate(self, db_session, test_customer):
        """50/50 success/failure should return 50%."""
        for i in range(10):
            invoice = Invoice(
                invoice_number=f"INV-MIX-{i}",
                customer_id=test_customer.id,
                invoice_date=date.today() - timedelta(days=i),
                due_date=date.today(),
                subtotal=100.0,
                tax_amount=0,
                total_amount=100.0,
                status="paid" if i % 2 == 0 else "unpaid"
            )
            db_session.add(invoice)
            db_session.flush()
            
            payment = Payment(
                invoice_id=invoice.id,
                payment_reference=f"PAY-MIX-{i}",
                amount=100.0,
                payment_method="card",
                status="paid" if i % 2 == 0 else "failed"
            )
            db_session.add(payment)
        
        db_session.commit()
        
        rate, details = _calculate_success_rate(db_session, test_customer.id)
        
        assert rate == 50.0
        assert details["successful_payments"] == 5
        assert details["failed_payments"] == 5


class TestRiskCategories:
    """Test risk category assignment."""
    
    def test_low_risk_category(self, db_session, test_customer, test_invoice):
        """Customer with good payment history should be low risk."""
        # Create successful payment
        payment = Payment(
            invoice_id=test_invoice.id,
            payment_reference="PAY-GOOD",
            amount=100.0,
            payment_method="card",
            status="paid"
        )
        db_session.add(payment)
        db_session.commit()
        
        # Update invoice to not be overdue
        test_invoice.due_date = date.today() + timedelta(days=30)
        test_invoice.status = "paid"
        db_session.commit()
        
        result = calculate_risk_score(db_session, customer_id=test_customer.id)
        
        assert result.category == "low"
        assert result.score <= 30
    
    def test_high_risk_category(self, db_session, test_customer):
        """Customer with many failures should be high risk."""
        # Create 5 consecutive failed payments
        for i in range(5):
            invoice = Invoice(
                invoice_number=f"INV-BAD-{i}",
                customer_id=test_customer.id,
                invoice_date=date.today() - timedelta(days=10 + i),
                due_date=date.today() - timedelta(days=i),  # All overdue
                subtotal=100.0,
                tax_amount=0,
                total_amount=100.0,
                status="unpaid"
            )
            db_session.add(invoice)
            db_session.flush()
            
            payment = Payment(
                invoice_id=invoice.id,
                payment_reference=f"PAY-BAD-{i}",
                amount=100.0,
                payment_method="card",
                status="failed",
                created_at=datetime.now() - timedelta(days=i)
            )
            db_session.add(payment)
            db_session.flush()  # Ensure payment.id is available
            
            # Add exhausted retries
            for attempt in [1, 2, 3]:
                retry = PaymentRetry(
                    payment_id=payment.id,
                    invoice_id=invoice.id,
                    attempt_number=attempt,
                    scheduled_date=date.today(),
                    status="failed"
                )
                db_session.add(retry)
        
        db_session.commit()
        
        result = calculate_risk_score(db_session, customer_id=test_customer.id)
        
        assert result.category == "high"
        assert result.score > 60


class TestRecommendations:
    """Test recommendation generation."""
    
    def test_low_risk_recommendations(self, db_session, test_customer, test_invoice):
        """Low risk should have positive recommendations."""
        payment = Payment(
            invoice_id=test_invoice.id,
            payment_reference="PAY-GOOD",
            amount=100.0,
            payment_method="card",
            status="paid"
        )
        db_session.add(payment)
        
        test_invoice.status = "paid"
        test_invoice.due_date = date.today() + timedelta(days=30)
        db_session.commit()
        
        result = calculate_risk_score(db_session, customer_id=test_customer.id)
        
        recommendations_str = " ".join(result.recommendations)
        assert "LOW RISK" in recommendations_str or "Normal payment behavior" in recommendations_str
    
    def test_high_risk_recommendations(self, db_session, test_customer):
        """High risk should have actionable recommendations."""
        # Create high-risk scenario
        for i in range(5):
            invoice = Invoice(
                invoice_number=f"INV-HIGHRISK-{i}",
                customer_id=test_customer.id,
                invoice_date=date.today() - timedelta(days=70 + i),
                due_date=date.today() - timedelta(days=65 + i),  # Severely overdue
                subtotal=100.0,
                tax_amount=0,
                total_amount=100.0,
                status="unpaid"
            )
            db_session.add(invoice)
            db_session.flush()
            
            payment = Payment(
                invoice_id=invoice.id,
                payment_reference=f"PAY-HIGHRISK-{i}",
                amount=100.0,
                payment_method="card",
                status="failed",
                created_at=datetime.now() - timedelta(days=i)
            )
            db_session.add(payment)
        
        db_session.commit()
        
        result = calculate_risk_score(db_session, customer_id=test_customer.id)
        
        recommendations_str = " ".join(result.recommendations)
        assert "HIGH RISK" in recommendations_str or "Manual review" in recommendations_str
