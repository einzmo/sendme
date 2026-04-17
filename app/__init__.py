# app/__init__.py (FIXED)
from flask import Flask, render_template
from flask_sqlalchemy import SQLAlchemy
import os

db = SQLAlchemy()

def create_app(config_class=None):
    app = Flask(__name__, 
                static_folder='static',
                template_folder='templates')
    
    if config_class is None:
        from config import Config
        app.config.from_object(Config)
    else:
        app.config.from_object(config_class)
    
    db.init_app(app)
    
    # Register error handlers
    @app.errorhandler(404)
    def not_found(error):
        return render_template('index.html'), 200  # Return SPA style
    
    from app.routes import main, tasks, auth
    app.register_blueprint(main.bp)
    app.register_blueprint(tasks.bp)
    app.register_blueprint(auth.bp)
    
    return app