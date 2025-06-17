# backend/app.py
from flask import Flask
from .config import Config
from .db import db

# ← change this:
# from .auth import auth_bp

# ← to this:
from .routes.auth import auth_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)

    # register your blueprint
    app.register_blueprint(auth_bp, url_prefix='/auth')

    # … register other blueprints …

    return app
