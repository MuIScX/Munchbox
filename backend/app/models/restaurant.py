from sqlalchemy import Column, BigInteger, Integer, Text, Date, Time
from app.db.base import Base


class RestaurantInfo(Base):
    __tablename__ = "restaurant_info"

    id           = Column(BigInteger, primary_key=True, autoincrement=True)
    name         = Column(Text, nullable=False)
    start_date   = Column(Date, nullable=False)
    end_date     = Column(Date, nullable=False)
    package      = Column(Integer, nullable=False)
    updated_time = Column(Time, nullable=False)
    manager_pin  = Column(Integer, nullable=True)
