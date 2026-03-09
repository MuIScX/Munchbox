from sqlalchemy import Column, BigInteger, Integer, Text, DECIMAL, SmallInteger
from app.db.base import Base


class Menu(Base):
    __tablename__ = "menu"

    id            = Column(BigInteger, primary_key=True, autoincrement=True)
    name          = Column(Text, nullable=False)
    price         = Column(BigInteger, nullable=False)
    restaurant_id = Column(BigInteger, nullable=False)
    type          = Column(Integer, nullable=False)
    is_active     = Column(SmallInteger, nullable=False, default=1)


class Recipe(Base):
    __tablename__ = "recipe"

    id            = Column(BigInteger, primary_key=True, autoincrement=True)
    menu_id       = Column(BigInteger, nullable=False)
    ingredient_id = Column(BigInteger, nullable=False)
    amount        = Column(DECIMAL(8, 2), nullable=False)
    restaurant_id = Column(BigInteger, nullable=False)
