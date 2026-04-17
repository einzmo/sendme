# app/routes/main.py - COMPLETE FIXED VERSION (NO DUPLICATES)

from flask import Blueprint, render_template, jsonify, request, session, make_response
from app.models import Task, User, TaskCandidate, UserLocationHistory
from app import db
from datetime import datetime
from math import radians, sin, cos, sqrt, atan2
import uuid

bp = Blueprint('main', __name__)

def calculate_distance(lat1, lon1, lat2, lon2):
    if not all([lat1, lon1, lat2, lon2]):
        return None
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return round(R * c, 2)

@bp.route('/')
def index():
    if 'user_id' not in session:
        session_id = request.cookies.get('sendme_session')
        if session_id:
            user = User.query.filter_by(session_id=session_id).first()
            if not user:
                user = User(
                    username=f"user_{uuid.uuid4().hex[:8]}",
                    session_id=session_id,
                    is_anonymous=True
                )
                db.session.add(user)
                db.session.commit()
            session['user_id'] = user.id
        else:
            user = User(
                username=f"user_{uuid.uuid4().hex[:8]}",
                session_id=uuid.uuid4().hex,
                is_anonymous=True
            )
            db.session.add(user)
            db.session.commit()
            session['user_id'] = user.id
    
    response = make_response(render_template('index.html'))
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user and user.session_id:
            response.set_cookie('sendme_session', user.session_id, max_age=30*24*60*60)
    return response

@bp.route('/api/tasks')
def get_tasks():
    filter_type = request.args.get('filter', 'all')
    task_type = request.args.get('type', 'all')
    user_lat = request.args.get('lat', type=float)
    user_lon = request.args.get('lon', type=float)
    
    query = Task.query.filter_by(status='open')
    
    if task_type != 'all':
        query = query.filter_by(task_type=task_type)
    
    if filter_type == 'urgent':
        query = query.filter(Task.urgency == 'Now')
    elif filter_type == 'high_pay':
        query = query.filter(Task.payment.isnot(None)).order_by(Task.payment.desc())
    elif filter_type == 'nearby' and user_lat and user_lon:
        tasks = query.all()
        tasks_with_distance = []
        for task in tasks:
            if task.latitude and task.longitude:
                distance = calculate_distance(user_lat, user_lon, task.latitude, task.longitude)
                task_dict = task.to_dict(user_lat, user_lon)
                tasks_with_distance.append((distance, task_dict))
        tasks_with_distance.sort(key=lambda x: x[0] if x[0] is not None else float('inf'))
        return jsonify([t[1] for t in tasks_with_distance if t[0] is not None][:50])
    else:
        query = query.order_by(Task.created_at.desc())
    
    tasks = query.limit(50).all()
    return jsonify([t.to_dict(user_lat, user_lon) for t in tasks])

@bp.route('/api/task/<int:task_id>')
def get_task(task_id):
    task = Task.query.get_or_404(task_id)
    user_lat = request.args.get('lat', type=float)
    user_lon = request.args.get('lon', type=float)
    return jsonify(task.to_dict(user_lat, user_lon))

@bp.route('/api/update-location', methods=['POST'])
def update_location():
    data = request.json
    user_id = session.get('user_id')
    
    print(f"📍 Location update request - User: {user_id}, Data: {data}")
    
    if not user_id:
        return jsonify({'success': False, 'error': 'User not found in session'})
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'error': 'User not found in database'})
    
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    consent = data.get('consent', True)
    
    if latitude is not None and longitude is not None:
        try:
            lat_val = float(latitude)
            lon_val = float(longitude)
            
            if -90 <= lat_val <= 90 and -180 <= lon_val <= 180:
                user.latitude = lat_val
                user.longitude = lon_val
                user.location_updated_at = datetime.utcnow()
                user.location_consent_given = consent
                
                print(f"✅ Location saved for user {user_id}: ({lat_val}, {lon_val})")
                
                history = UserLocationHistory(
                    user_id=user_id,
                    latitude=lat_val,
                    longitude=lon_val
                )
                db.session.add(history)
                db.session.commit()
                
                return jsonify({
                    'success': True, 
                    'location_saved': True,
                    'latitude': lat_val,
                    'longitude': lon_val
                })
            else:
                print(f"❌ Invalid coordinates: {lat_val}, {lon_val}")
                return jsonify({'success': False, 'error': 'Invalid coordinates'})
        except (TypeError, ValueError) as e:
            print(f"❌ Error parsing coordinates: {e}")
            return jsonify({'success': False, 'error': 'Invalid coordinate format'})
    else:
        user.location_consent_given = consent
        db.session.commit()
        print(f"📍 Location consent updated for user {user_id}: consent={consent}")
        return jsonify({'success': True, 'consent_updated': True})

@bp.route('/api/location-status')
def location_status():
    user_id = session.get('user_id')
    if user_id:
        user = User.query.get(user_id)
        if user:
            return jsonify({
                'has_location': user.latitude is not None and user.longitude is not None,
                'consent_given': user.location_consent_given,
                'latitude': user.latitude,
                'longitude': user.longitude,
                'last_updated': user.location_updated_at.isoformat() if user.location_updated_at else None
            })
    return jsonify({'has_location': False, 'consent_given': False})

@bp.route('/api/my-tasks')
def get_my_tasks():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'posted': [], 'accepted': []})
    
    posted = Task.query.filter_by(user_id=user_id).order_by(Task.created_at.desc()).all()
    
    candidate_tasks = db.session.query(Task).join(TaskCandidate, Task.id == TaskCandidate.task_id).filter(
        TaskCandidate.user_id == user_id,
        TaskCandidate.status == 'pending'
    ).order_by(Task.created_at.desc()).all()
    
    user_lat = request.args.get('lat', type=float)
    user_lon = request.args.get('lon', type=float)
    
    return jsonify({
        'posted': [t.to_dict(user_lat, user_lon) for t in posted],
        'accepted': [t.to_dict(user_lat, user_lon) for t in candidate_tasks]
    })

@bp.route('/api/my-candidates')
def get_my_candidates():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify([])
    
    candidate_tasks = db.session.query(Task).join(TaskCandidate, Task.id == TaskCandidate.task_id).filter(
        TaskCandidate.user_id == user_id
    ).order_by(Task.created_at.desc()).all()
    
    user_lat = request.args.get('lat', type=float)
    user_lon = request.args.get('lon', type=float)
    
    return jsonify([t.to_dict(user_lat, user_lon) for t in candidate_tasks])

@bp.route('/api/user-status')
def user_status():
    user_id = session.get('user_id')
    if user_id:
        user = User.query.get(user_id)
        if user:
            return jsonify(user.to_dict())
    return jsonify({'authenticated': False, 'username': 'Guest User'})