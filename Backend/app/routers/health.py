"""
Phase 5: Operational Monitoring - Health Check Endpoints
=========================================================

Provides standardized health check endpoints following Kubernetes best practices:
- GET /health         - Overall health status
- GET /health/live    - Liveness probe (is the app running?)
- GET /health/ready   - Readiness probe (can it serve traffic?)
- GET /health/startup - Startup probe (has initialization completed?)
"""

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
import time
from datetime import datetime, timezone

from app.database import get_db

router = APIRouter(prefix="/health", tags=["health"])

# Track startup time for uptime calculation
STARTUP_TIME = time.time()


def check_database_connection(db: Session) -> dict:
    """
    Verify database connectivity and response time.
    
    Returns:
        dict: {"healthy": bool, "latency_ms": float, "error": str|None}
    """
    try:
        start = time.time()
        db.execute(text("SELECT 1"))
        latency = (time.time() - start) * 1000
        
        return {
            "healthy": True,
            "latency_ms": round(latency, 2),
            "error": None
        }
    except Exception as e:
        return {
            "healthy": False,
            "latency_ms": None,
            "error": str(e)
        }


def check_database_tables(db: Session) -> dict:
    """
    Verify critical tables exist and are accessible.
    
    Returns:
        dict: {"healthy": bool, "tables_checked": int, "error": str|None}
    """
    critical_tables = [
        "users",
        "customers",
        "plans",
        "subscriptions",
        "invoices",
        "payments"
    ]
    
    try:
        for table in critical_tables:
            db.execute(text(f"SELECT 1 FROM {table} LIMIT 1"))
        
        return {
            "healthy": True,
            "tables_checked": len(critical_tables),
            "error": None
        }
    except Exception as e:
        return {
            "healthy": False,
            "tables_checked": 0,
            "error": str(e)
        }


@router.get("", status_code=status.HTTP_200_OK)
@router.get("/", include_in_schema=False)
def health_check_overall(db: Session = Depends(get_db)):
    """
    Overall health check - comprehensive status.
    
    Returns 200 if all systems are healthy, 503 otherwise.
    Useful for load balancers and monitoring systems.
    """
    uptime_seconds = time.time() - STARTUP_TIME
    
    # Check database connectivity
    db_connection = check_database_connection(db)
    db_tables = check_database_tables(db)
    
    # Determine overall health
    is_healthy = db_connection["healthy"] and db_tables["healthy"]
    
    response_data = {
        "status": "healthy" if is_healthy else "unhealthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": round(uptime_seconds, 2),
        "version": "2.1.0",
        "checks": {
            "database_connection": db_connection,
            "database_tables": db_tables
        }
    }
    
    return JSONResponse(
        status_code=status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE,
        content=response_data
    )


@router.get("/live", status_code=status.HTTP_200_OK)
def liveness_probe():
    """
    Liveness probe - is the application running?
    
    Returns 200 if the application process is alive.
    Kubernetes uses this to determine if a pod should be restarted.
    
    This should be lightweight and always succeed if the process is running.
    """
    return {
        "status": "alive",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": round(time.time() - STARTUP_TIME, 2)
    }


@router.get("/ready", status_code=status.HTTP_200_OK)
def readiness_probe(db: Session = Depends(get_db)):
    """
    Readiness probe - can the application serve traffic?
    
    Returns 200 if the application can handle requests, 503 otherwise.
    Kubernetes uses this to determine if a pod should receive traffic.
    
    Checks:
    - Database connectivity
    - Critical tables exist
    """
    db_connection = check_database_connection(db)
    db_tables = check_database_tables(db)
    
    is_ready = db_connection["healthy"] and db_tables["healthy"]
    
    response_data = {
        "status": "ready" if is_ready else "not_ready",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": {
            "database_connection": db_connection,
            "database_tables": db_tables
        }
    }
    
    return JSONResponse(
        status_code=status.HTTP_200_OK if is_ready else status.HTTP_503_SERVICE_UNAVAILABLE,
        content=response_data
    )


@router.get("/startup", status_code=status.HTTP_200_OK)
def startup_probe(db: Session = Depends(get_db)):
    """
    Startup probe - has initialization completed?
    
    Returns 200 once the application has fully started up.
    Kubernetes uses this for slow-starting containers to avoid premature restarts.
    
    Checks:
    - Database connectivity
    - Tables exist
    - Minimum uptime (2 seconds)
    """
    uptime = time.time() - STARTUP_TIME
    minimum_uptime_met = uptime >= 2.0
    
    db_connection = check_database_connection(db)
    db_tables = check_database_tables(db)
    
    is_started = (
        minimum_uptime_met and 
        db_connection["healthy"] and 
        db_tables["healthy"]
    )
    
    response_data = {
        "status": "started" if is_started else "starting",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": round(uptime, 2),
        "checks": {
            "minimum_uptime": {
                "healthy": minimum_uptime_met,
                "uptime_seconds": round(uptime, 2),
                "minimum_required": 2.0
            },
            "database_connection": db_connection,
            "database_tables": db_tables
        }
    }
    
    return JSONResponse(
        status_code=status.HTTP_200_OK if is_started else status.HTTP_503_SERVICE_UNAVAILABLE,
        content=response_data
    )
