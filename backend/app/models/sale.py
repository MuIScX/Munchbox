from sqlalchemy import Column, BigInteger, TIMESTAMP
from app.db.base import Base


class SaleData(Base):
    __tablename__ = "sale_data"

    id            = Column(BigInteger, primary_key=True, autoincrement=True)
    timestamp     = Column(TIMESTAMP, nullable=False)
    amount        = Column(BigInteger, nullable=False)
    menu_id       = Column(BigInteger, nullable=False)
    restaurant_id = Column(BigInteger, nullable=False)
