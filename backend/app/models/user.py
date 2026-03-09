from sqlalchemy import Column, BigInteger, Integer, Text
from app.db.base import Base


class User(Base):
    __tablename__ = "user"

    id            = Column(BigInteger, primary_key=True, autoincrement=True)
    username      = Column(Text, nullable=False)
    email         = Column(Text, nullable=False)
    password      = Column(Text, nullable=False)
    permission    = Column(Integer, nullable=False, default=1)
    restaurant_id = Column(BigInteger, nullable=True)
