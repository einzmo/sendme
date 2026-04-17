# app/__init__.py
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
import os

db = SQLAlchemy()

def create_app():
    app = Flask(__name__, 
                static_folder='static',
                template_folder='templates')
    
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-key-change-in-production')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///sendme.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SESSION_COOKIE_SECURE'] = True
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    
    db.init_app(app)
    
    from app.routes import main, tasks, auth
    app.register_blueprint(main.bp)
    app.register_blueprint(tasks.bp)
    app.register_blueprint(auth.bp)
    
    return app