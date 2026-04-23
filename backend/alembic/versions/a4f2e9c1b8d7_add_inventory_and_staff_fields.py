"""add_inventory_and_staff_fields

Revision ID: a4f2e9c1b8d7
Revises: 9fa399f60dec
Create Date: 2026-04-23 00:00:00.000000

Adds:
  - ingredient_history.as_of_date    (DATE, nullable)
  - ingredient_history.restock_type  (SMALLINT, nullable) — 1=before, 2=after
  - ingredient.reorder_point         (DECIMAL(10,2), nullable)
  - staff.pin                        (VARCHAR(20), nullable)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'a4f2e9c1b8d7'
down_revision: Union[str, None] = '9fa399f60dec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('ingredient_history', sa.Column('as_of_date',   sa.Date(),         nullable=True))
    op.add_column('ingredient_history', sa.Column('restock_type', sa.SmallInteger(), nullable=True))
    op.add_column('ingredient',         sa.Column('reorder_point', sa.DECIMAL(10, 2), nullable=True))
    op.add_column('staff',              sa.Column('pin',           sa.String(20),     nullable=True))


def downgrade() -> None:
    op.drop_column('staff',              'pin')
    op.drop_column('ingredient',         'reorder_point')
    op.drop_column('ingredient_history', 'restock_type')
    op.drop_column('ingredient_history', 'as_of_date')
