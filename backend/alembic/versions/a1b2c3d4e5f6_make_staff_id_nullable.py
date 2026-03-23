"""make ingredient_history staff_id nullable

Revision ID: a1b2c3d4e5f6
Revises: 18db62aa53ab
Create Date: 2026-03-23 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '18db62aa53ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('ingredient_history', 'staff_id',
                    existing_type=sa.BigInteger(),
                    nullable=True)


def downgrade() -> None:
    op.alter_column('ingredient_history', 'staff_id',
                    existing_type=sa.BigInteger(),
                    nullable=False)
