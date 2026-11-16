from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from passlib.hash import bcrypt
from typing import Optional

from app.database import get_db
from app.core.auth import get_current_user, require_admin
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate

router = APIRouter(
    prefix="/users",
    tags=["User Management"],
    dependencies=[Depends(require_admin)],  # Phase 2: admin-only
)


# -----------------------------
# GET ALL USERS
# -----------------------------
@router.get("/")
def get_users(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(User)
    total = query.count()
    
    users = query.offset((page - 1) * pageSize).limit(pageSize).all()
    
    return {
        "items": users,
        "total": total,
        "page": page,
        "pageSize": pageSize
    }


# -----------------------------
# GET USER BY ID
# -----------------------------
@router.get("/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return user


# -----------------------------
# CREATE USER
# -----------------------------
@router.post("/")
def create_user(user: UserCreate, db: Session = Depends(get_db)):

    existing = db.query(User).filter(
        User.email == user.email
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already exists"
        )

    # Hash the password using bcrypt
    hashed_pw = bcrypt.hash(user.password)
    
    # Create user with all required fields including username and password
    db_user = User(
        username=user.email,  # Use email as username
        full_name=user.full_name,
        email=user.email,
        password=hashed_pw,  # Legacy field
        hashed_password=hashed_pw,  # Primary field
        role=user.role if hasattr(user, 'role') and user.role else "user",
        status=user.status if hasattr(user, 'status') and user.status else "Active"
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user


# -----------------------------
# UPDATE USER
# -----------------------------
@router.put("/{user_id}")
def update_user(
    user_id: int,
    updated: UserUpdate,
    db: Session = Depends(get_db)
):

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if updated.full_name is not None:
        user.full_name = updated.full_name

    if updated.email is not None:
        user.email = updated.email

    if updated.role is not None:
        user.role = updated.role

    if updated.status is not None:
        user.status = updated.status

    db.commit()
    db.refresh(user)

    return user


# -----------------------------
# DELETE USER
# -----------------------------
@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db)
):

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    db.delete(user)
    db.commit()

    return {
        "message": "User deleted successfully"
    }