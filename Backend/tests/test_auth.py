"""
Test suite for JWT authentication and authorization.

Tests cover:
- Valid token creation and validation
- Invalid token rejection
- Expired token handling
- Inactive user blocking
- Unauthorized access attempts
"""

import pytest
import time
from datetime import datetime, timedelta
from jose import jwt

from app.core.config import SECRET_KEY, ALGORITHM
from app.core.security import create_access_token, verify_access_token
from app.models.user import User


class TestTokenCreation:
    """Test JWT token creation."""

    def test_create_token_with_sub_claim(self):
        """Token should be created with 'sub' claim containing email."""
        email = "test@example.com"
        token = create_access_token({"sub": email})
        
        assert token is not None
        assert isinstance(token, str)
        
        # Decode and verify
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == email
        assert "exp" in payload

    def test_token_expiration_set_correctly(self):
        """Token should have appropriate expiration time set."""
        # Create token with explicit expiration
        expires_min = 30
        token = create_access_token({"sub": "test@example.com"}, expires_minutes=expires_min)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Verify exp claim exists and is in the future
        assert "exp" in payload
        assert payload["exp"] > datetime.utcnow().timestamp()
        
        # Token should be decodable (validates structure)
        assert payload["sub"] == "test@example.com"

    def test_verify_valid_token(self):
        """Valid token should be verified successfully."""
        email = "valid@example.com"
        token = create_access_token({"sub": email})
        
        payload = verify_access_token(token)
        assert payload["sub"] == email


