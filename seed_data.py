from app import create_app, db
from app.models import User, Task
from datetime import datetime, timedelta

app = create_app()

def seed_database():
    with app.app_context():
        print("🗑️  Dropping existing tables...")
        db.drop_all()
        
        print("📦 Creating tables...")
        db.create_all()
        
        # Create verified demo user
        verified_user = User(
            username='john_doe',
            phone='+265888123456',
            email='john@kuhes.ac.mw',
            is_verified=True,
            verified_at=datetime.utcnow(),
            is_anonymous=False,
            completed_tasks=12,
            rating=4.8
        )
        db.session.add(verified_user)
        
        # Create unverified demo user
        unverified_user = User(
            username='jane_smith',
            phone='+265888789012',
            is_anonymous=False,
            completed_tasks=3,
            rating=4.2
        )
        db.session.add(unverified_user)
        db.session.commit()
        
        # Coordinates (Lilongwe area)
        CAMPUS_LAT = -13.9833
        CAMPUS_LON = 33.7833
        
        # Sample tasks with different types
        sample_tasks = [
            {
                'title': 'Buy Airtime - TNM',
                'description': 'Need K2000 TNM airtime urgently.',
                'payment': 2000,
                'task_type': 'help_me',
                'location_name': 'Campus - Main Gate',
                'latitude': CAMPUS_LAT + 0.001,
                'longitude': CAMPUS_LON + 0.001,
                'urgency': 'Now',
                'user_id': verified_user.id
            },
            {
                'title': 'Going to Limbe - Need Company',
                'description': 'Driving to Limbe from campus at 2pm. Looking for company. Free ride, just need someone to chat with.',
                'payment': None,
                'task_type': 'send_me',
                'location_name': 'Campus',
                'latitude': CAMPUS_LAT,
                'longitude': CAMPUS_LON,
                'urgency': 'Today',
                'user_id': verified_user.id,
                'departure_location': 'Campus',
                'destination_location': 'Limbe',
                'departure_time': datetime.utcnow() + timedelta(hours=4),
                'available_seats': 3
            },
            {
                'title': 'Print 20 Pages',
                'description': 'Need 20 pages printed at the library.',
                'payment': 500,
                'task_type': 'help_me',
                'location_name': 'University Library',
                'latitude': CAMPUS_LAT - 0.002,
                'longitude': CAMPUS_LON + 0.003,
                'urgency': 'Today',
                'user_id': verified_user.id
            },
            {
                'title': 'Delivering Packages to Town',
                'description': 'Going to town at 3pm. Can deliver small packages for anyone.',
                'payment': 1000,
                'task_type': 'deliver',
                'location_name': 'Campus Post Office',
                'latitude': CAMPUS_LAT + 0.002,
                'longitude': CAMPUS_LON - 0.001,
                'urgency': 'Today',
                'user_id': verified_user.id
            },
            {
                'title': 'Group Order - Pizza',
                'description': 'Ordering pizza from Domino\'s. Looking for 2 more people to split delivery fee.',
                'payment': 5000,
                'task_type': 'group_buy',
                'location_name': 'Cafeteria',
                'latitude': CAMPUS_LAT + 0.003,
                'longitude': CAMPUS_LON - 0.002,
                'urgency': 'Today',
                'user_id': verified_user.id
            }
        ]
        
        print("📝 Adding sample tasks...")
        for i, task_data in enumerate(sample_tasks):
            task = Task(
                title=task_data['title'],
                description=task_data['description'],
                payment=task_data.get('payment'),
                task_type=task_data.get('task_type', 'help_me'),
                location_name=task_data['location_name'],
                latitude=task_data.get('latitude'),
                longitude=task_data.get('longitude'),
                urgency=task_data['urgency'],
                user_id=task_data['user_id'],
                expires_at=datetime.utcnow() + timedelta(days=7),
                departure_location=task_data.get('departure_location'),
                destination_location=task_data.get('destination_location'),
                departure_time=task_data.get('departure_time'),
                available_seats=task_data.get('available_seats', 1)
            )
            db.session.add(task)
            print(f"  ✅ Added: {task_data['title']} ({task_data.get('task_type', 'help_me')})")
        
        db.session.commit()
        
        print("\n" + "="*50)
        print("🎉 DATABASE SEEDED SUCCESSFULLY!")
        print("="*50)
        print(f"📊 Stats:")
        print(f"   - Users: {User.query.count()} (1 verified, 1 unverified)")
        print(f"   - Tasks: {Task.query.count()}")
        print(f"   - Open Tasks: {Task.query.filter_by(status='open').count()}")
        print("\n🔐 Verification:")
        print("   - Verified user: john@kuhes.ac.mw")
        print("   - Unverified user: jane_smith")
        print("\n📋 Task Types:")
        print("   - Help Me: Buy Airtime, Print Pages")
        print("   - Send Me: Going to Limbe")
        print("   - Deliver: Package Delivery")
        print("   - Group Buy: Pizza Order")
        print("\n🚀 Run: python run.py")
        print("📍 Visit: http://localhost:5000")
        print("="*50)

if __name__ == '__main__':
    seed_database()