from sqlalchemy import Column, BigInteger, Integer, Text, DECIMAL, TIMESTAMP, SmallInteger, Date, String
from app.db.base import Base


class Ingredient(Base):
    __tablename__ = "ingredient"

    id            = Column(BigInteger, primary_key=True, autoincrement=True)
    restaurant_id = Column(BigInteger, nullable=False)
    is_active     = Column(SmallInteger, nullable=False, default=1)
    name          = Column(Text, nullable=False)
    stock_left    = Column(DECIMAL(8, 2), nullable=False)
    unit          = Column(Text, nullable=False)
    category      = Column(Integer, nullable=False)
    last_update   = Column(TIMESTAMP, nullable=False)
    reorder_point = Column(DECIMAL(10, 2), nullable=True)


class IngredientHistory(Base):
    __tablename__ = "ingredient_history"

    id            = Column(BigInteger, primary_key=True, autoincrement=True)
    timestamp     = Column(TIMESTAMP, nullable=False)
    action_type   = Column(Integer, nullable=False)
    amount        = Column(DECIMAL(8, 2), nullable=False)
    ingredient_id = Column(BigInteger, nullable=False)
    staff_id      = Column(BigInteger, nullable=True)
    restaurant_id = Column(BigInteger, nullable=False)
    new_current   = Column(Integer, nullable=True)
    as_of_date    = Column(Date, nullable=True)
    restock_type  = Column(SmallInteger, nullable=True)  # 1=before, 2=after
