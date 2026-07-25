from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, Any

from app.database import get_db
from app.models.audit_log import AuditLog


router = APIRouter(
    prefix="/audit-logs",
    tags=["Audit Logs"]
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
    page: int = Query(1, ge=1),
    pageSize: int = Query(10),
    db: Session = Depends(get_db)
):
    q = db.query(AuditLog)

    # Case-insensitive entity filter — frontend may send 'Customer', backend stores 'customer'
    if entity and entity != "all":
        q = q.filter(
            func.lower(AuditLog.entity_type) == entity.lower()
        )

    if action and action != "all":
        q = q.filter(
            func.lower(AuditLog.action) == action.lower()
        )

    if search:
        q = q.filter(
            AuditLog.description.ilike(f"%{search}%")
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
# DELETE AUDIT LOG
# ==========================

@router.delete("/{log_id}")
def delete_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Audit log not found")
    db.delete(log)
    db.commit()
    return {"message": "Audit log deleted successfully"}
