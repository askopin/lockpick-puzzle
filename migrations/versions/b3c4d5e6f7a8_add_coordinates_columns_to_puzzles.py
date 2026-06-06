"""add coordinates columns to puzzles

Revision ID: b3c4d5e6f7a8
Revises: a1b2c3d4e5f6
Create Date: 2026-06-06 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'b3c4d5e6f7a8'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('puzzles', sa.Column('coordinates_x', sa.Float(), nullable=True))
    op.add_column('puzzles', sa.Column('coordinates_y', sa.Float(), nullable=True))


def downgrade():
    op.drop_column('puzzles', 'coordinates_y')
    op.drop_column('puzzles', 'coordinates_x')
