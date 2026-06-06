import os

from dotenv import load_dotenv
from flask import Flask
from flask_migrate import Migrate

from models import db
from routes.admin import admin_bp
from routes.public import public_bp

load_dotenv()

app = Flask(__name__, template_folder='templates')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ['DATABASE_URL']
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ['SECRET_KEY']

db.init_app(app)
Migrate(app, db)

app.register_blueprint(public_bp)
app.register_blueprint(admin_bp)
