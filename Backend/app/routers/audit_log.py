from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, Any
from datetime import date

from app.database import get_db
from app.core.auth import get_current_user, require_admin
from app.models.audit_log import AuditLog


router = APIRouter(
    prefix="/audit-logs",
    tags=["Audit Logs"],
    dependencies=[Depends(require_admin)],  # Phase 2: admin-only
)


# ==========================
# Response Formatter
# ==========================

def to_camel(log: AuditLog) -> dict:
    return {
        "id": log.id,
        "user": log.user_name or "system",
        "action": log.action,
        "entity": log.module or log.entity_type,
        "description": log.description,
        "ipAddress": log.ip_address,
        "timestamp": log.created_at.isoformat() if log.created_at else None
    }


# ==========================
# GET ALL AUDIT LOGS
# ==========================

@router.get("/")
def get_logs(
    entity: Optional[str] = Query("all"),
    action: Optional[str] = Query("all"),
    search: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(10),
    db: Session = Depends(get_db)
):
    from sqlalchemy import or_

    q = db.query(AuditLog)

    # Entity filter — match against BOTH entity_type and module (case-insensitive)
    # DB stores: 'subscription', 'customer', 'Payment', 'Refund', etc.
    if entity and entity != "all":
        e = entity.lower()
        q = q.filter(
            or_(
                func.lower(AuditLog.entity_type).ilike(f"%{e}%"),
                func.lower(AuditLog.module).ilike(f"%{e}%"),
            )
        )

    # Action filter — match against action column (case-insensitive, partial)
    # DB stores: 'created', 'updated', 'PROCESS', 'CREATE', 'plan_change', 'deleted'
    if action and action != "all":
        a = action.lower()
        # Map frontend friendly names to DB values
        action_map = {
            "created":   ["created", "create"],
            "updated":   ["updated", "update"],
            "deleted":   ["deleted", "delete"],
            "cancelled": ["cancelled", "canceled", "cancel"],
            "refunded":  ["refunded", "refund"],
            "payment":   ["process", "payment", "paid"],
            "plan_change": ["plan_change", "plan"],
        }
        db_values = action_map.get(a, [a])
        q = q.filter(
            or_(*[func.lower(AuditLog.action).ilike(f"%{v}%") for v in db_values])
        )

    # Search in description
    if search and search.strip():
        q = q.filter(
            AuditLog.description.ilike(f"%{search.strip()}%")
        )

    # Customer filter
    if customer_id:
        q = q.filter(
            func.lower(AuditLog.entity_type).in_(["customer"]),
            AuditLog.entity_id == customer_id
        )

    # Date range
    if date_from:
        q = q.filter(AuditLog.created_at >= date_from)

    if date_to:
        from datetime import datetime
        q = q.filter(
            AuditLog.created_at <= datetime.combine(date_to, datetime.max.time())
        )

    total = q.count()
    logs = (
        q.order_by(AuditLog.id.desc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .all()
    )

    return {
        "items": [to_camel(log) for log in logs],
        "total": total,
        "page": page,
        "pageSize": pageSize
    }


# ==========================
# GET BY ID
# ==========================

@router.get("/{log_id}")
def get_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Audit log not found")
    return to_camel(log)


# ==========================
# CREATE AUDIT LOG
# ==========================

@router.post("/")
def create_log(payload: Any = Body(...), db: Session = Depends(get_db)):
    log = AuditLog(
        user_name=payload.get("user_name", "system"),
        performed_by=payload.get("performed_by"),
        entity_type=payload.get("entity_type", "Unknown"),
        entity_id=payload.get("entity_id", 0),
        action=payload.get("action", "UNKNOWN"),
        module=payload.get("module", ""),
        description=payload.get("description", ""),
        old_value=payload.get("old_value"),
        new_value=payload.get("new_value"),
        ip_address=payload.get("ip_address")
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return to_camel(log)


# ==========================
# DELETE AUDIT LOG — REMOVED
# ==========================
# Audit logs are append-only for integrity.
# Deletion is not permitted.

