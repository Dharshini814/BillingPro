from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    # Legacy NOT NULL columns that already exist in the PostgreSQL table.
    # Signup fills username with the email address.
    username = Column(String(255), nullable=False)

    full_name = Column(String(100), nullable=False)

    email = Column(String(255), unique=True, index=True, nullable=False)

    # Legacy NOT NULL column. It stores the same bcrypt hash as hashed_password,
    # never the plain-text password.
    password = Column(String(255), nullable=False)

    hashed_password = Column(String(255), nullable=False)

    company_name = Column(String(255), nullable=True)

    role = Column(String(20), default="user")

    status = Column(String(20), default="Active")

    profile_picture = Column(String(500), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )