"""
Pytest configuration and shared fixtures for BillingPro tests.
"""

import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Set test database before importing app to avoid production DB connection
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
# Disable webhook signature verification in tests (mock gateway mode)
os.environ["WEBHOOK_SECRET"] = ""

from app.database import Base, get_db

# Import FastAPI app without running migrations
# We'll create tables manually in fixtures
from fastapi import FastAPI
from app.api.routes import router as api_router
from app.routers.auth import router as auth_router
from app.routers.customer import router as customer_router
from app.routers.plan import router as plan_router
from app.routers.subscription import router as subscription_router
from app.routers.invoice import router as invoice_router
from app.routers.payment import router as payment_router
from app.routers.retry_refund import router as retry_refund_router
from app.routers.process_payment import router as process_payment_router
from app.routers.reconciliation import router as reconciliation_router
from app.routers.risk_assessment import router as risk_assessment_router
from app.routers.revenue import router as revenue_router


# Use in-memory SQLite database for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with database dependency override."""
    # Create minimal FastAPI app for testing
    test_app = FastAPI(title="BillingPro Test API")
    
    # Add CORS middleware
    from fastapi.middleware.cors import CORSMiddleware
    test_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Register routers
    test_app.include_router(api_router)
    test_app.include_router(auth_router)
    test_app.include_router(customer_router)
    test_app.include_router(plan_router)
    test_app.include_router(subscription_router)
    test_app.include_router(invoice_router)
    test_app.include_router(payment_router)
    test_app.include_router(retry_refund_router)
    test_app.include_router(process_payment_router)
    test_app.include_router(reconciliation_router)
    test_app.include_router(risk_assessment_router)
    test_app.include_router(revenue_router)
    
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    test_app.dependency_overrides[get_db] = override_get_db
    with TestClient(test_app) as test_client:
        yield test_client
    test_app.dependency_overrides.clear()


@pytest.fixture
def test_user_data():
    """Sample user data for testing."""
    return {
        "full_name": "Test User",
        "email": "testuser@example.com",
        "password": "testpassword123",
        "role": "user",
    }


@pytest.fixture
def test_admin_data():
    """Sample admin user data for testing."""
    return {
        "full_name": "Admin User",
        "email": "admin@example.com",
        "password": "adminpassword123",
        "role": "admin",
    }
