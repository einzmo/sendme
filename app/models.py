# app/models.py - COMPLETE FIXED VERSION WITH BACKUP CODE
from app import db
from datetime import datetime
from sqlalchemy import Index
import random
import string
import uuid

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    whatsapp_id = db.Column(db.String(100), nullable=True)
    email = db.Column(db.String(200), nullable=True)
    is_verified = db.Column(db.Boolean, default=False)
    verification_code = db.Column(db.String(6), nullable=True)  # Email code (6 digits)
    backup_code = db.Column(db.String(8), nullable=True, unique=True)  # Permanent backup code (8 digits)
    verified_at = db.Column(db.DateTime, nullable=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    location_updated_at = db.Column(db.DateTime, nullable=True)
    location_consent_given = db.Column(db.Boolean, default=False)
    avatar = db.Column(db.String(200), nullable=True)
    rating = db.Column(db.Float, default=0)
    completed_tasks = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_anonymous = db.Column(db.Boolean, default=True)
    session_id = db.Column(db.String(100), unique=True, nullable=True)
    
    # Relationships with unique backref names
    tasks_posted = db.relationship('Task', backref='poster', lazy=True, foreign_keys='Task.user_id')
    task_candidates = db.relationship('TaskCandidate', backref='applicant', lazy=True, foreign_keys='TaskCandidate.user_id')
    ratings_given = db.relationship('Rating', foreign_keys='Rating.rater_id', backref='rater')
    ratings_received = db.relationship('Rating', foreign_keys='Rating.rated_id', backref='rated')
    notifications = db.relationship('Notification', backref='recipient', lazy=True)
    location_history = db.relationship('UserLocationHistory', backref='user', lazy=True)
    
    def get_id(self):
        return str(self.id)
    
    def generate_verification_code(self):
        code = ''.join(random.choices(string.digits, k=6))
        self.verification_code = code
        return code
    
    def generate_backup_code(self):
        """Generate unique 8-digit backup code"""
        while True:
            code = ''.join(random.choices('0123456789', k=8))
            # Check if unique
            if not User.query.filter_by(backup_code=code).first():
                self.backup_code = code
                # Format as XXXX XXXX for display
                formatted = f"{code[:4]} {code[4:]}"
                return formatted
    
    def verify(self, code):
        if self.verification_code == code:
            self.is_verified = True
            self.verified_at = datetime.utcnow()
            self.verification_code = None
            return True
        return False
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'phone': self.phone,
            'whatsapp_id': self.whatsapp_id,
            'email': self.email,
            'is_verified': self.is_verified,
            'backup_code': self.backup_code,
            'rating': round(self.rating, 1) if self.rating else 0,
            'completed_tasks': self.completed_tasks,
            'avatar': self.avatar,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'location_consent_given': self.location_consent_given
        }

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    payment = db.Column(db.Integer, nullable=True)
    task_type = db.Column(db.String(50), default='help_me')
    location_name = db.Column(db.String(200), nullable=False)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    urgency = db.Column(db.String(50), default='Anytime')
    status = db.Column(db.String(50), default='open')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    assigned_to = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    selected_at = db.Column(db.DateTime, nullable=True)
    max_candidates = db.Column(db.Integer, default=3)
    image_url = db.Column(db.String(500), nullable=True)
    whatsapp_group_id = db.Column(db.String(100), nullable=True)
    
    # For "Send Me" type tasks
    departure_location = db.Column(db.String(200), nullable=True)
    destination_location = db.Column(db.String(200), nullable=True)
    departure_time = db.Column(db.DateTime, nullable=True)
    available_seats = db.Column(db.Integer, default=1)
    
    # Relationships
    candidates = db.relationship('TaskCandidate', backref='task', lazy=True, cascade='all, delete-orphan')
    ratings = db.relationship('Rating', backref='task', lazy=True)
    
    __table_args__ = (
        Index('idx_task_status', 'status'),
        Index('idx_task_location', 'latitude', 'longitude'),
        Index('idx_task_type', 'task_type'),
    )
    
    def get_time_ago(self):
        if not self.created_at:
            return "Just now"
        delta = datetime.utcnow() - self.created_at
        if delta.days > 0:
            return f"{delta.days}d ago"
        elif delta.seconds > 3600:
            return f"{delta.seconds // 3600}h ago"
        elif delta.seconds > 60:
            return f"{delta.seconds // 60}m ago"
        else:
            return "Just now"
    
    def calculate_distance(self, user_lat, user_lon):
        from math import radians, sin, cos, sqrt, atan2
        if not user_lat or not user_lon or not self.latitude or not self.longitude:
            return None
        R = 6371
        lat1, lon1, lat2, lon2 = map(radians, [user_lat, user_lon, self.latitude, self.longitude])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        return round(R * c, 2)
    
    def can_accept(self):
        return self.status == 'open' and len(self.candidates) < self.max_candidates
    
    def to_dict(self, user_lat=None, user_lon=None):
        distance = self.calculate_distance(user_lat, user_lon) if user_lat and user_lon else None
        
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'payment': self.payment,
            'task_type': self.task_type,
            'location_name': self.location_name,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'urgency': self.urgency,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'time_ago': self.get_time_ago(),
            'image_url': self.image_url,
            'distance': distance,
            'candidate_count': len(self.candidates) if self.candidates else 0,
            'max_candidates': self.max_candidates,
            'assigned_to': self.assigned_to,
            'poster_name': self.poster.username if self.poster else 'Anonymous',
            'departure_location': self.departure_location,
            'destination_location': self.destination_location,
            'departure_time': self.departure_time.isoformat() if self.departure_time else None,
            'available_seats': self.available_seats
        }

class TaskCandidate(db.Model):
    __tablename__ = 'task_candidate'
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(50), default='pending')
    message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'user': self.applicant.to_dict() if self.applicant else None,
            'status': self.status,
            'message': self.message,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Rating(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    score = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), nullable=False)
    rater_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    rated_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    data = db.Column(db.Text, nullable=True)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'title': self.title,
            'message': self.message,
            'data': self.data,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class UserLocationHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)