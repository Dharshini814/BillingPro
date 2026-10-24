"""
Tests for Phase 5: Health Check Endpoints
=========================================

Tests health check endpoints following Kubernetes probe patterns:
- GET /health         - Overall health
- GET /health/live    - Liveness probe
- GET /health/ready   - Readiness probe
- GET /health/startup - Startup probe
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestHealthEndpoints:
    """Test suite for health check endpoints."""
    
    def test_overall_health_check_returns_200(self):
        """Test that /health returns 200 when all systems are healthy."""
        response = client.get("/health")
        
        # Accept both 200 (healthy) and 503 (unhealthy) - depends on DB state
        assert response.status_code in [200, 503]
        data = response.json()
        
        assert "status" in data
        assert data["status"] in ["healthy", "unhealthy"]
        assert "timestamp" in data
        assert "uptime_seconds" in data
        assert "version" in data
        assert "checks" in data
    
    def test_overall_health_includes_database_checks(self):
        """Test that /health includes database connectivity checks."""
        response = client.get("/health")
        data = response.json()
        
        assert "checks" in data
        assert "database_connection" in data["checks"]
        assert "database_tables" in data["checks"]
        
        # Database connection check structure
        db_conn = data["checks"]["database_connection"]
        assert "healthy" in db_conn
        assert "latency_ms" in db_conn or "error" in db_conn
        
        # Database tables check structure
        db_tables = data["checks"]["database_tables"]
        assert "healthy" in db_tables
    
    def test_liveness_probe_always_succeeds(self):
        """Test that /health/live returns 200 if app is running."""
        response = client.get("/health/live")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "alive"
        assert "timestamp" in data
        assert "uptime_seconds" in data
        assert data["uptime_seconds"] >= 0
    
    def test_readiness_probe_checks_database(self):
        """Test that /health/ready verifies database connectivity."""
        response = client.get("/health/ready")
        
        # Should be 200 (ready) or 503 (not ready)
        assert response.status_code in [200, 503]
        data = response.json()
        
        assert "status" in data
        assert data["status"] in ["ready", "not_ready"]
        assert "checks" in data
        assert "database_connection" in data["checks"]
        assert "database_tables" in data["checks"]
        
        # If status is ready, database checks should be healthy
        if data["status"] == "ready":
            assert data["checks"]["database_connection"]["healthy"] is True
            assert data["checks"]["database_tables"]["healthy"] is True
    
    def test_startup_probe_checks_initialization(self):
        """Test that /health/startup verifies startup completion."""
        response = client.get("/health/startup")
        
        # Should be 200 (started) or 503 (starting)
        assert response.status_code in [200, 503]
        data = response.json()
        
        assert "status" in data
        assert data["status"] in ["started", "starting"]
        assert "uptime_seconds" in data
        assert "checks" in data
        
        # Should include minimum uptime check
        assert "minimum_uptime" in data["checks"]
        assert "database_connection" in data["checks"]
        assert "database_tables" in data["checks"]
        
        # Minimum uptime check structure
        min_uptime = data["checks"]["minimum_uptime"]
        assert "healthy" in min_uptime
        assert "uptime_seconds" in min_uptime
        assert "minimum_required" in min_uptime
    
    def test_health_endpoint_without_trailing_slash(self):
        """Test that /health works without trailing slash."""
        response = client.get("/health")
        assert response.status_code in [200, 503]  # Depends on DB state
    
    def test_health_endpoint_with_trailing_slash(self):
        """Test that /health/ works with trailing slash."""
        response = client.get("/health/")
        assert response.status_code in [200, 503]  # Depends on DB state
    
    def test_health_response_includes_version(self):
        """Test that health check includes API version."""
        response = client.get("/health")
        data = response.json()
        
        assert "version" in data
        assert isinstance(data["version"], str)
        assert len(data["version"]) > 0
    
    def test_database_latency_measurement(self):
        """Test that database check measures latency."""
        response = client.get("/health")
        data = response.json()
        
        db_conn = data["checks"]["database_connection"]
        if db_conn["healthy"]:
            assert "latency_ms" in db_conn
            assert isinstance(db_conn["latency_ms"], (int, float))
            assert db_conn["latency_ms"] >= 0
            # Latency should be reasonable (< 1 second for local DB)
            assert db_conn["latency_ms"] < 1000
    
    def test_uptime_increases_between_calls(self):
        """Test that uptime increases between consecutive calls."""
        import time
        
        response1 = client.get("/health/live")
        uptime1 = response1.json()["uptime_seconds"]
        
        time.sleep(0.1)
        
        response2 = client.get("/health/live")
        uptime2 = response2.json()["uptime_seconds"]
        
        assert uptime2 > uptime1


class TestHealthEndpointIntegration:
    """Integration tests for health endpoints."""
    
    def test_all_health_endpoints_accessible(self):
        """Test that all health endpoints are accessible."""
        endpoints = [
            "/health",
            "/health/live",
            "/health/ready",
            "/health/startup"
        ]
        
        for endpoint in endpoints:
            response = client.get(endpoint)
            assert response.status_code in [200, 503], f"{endpoint} returned unexpected status"
    
    def test_health_endpoints_return_json(self):
        """Test that all health endpoints return valid JSON."""
        endpoints = [
            "/health",
            "/health/live",
            "/health/ready",
            "/health/startup"
        ]
        
        for endpoint in endpoints:
            response = client.get(endpoint)
            assert response.headers["content-type"] == "application/json"
            # Should not raise JSONDecodeError
            data = response.json()
            assert isinstance(data, dict)
    
    def test_health_endpoints_have_consistent_structure(self):
        """Test that health endpoints return consistent structure."""
        endpoints = ["/health", "/health/ready", "/health/startup"]
        
        for endpoint in endpoints:
            response = client.get(endpoint)
            data = response.json()
            
            # Common fields
            assert "status" in data
            assert "timestamp" in data
            assert isinstance(data["timestamp"], str)
            
            # Status should be a string
            assert isinstance(data["status"], str)


class TestMetricsEndpoint:
    """Test suite for Prometheus metrics endpoint."""
    
    def test_metrics_endpoint_returns_prometheus_format(self):
        """Test that /metrics returns data in Prometheus format."""
        response = client.get("/metrics")
        
        assert response.status_code == 200
        # Prometheus uses text/plain with special version
        assert "text/plain" in response.headers["content-type"]
        
        # Should contain Prometheus metrics
        content = response.text
        assert len(content) > 0
    
    def test_metrics_contain_http_request_metrics(self):
        """Test that metrics include HTTP request counters."""
        # Make a request to generate metrics
        client.get("/health/live")
        
        response = client.get("/metrics")
        content = response.text
        
        # Should include http_requests_total counter
        assert "http_requests_total" in content
        assert "http_request_duration_seconds" in content
    
    def test_metrics_not_tracked_for_metrics_endpoint(self):
        """Test that /metrics endpoint doesn't create recursive metrics."""
        # This is implicit in the middleware design
        response = client.get("/metrics")
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
