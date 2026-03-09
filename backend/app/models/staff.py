from sqlalchemy import Column, BigInteger, Integer, Text, SmallInteger
from app.db.base import Base


class Staff(Base):
    __tablename__ = "staff"

    id            = Column(BigInteger, primary_key=True, autoincrement=True)
    name          = Column(Text, nullable=False)
    role          = Column(Integer, nullable=False)
    restaurant_id = Column(BigInteger, nullable=False)
    is_active     = Column(SmallInteger, nullable=False, default=1)
