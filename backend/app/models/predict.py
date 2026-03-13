from sqlalchemy import Column, BigInteger, Integer, DECIMAL, TIMESTAMP
from app.db.base import Base


class PredictSet(Base):
    __tablename__ = "predict_set"

    id            = Column(BigInteger, primary_key=True, autoincrement=True)
    prediction_id = Column(BigInteger, nullable=False)
    timestamp     = Column(TIMESTAMP, nullable=False)
    model         = Column(Integer, nullable=False)
    day_ahead     = Column(Integer, nullable=False)


class Predict(Base):
    __tablename__ = "predict"

    id                   = Column(BigInteger, primary_key=True, autoincrement=True)
    ingredient_id        = Column(BigInteger, nullable=False)
    prediction_type      = Column(Integer, nullable=False)
    expected_usage       = Column(DECIMAL(8, 2), nullable=False)
    upper_bound          = Column(DECIMAL(8, 2), nullable=True)
    lower_bound          = Column(DECIMAL(8, 2), nullable=True)
    daily_target_average = Column(DECIMAL(8, 2), nullable=True)
    prediction_set       = Column(BigInteger, nullable=False)
    restaurant_id        = Column(BigInteger, nullable=False)
    timestamp            = Column(TIMESTAMP, nullable=False)