"""
Test suite for resource ownership authorization.

Tests cover:
- Customer can access only their own invoices, payments, subscriptions
- Customer cannot access other customers' resources
- Admin can access all resources
- Proper error codes (403 vs 404)
"""

import pytest
from app.models.customer import Customer
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.invoice import Invoice
from app.models.payment import Payment


@pytest.fixture
def user1_data():
    """First test user (regular user)."""
    return {
        "full_name": "User One",
        "email": "user1@example.com",
        "password": "password123",
        "role": "user",
    }


@pytest.fixture
def user2_data():
    """Second test user (regular user)."""
    return {
        "full_name": "User Two",
        "email": "user2@example.com",
        "password": "password123",
        "role": "user",
    }


@pytest.fixture
def admin_data():
    """Admin user."""
    return {
        "full_name": "Admin User",
        "email": "admin@example.com",
        "password": "adminpass123",
        "role": "admin",
    }


@pytest.fixture
def user1_token(client, user1_data):
    """Create user1 and return auth token."""
    client.post("/signup", json=user1_data)
    response = client.post("/login", json={
        "email": user1_data["email"],
        "password": user1_data["password"]
    })
    return response.json()["access_token"]


@pytest.fixture
def user2_token(client, user2_data):
    """Create user2 and return auth token."""
    client.post("/signup", json=user2_data)
    response = client.post("/login", json={
        "email": user2_data["email"],
        "password": user2_data["password"]
    })
    return response.json()["access_token"]


@pytest.fixture
def admin_token(client, admin_data):
    """Create admin and return auth token."""
    client.post("/signup", json=admin_data)
    response = client.post("/login", json={
        "email": admin_data["email"],
        "password": admin_data["password"]
    })
    return response.json()["access_token"]


class TestInvoiceAuthorization:
    """Test invoice resource authorization."""

    def test_user_can_access_own_invoices(self, client, user1_token, user1_data):
        """User should be able to list their own invoices."""
        response = client.get(
            f"/invoices/?customer_email={user1_data['email']}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        # Should succeed (200) - user accessing own resources
        assert response.status_code == 200

    def test_user_cannot_access_other_user_invoices(self, client, user1_token, user2_data):
        """User should not be able to access another user's invoices."""
        response = client.get(
            f"/invoices/?customer_email={user2_data['email']}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        # Should be forbidden
        assert response.status_code == 403
        assert ("authorized" in response.json()["detail"].lower() or
                "own resources" in response.json()["detail"].lower())

    def test_admin_can_access_any_user_invoices(self, client, admin_token, user1_data):
        """Admin should be able to access any user's invoices."""
        response = client.get(
            f"/invoices/?customer_email={user1_data['email']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Should succeed - admin has access to all resources
        assert response.status_code == 200

    def test_admin_can_list_all_invoices(self, client, admin_token):
        """Admin should be able to list all invoices without filtering."""
        response = client.get(
            "/invoices/",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Should succeed
        assert response.status_code == 200


class TestPaymentAuthorization:
    """Test payment resource authorization."""

    def test_user_can_access_own_payments(self, client, user1_token, user1_data):
        """User should be able to list their own payments."""
        response = client.get(
            f"/payments/?customer_email={user1_data['email']}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        assert response.status_code == 200

    def test_user_cannot_access_other_user_payments(self, client, user1_token, user2_data):
        """User should not be able to access another user's payments."""
        response = client.get(
            f"/payments/?customer_email={user2_data['email']}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        assert response.status_code == 403
        assert ("authorized" in response.json()["detail"].lower() or
                "own resources" in response.json()["detail"].lower())

    def test_admin_can_access_any_user_payments(self, client, admin_token, user1_data):
        """Admin should be able to access any user's payments."""
        response = client.get(
            f"/payments/?customer_email={user1_data['email']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200


class TestSubscriptionAuthorization:
    """Test subscription resource authorization."""

    def test_user_can_access_own_subscriptions(self, client, user1_token, user1_data):
        """User should be able to list their own subscriptions."""
        response = client.get(
            f"/subscriptions/?customer_email={user1_data['email']}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        assert response.status_code == 200

    def test_user_cannot_access_other_user_subscriptions(self, client, user1_token, user2_data):
        """User should not be able to access another user's subscriptions."""
        response = client.get(
            f"/subscriptions/?customer_email={user2_data['email']}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        assert response.status_code == 403

    def test_admin_can_access_any_user_subscriptions(self, client, admin_token, user1_data):
        """Admin should be able to access any user's subscriptions."""
        response = client.get(
            f"/subscriptions/?customer_email={user1_data['email']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200


class TestWalletAuthorization:
    """Test wallet resource authorization."""

    def test_user_can_access_own_wallet(self, client, user1_token, user1_data):
        """User should be able to access their own wallet balance."""
        response = client.get(
            f"/subscriptions/wallet/{user1_data['email']}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        # May be 404 if no customer record yet, but not 403
        assert response.status_code in [200, 404]
        if response.status_code == 403:
            pytest.fail("User should be able to access own wallet")

    def test_user_cannot_access_other_user_wallet(self, client, user1_token, user2_data):
        """User should not be able to access another user's wallet."""
        response = client.get(
            f"/subscriptions/wallet/{user2_data['email']}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        assert response.status_code == 403

    def test_admin_can_access_any_user_wallet(self, client, admin_token, user1_data):
        """Admin should be able to access any user's wallet."""
        response = client.get(
            f"/subscriptions/wallet/{user1_data['email']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # May be 404 if no customer, but not 403
        assert response.status_code in [200, 404]
        if response.status_code == 403:
            pytest.fail("Admin should be able to access any wallet")


class TestRefundAuthorization:
    """Test refund resource authorization."""

    def test_user_can_access_own_refunds(self, client, user1_token, user1_data):
        """User should be able to list their own refunds."""
        response = client.get(
            f"/refunds?customer_email={user1_data['email']}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        assert response.status_code == 200

    def test_user_cannot_access_other_user_refunds(self, client, user1_token, user2_data):
        """User should not be able to access another user's refunds."""
        response = client.get(
            f"/refunds?customer_email={user2_data['email']}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        assert response.status_code == 403

    def test_admin_can_access_any_user_refunds(self, client, admin_token, user1_data):
        """Admin should be able to access any user's refunds."""
        response = client.get(
            f"/refunds?customer_email={user1_data['email']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200


class TestDefaultBehavior:
    """Test default behavior when no customer_email is provided."""

    def test_regular_user_gets_own_resources_by_default(self, client, user1_token, user1_data):
        """Regular user without customer_email filter should see only their resources."""
        # This will depend on implementation - endpoint should default to user's own email
        response = client.get(
            "/invoices/",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        # Should succeed and show only user's own invoices
        assert response.status_code == 200

    def test_admin_gets_all_resources_by_default(self, client, admin_token):
        """Admin without customer_email filter should see all resources."""
        response = client.get(
            "/invoices/",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Should succeed and show all invoices
        assert response.status_code == 200


class TestCaseInsensitiveEmail:
    """Test that email matching is case-insensitive."""

    def test_email_case_insensitive_authorization(self, client, user1_token, user1_data):
        """Authorization should work regardless of email casing."""
        # Try with uppercase email
        response = client.get(
            f"/invoices/?customer_email={user1_data['email'].upper()}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        # Should succeed - case-insensitive matching
        assert response.status_code == 200
