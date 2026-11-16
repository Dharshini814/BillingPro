import logging

from fastapi import APIRouter, Depends, HTTPException
import bcrypt
from sqlalchemy import func, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.database import get_db
from app.models.customer import Customer
from app.models.user import User
from app.schemas.auth import UserCreate, UserLogin

# "uvicorn.error" is configured by uvicorn, so these lines always show in the console.
logger = logging.getLogger("uvicorn.error")

router = APIRouter()

BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2y$")


# ---------------- TEMPORARY DEBUG HELPERS (remove once signup is verified) ----------------
def _debug_context(db: Session, label: str) -> None:
    """Log which module/model/database is really executing. Never logs secrets."""
    try:
        dbname = db.execute(text("SELECT current_database()")).scalar()
    except SQLAlchemyError:
        dbname = "<unavailable>"
    logger.info(
        "[AUTH-DEBUG] %s | module=%s | file=%s | User model=%s | database=%s",
        label, __name__, __file__, User.__module__, dbname,
    )


def _log_db_error(label: str, exc: SQLAlchemyError) -> None:
    """Log the failing SQL operation without bound parameters (which hold hashes)."""
    diag = getattr(getattr(exc, "orig", None), "diag", None)
    logger.error(
        "[AUTH-DEBUG] %s failed | error=%s | column=%s | constraint=%s | sql=%s",
        label,
        type(getattr(exc, "orig", exc)).__name__,
        getattr(diag, "column_name", None),
        getattr(diag, "constraint_name", None),
        (exc.statement or "")[:300] if hasattr(exc, "statement") else None,
    )
# -------------------------------------------------------------------------------------------


@router.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    _debug_context(db, "signup")

    email = user.email.strip().lower()

    # bcrypt only uses the first 72 bytes; newer bcrypt builds raise instead of truncating.
    if len(user.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Password must be at most 72 bytes")

    existing_user = db.query(User).filter(func.lower(User.email) == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Using the bcrypt package directly: passlib 1.7.4 is incompatible with bcrypt >= 4.1.
    # The output is a standard $2b$ hash, so it stays compatible with hashes passlib created.
    hashed_pw = bcrypt.hashpw(user.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    try:
        # The legacy NOT NULL columns `username` and `password` are both supplied.
        # `password` receives the hash, never the plain text.
        db_user = User(
            username=email,
            full_name=user.full_name,
            email=email,
            password=hashed_pw,
            hashed_password=hashed_pw,
            role=user.role,
            status="Active",
        )
        db.add(db_user)
        db.flush()  # get db_user.id without committing yet

        # Also create a Customer record so the real name appears across the admin dashboard.
        existing_customer = (
            db.query(Customer).filter(func.lower(Customer.email) == email).first()
        )
        if not existing_customer:
            db.add(
                Customer(
                    name=user.full_name,
                    email=email,
                    company_name=user.company_name,
                    phone=user.phone,
                    status="Active",
                )
            )

        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _log_db_error("signup (integrity)", exc)
        raise HTTPException(status_code=400, detail="Email already registered")
    except SQLAlchemyError as exc:
        db.rollback()
        _log_db_error("signup", exc)
        raise HTTPException(status_code=500, detail="Signup failed")

    return {"message": "User created successfully"}


def _password_matches(db_user: User, plain_password: str) -> bool:
    """Verify against hashed_password, falling back to the legacy `password` column
    only when it actually holds a bcrypt hash. Plain-text values are never accepted."""
    stored = db_user.hashed_password or getattr(db_user, "password", None)
    if not stored or not stored.startswith(BCRYPT_PREFIXES):
        logger.warning(
            "[AUTH-DEBUG] login: user id=%s has no bcrypt hash on file", db_user.id
        )
        return False
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), stored.encode("utf-8"))
    except ValueError:
        logger.warning("[AUTH-DEBUG] login: malformed hash for user id=%s", db_user.id)
        return False


@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    _debug_context(db, "login")

    email = user.email.strip().lower()
    db_user = db.query(User).filter(func.lower(User.email) == email).first()

    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid email")

    if not _password_matches(db_user, user.password):
        raise HTTPException(status_code=401, detail="Invalid password")

    # Use standard JWT "sub" claim with user email for token identification
    token = create_access_token({"sub": db_user.email})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "full_name": db_user.full_name,
            "email": db_user.email,
            "role": db_user.role,
        },
    }