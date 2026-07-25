from sqlalchemy import Column, Integer, String, Float
from app.database import Base


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)

    company_name = Column(String(200))
    company_email = Column(String(255))
    phone = Column(String(20))
    address = Column(String(255))
    currency = Column(String(20))
    timezone = Column(String(100))
    language = Column(String(50))
    theme = Column(String(50))
    tax_percentage = Column(Float)