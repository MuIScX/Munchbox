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
    manager_pin          = Column(Integer, nullable=True)
    prediction_frequency  = Column(Integer, nullable=True, default=None)  # days between auto-runs, None = manual only
    prediction_days_ahead = Column(Integer, nullable=True, default=7)     # how many days ahead to forecast
    prediction_run_time   = Column(Time, nullable=True, default=None)     # time of day to run (BKK), None = 00:00
