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
    
    # Use absolute path for SQLite on Render
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'instance', 'sendme.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', f'sqlite:///{db_path}')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    db.init_app(app)
    
    # Import models
    from app.models import User, Task, TaskCandidate, Rating, Notification, UserLocationHistory
    
    # Create tables
    with app.app_context():
        try:
            db.create_all()
            print("✅ Database tables ready")
        except Exception as e:
            print(f"⚠️ Database error: {e}")
    
    # Import and register blueprints
    from app.routes import main, tasks, auth
    app.register_blueprint(main.bp)
    app.register_blueprint(tasks.bp)
    app.register_blueprint(auth.bp)
    
    return app