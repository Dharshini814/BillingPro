"""
Append-only secure audit log with HMAC hash-chain integrity.
Each record's hash depends on the previous record, forming a tamper-evident chain.
Records can never be deleted or modified.
"""

import hmac
import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, DateTime, JSON, Text
from sqlalchemy.sql import func

from app.database import Base


class SecureAuditLog(Base):

    __tablename__ = "secure_audit_logs"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    timestamp = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    user_id = Column(Integer, nullable=True)
    user_name = Column(String, nullable=True)

    action = Column(String, nullable=False)

    entity_type = Column(String, nullable=True)
    entity_id = Column(Integer, nullable=True)

    description = Column(Text, nullable=True)

    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)

    ip_address = Column(String, nullable=True)

    # Hash chain fields
    previous_hash = Column(
        String(128),
        nullable=True,
        comment="Hash of the previous record — NULL for the first record"
    )

    record_hash = Column(
        String(128),
        nullable=False,
        comment="HMAC-SHA256 of this record's canonical fields + previous_hash"
    )


# ─────────────────────────────────────────────────────
#  Helper Functions
# ─────────────────────────────────────────────────────

def compute_record_hash(
    record_data: dict,
    previous_hash: str | None,
    hmac_key: str,
) -> str:
    """
    Compute HMAC-SHA256 hash for audit integrity verification.
    The canonical string is a deterministic JSON representation
    of the key fields plus the previous record's hash.
    """
    canonical = json.dumps(
        {
            "timestamp": str(record_data.get("timestamp", "")),
            "user_id": record_data.get("user_id"),
            "action": record_data.get("action", ""),
            "entity_type": record_data.get("entity_type", ""),
            "entity_id": record_data.get("entity_id"),
            "description": record_data.get("description", ""),
            "previous_hash": previous_hash or "",
        },
        sort_keys=True,
        default=str,
    )
    return hmac.new(
        hmac_key.encode("utf-8"),
        canonical.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def create_secure_audit_entry(
    db,
    action: str,
    entity_type: str = None,
    entity_id: int = None,
    description: str = None,
    user_id: int = None,
    user_name: str = None,
    old_value: dict = None,
    new_value: dict = None,
    ip_address: str = None,
) -> SecureAuditLog:
    """
    Create a new tamper-evident audit log entry.
    Automatically chains to the previous record via HMAC hash.
    """
    from app.core.config import AUDIT_HMAC_KEY

    # Get the last record's hash for chaining
    last_record = (
        db.query(SecureAuditLog)
        .order_by(SecureAuditLog.id.desc())
        .first()
    )
    previous_hash = last_record.record_hash if last_record else None

    now = datetime.now(timezone.utc)

    record_data = {
        "timestamp": now,
        "user_id": user_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "description": description,
        "previous_hash": previous_hash,
    }

    record_hash = compute_record_hash(record_data, previous_hash, AUDIT_HMAC_KEY)

    entry = SecureAuditLog(
        timestamp=now,
        user_id=user_id,
        user_name=user_name,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        old_value=old_value,
        new_value=new_value,
        ip_address=ip_address,
        previous_hash=previous_hash,
        record_hash=record_hash,
    )
    db.add(entry)
    return entry


def verify_audit_chain(db) -> dict:
    """
    Verify the integrity of the entire audit chain.
    Returns a dict with 'valid' (bool), 'total_records' (int),
    and 'broken_at' (int | None — the ID of the first broken record).
    """
    from app.core.config import AUDIT_HMAC_KEY

    records = (
        db.query(SecureAuditLog)
        .order_by(SecureAuditLog.id.asc())
        .all()
    )

    if not records:
        return {"valid": True, "total_records": 0, "broken_at": None}

    previous_hash = None
    for record in records:
        record_data = {
            "timestamp": record.timestamp,
            "user_id": record.user_id,
            "action": record.action,
            "entity_type": record.entity_type,
            "entity_id": record.entity_id,
            "description": record.description,
            "previous_hash": previous_hash,
        }
        expected_hash = compute_record_hash(
            record_data, previous_hash, AUDIT_HMAC_KEY
        )

        if record.record_hash != expected_hash:
            return {
                "valid": False,
                "total_records": len(records),
                "broken_at": record.id,
            }

        if record.previous_hash != previous_hash:
            return {
                "valid": False,
                "total_records": len(records),
                "broken_at": record.id,
            }

        previous_hash = record.record_hash

    return {"valid": True, "total_records": len(records), "broken_at": None}
