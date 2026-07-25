from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.hash import bcrypt

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate

router = APIRouter(
    prefix="/users",
    tags=["User Management"]
)


# -----------------------------
# GET ALL USERS
# -----------------------------
@router.get("/")
def get_users(db: Session = Depends(get_db)):
    return db.query(User).all()


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

    db_user = User(
        full_name=user.full_name,
        email=user.email,
        hashed_password=bcrypt.hash(user.password),
        role=user.role,
        status=user.status
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