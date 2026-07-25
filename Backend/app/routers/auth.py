from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from passlib.hash import bcrypt

from app.database import get_db
from app.models.user import User
from app.schemas.auth import UserCreate, UserLogin
from app.core.security import create_access_token

router = APIRouter()


@router.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):

    # ---------------- DEBUG ----------------
    print("=" * 60)
    print("Connected Database:",
          db.execute(text("SELECT current_database()")).scalar())

    columns = db.execute(text("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema='public'
          AND table_name='users'
        ORDER BY ordinal_position
    """)).fetchall()

    print("Users Table Columns:", columns)
    print("=" * 60)
    # ---------------------------------------

    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user.email).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    hashed_pw = bcrypt.hash(user.password)

    db_user = User(
        full_name=user.full_name,
        email=user.email,
        hashed_password=hashed_pw,
        role=user.role
    )

    db.add(db_user)
    db.flush()  # get db_user.id without committing yet

    # Also create a Customer record so the real name appears throughout the admin dashboard
    from app.models.customer import Customer
    existing_customer = db.query(Customer).filter(Customer.email == user.email).first()
    if not existing_customer:
        db_customer = Customer(
            name=user.full_name,
            email=user.email,
            company_name=getattr(user, 'company', None),
            status="Active",
        )
        db.add(db_customer)

    db.commit()
    db.refresh(db_user)

    return {
        "message": "User created successfully"
    }


@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):

    print("=" * 60)
    print("Connected Database:",
          db.execute(text("SELECT current_database()")).scalar())
    print("=" * 60)

    db_user = db.query(User).filter(User.email == user.email).first()

    if not db_user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email"
        )

    if not bcrypt.verify(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Invalid password"
        )

    token = create_access_token({"user_id": db_user.id})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "full_name": db_user.full_name,
            "email": db_user.email,
            "role": db_user.role
        }
    }