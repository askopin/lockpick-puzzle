from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.postgresql import JSONB

db = SQLAlchemy()


class Puzzle(db.Model):
    __tablename__ = 'puzzles'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text)
    coordinates_x = db.Column(db.Float, nullable=True)
    coordinates_y = db.Column(db.Float, nullable=True)
    data = db.Column(JSONB, nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
