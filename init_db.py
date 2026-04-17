# init_db.py
from app import create_app, db
from app.models import User, Task, TaskCandidate, Rating, Notification, UserLocationHistory

app = create_app()

with app.app_context():
    print("Creating database tables...")
    db.create_all()
    print("✅ Database tables created successfully!")