class TestAuthentication:
    """Test authentication flows."""

    def test_signup_creates_user(self, client, test_user_data):
        """User signup should create account and store hashed password."""
        response = client.post("/signup", json=test_user_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "User created successfully"

    def test_login_with_valid_credentials(self, client, test_user_data):
        """Login with correct credentials should return valid token."""
        # First create user
        client.post("/signup", json=test_user_data)
        
        # Then login
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        response = client.post("/login", json=login_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check token structure
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        
        # Check user data
        assert data["user"]["email"] == test_user_data["email"]
        assert data["user"]["full_name"] == test_user_data["full_name"]
        assert data["user"]["role"] == test_user_data["role"]
        
        # Verify token contains correct email in 'sub' claim
        payload = jwt.decode(data["access_token"], SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == test_user_data["email"]

    def test_login_with_invalid_email(self, client):
        """Login with non-existent email should fail."""
        login_data = {
            "email": "nonexistent@example.com",
            "password": "anypassword"
        }
        response = client.post("/login", json=login_data)
        
        assert response.status_code == 401
        assert "Invalid email" in response.json()["detail"]

    def test_login_with_invalid_password(self, client, test_user_data):
        """Login with wrong password should fail."""
        # Create user
        client.post("/signup", json=test_user_data)
        
        # Try wrong password
        login_data = {
            "email": test_user_data["email"],
            "password": "wrongpassword"
        }
        response = client.post("/login", json=login_data)
        
        assert response.status_code == 401
        assert "Invalid password" in response.json()["detail"]

    def test_email_case_insensitive_login(self, client, test_user_data):
        """Login should work with different email casing."""
        # Create user
        client.post("/signup", json=test_user_data)
        
        # Login with uppercase email
        login_data = {
            "email": test_user_data["email"].upper(),
            "password": test_user_data["password"]
        }
        response = client.post("/login", json=login_data)
        
        assert response.status_code == 200


class TestProtectedEndpoints:
    """Test access to protected endpoints."""

    def test_access_protected_endpoint_without_token(self, client):
        """Request without token should be rejected."""
        response = client.get("/customers/")
        
        assert response.status_code == 401
        assert "Not authenticated" in response.json()["detail"]

    def test_access_protected_endpoint_with_valid_token(self, client, test_user_data):
        """Request with valid token should succeed."""
        # Create user and login
        client.post("/signup", json=test_user_data)
        login_response = client.post("/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        token = login_response.json()["access_token"]
        
        # Access protected endpoint
        response = client.get(
            "/customers/",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Should succeed (200) or return empty results, not 401
        assert response.status_code == 200

    def test_access_with_invalid_token(self, client):
        """Request with invalid token should be rejected."""
        response = client.get(
            "/customers/",
            headers={"Authorization": "Bearer invalid_token_here"}
        )
        
        assert response.status_code == 401
        assert "Invalid or expired token" in response.json()["detail"]

    def test_access_with_malformed_token(self, client):
        """Request with malformed token should be rejected."""
        # Create token with wrong structure
        bad_token = jwt.encode({"user_id": 123}, SECRET_KEY, algorithm=ALGORITHM)
        
        response = client.get(
            "/customers/",
            headers={"Authorization": f"Bearer {bad_token}"}
        )
        
        assert response.status_code == 401
        assert "Invalid token" in response.json()["detail"]


class TestExpiredTokens:
    """Test expired token handling."""

    def test_expired_token_rejected(self, client, test_user_data):
        """Expired token should be rejected."""
        # Create user
        client.post("/signup", json=test_user_data)
        
        # Create an already-expired token (expired 1 hour ago)
        expired_token = create_access_token(
            {"sub": test_user_data["email"]},
            expires_minutes=-60  # Negative = past
        )
        
        # Try to use expired token
        response = client.get(
            "/customers/",
            headers={"Authorization": f"Bearer {expired_token}"}
        )
        
        assert response.status_code == 401
        assert "expired" in response.json()["detail"].lower()


class TestInactiveUsers:
    """Test inactive user account blocking."""

    def test_inactive_user_cannot_authenticate(self, client, test_user_data, db_session):
        """User with inactive status should be blocked."""
        # Create user
        client.post("/signup", json=test_user_data)
        
        # Set user status to inactive
        user = db_session.query(User).filter(
            User.email == test_user_data["email"]
        ).first()
        user.status = "Inactive"
        db_session.commit()
        
        # Get a valid token (simulating token from before deactivation)
        token = create_access_token({"sub": test_user_data["email"]})
        
        # Try to access protected endpoint
        response = client.get(
            "/customers/",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403
        assert "inactive" in response.json()["detail"].lower()

    def test_inactive_user_lowercase_status(self, client, test_user_data, db_session):
        """Inactive status check should be case-insensitive."""
        # Create user
        client.post("/signup", json=test_user_data)
        
        # Set user status to lowercase "inactive"
        user = db_session.query(User).filter(
            User.email == test_user_data["email"]
        ).first()
        user.status = "inactive"  # lowercase
        db_session.commit()
        
        # Get a valid token
        token = create_access_token({"sub": test_user_data["email"]})
        
        # Try to access protected endpoint
        response = client.get(
            "/customers/",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403


class TestRoleBasedAccess:
    """Test role-based access control."""

    def test_admin_role_preserved(self, client, test_admin_data):
        """Admin role should be preserved through authentication."""
        # Create admin user
        client.post("/signup", json=test_admin_data)
        
        # Login
        login_response = client.post("/login", json={
            "email": test_admin_data["email"],
            "password": test_admin_data["password"]
        })
        
        data = login_response.json()
        assert data["user"]["role"] == "admin"

    def test_regular_user_role(self, client, test_user_data):
        """Regular user role should be preserved."""
        # Create regular user
        client.post("/signup", json=test_user_data)
        
        # Login
        login_response = client.post("/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        
        data = login_response.json()
        assert data["user"]["role"] == "user"


class TestTokenValidation:
    """Test token validation edge cases."""

    def test_token_without_sub_claim(self, client):
        """Token without 'sub' claim should be rejected."""
        # Create token with wrong claim name
        bad_token = jwt.encode(
            {"email": "test@example.com", "exp": datetime.utcnow() + timedelta(hours=1)},
            SECRET_KEY,
            algorithm=ALGORITHM
        )
        
        response = client.get(
            "/customers/",
            headers={"Authorization": f"Bearer {bad_token}"}
        )
        
        assert response.status_code == 401
        assert "missing subject claim" in response.json()["detail"].lower()

    def test_token_with_nonexistent_user(self, client):
        """Token for non-existent user should be rejected."""
        # Create token for user that doesn't exist
        token = create_access_token({"sub": "nonexistent@example.com"})
        
        response = client.get(
            "/customers/",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 401
        assert "User not found" in response.json()["detail"]
