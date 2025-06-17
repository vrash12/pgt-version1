# backend/app.py
from flask import Flask
from .config import Config
from .db import db, migrate

from .routes.auth      import auth_bp
from .routes.commuter  import commuter_bp
from .routes.pao       import pao_bp
from .routes.manager   import manager_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    migrate.init_app(app, db)

    # register all BPs
    app.register_blueprint(auth_bp,      url_prefix='/auth')
    app.register_blueprint(commuter_bp,  url_prefix='/commuter')
    app.register_blueprint(pao_bp,       url_prefix='/pao')
    app.register_blueprint(manager_bp,   url_prefix='/manager')

    return app
