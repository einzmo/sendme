from flask import Blueprint, request, jsonify, session, current_app
from app.models import Task, User, Notification, TaskCandidate
from app import db
from datetime import datetime, timedelta
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.utils.email import send_verification_email
import base64

bp = Blueprint('tasks', __name__)

def save_image(image_data):
    if not image_data:
        return None
    if ',' in image_data:
        image_data = image_data.split(',')[1]
    try:
        image_bytes = base64.b64decode(image_data)
        filename = f"task_{datetime.utcnow().timestamp()}.png"
        upload_dir = os.path.join(current_app.root_path, 'static', 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        filepath = os.path.join(upload_dir, filename)
        with open(filepath, 'wb') as f:
            f.write(image_bytes)
        return f'/static/uploads/{filename}'
    except Exception as e:
        print(f"Error saving image: {e}")
        return None

@bp.route('/api/task/create', methods=['POST'])
def create_task():
    data = request.json
    
    user_id = session.get('user_id')
    if not user_id:
        user = User(username=f"guest_{datetime.utcnow().timestamp()}", is_anonymous=True)
        db.session.add(user)
        db.session.commit()
        session['user_id'] = user.id
        user_id = user.id
    
    location_value = data.get('location_name') or data.get('location', 'Campus')
    task_type = data.get('task_type', 'help_me')
    payment = data.get('payment')
    
    # For "Send Me" type, payment can be None (free/negotiable)
    if payment == '' or payment is None:
        payment = None
    else:
        payment = int(payment) if payment else None
    
    image_url = save_image(data.get('image')) if data.get('image') else None
    
    task = Task(
        title=data['title'],
        description=data.get('description', ''),
        payment=payment,
        task_type=task_type,
        location_name=location_value,
        latitude=data.get('latitude'),
        longitude=data.get('longitude'),
        urgency=data['urgency'],
        user_id=user_id,
        image_url=image_url,
        expires_at=datetime.utcnow() + timedelta(days=7),
        max_candidates=data.get('max_candidates', 3),
        departure_location=data.get('departure_location'),
        destination_location=data.get('destination_location'),
        departure_time=datetime.fromisoformat(data['departure_time']) if data.get('departure_time') else None,
        available_seats=data.get('available_seats', 1)
    )
    
    db.session.add(task)
    db.session.commit()
    
    return jsonify({'success': True, 'task': task.to_dict()})

# app/routes/tasks.py - Update accept_task function

@bp.route('/api/task/<int:task_id>/accept', methods=['POST'])
def accept_task(task_id):
    task = Task.query.get_or_404(task_id)
    user_id = session.get('user_id')
    
    if not user_id:
        user = User(username=f"guest_{datetime.utcnow().timestamp()}", is_anonymous=True)
        db.session.add(user)
        db.session.commit()
        session['user_id'] = user.id
        user_id = user.id
    
    # Check if user already applied
    existing = TaskCandidate.query.filter_by(task_id=task_id, user_id=user_id).first()
    if existing:
        return jsonify({'success': False, 'error': 'You already applied for this task'})
    
    # Check if task can accept more candidates
    if not task.can_accept():
        return jsonify({'success': False, 'error': 'Task already has maximum candidates'})
    
    # Get message from request (handle both JSON and form data)
    message = ''
    if request.is_json:
        data = request.get_json()
        message = data.get('message', '') if data else ''
    else:
        message = request.form.get('message', '')
    
    # Add candidate
    candidate = TaskCandidate(
        task_id=task_id,
        user_id=user_id,
        message=message
    )
    db.session.add(candidate)
    
    # If reached max candidates, change status to pending
    if len(task.candidates) + 1 >= task.max_candidates:
        task.status = 'pending'
    
    # Notify poster
    notification = Notification(
        user_id=task.user_id,
        type='new_candidate',
        title='New Applicant!',
        message=f"Someone applied for your task: {task.title}",
        data=f'{{"task_id": {task.id}, "candidate_count": {len(task.candidates) + 1}}}'
    )
    db.session.add(notification)
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'Applied successfully! You are candidate {len(task.candidates)} of {task.max_candidates}',
        'candidate_count': len(task.candidates),
        'max_candidates': task.max_candidates,
        'task_status': task.status
    })
    
@bp.route('/api/task/<int:task_id>/candidates', methods=['GET'])
def get_candidates(task_id):
    task = Task.query.get_or_404(task_id)
    user_id = session.get('user_id')
    
    # Only poster can view candidates
    if task.user_id != user_id:
        return jsonify({'success': False, 'error': 'Unauthorized'})
    
    candidates = [c.to_dict() for c in task.candidates]
    return jsonify({'candidates': candidates})

@bp.route('/api/task/<int:task_id>/select/<int:candidate_id>', methods=['POST'])
def select_candidate(task_id, candidate_id):
    task = Task.query.get_or_404(task_id)
    user_id = session.get('user_id')
    
    # Only poster can select
    if task.user_id != user_id:
        return jsonify({'success': False, 'error': 'Unauthorized'})
    
    candidate = TaskCandidate.query.get_or_404(candidate_id)
    if candidate.task_id != task_id:
        return jsonify({'success': False, 'error': 'Candidate not for this task'})
    
    # Update task
    task.status = 'assigned'
    task.assigned_to = candidate.user_id
    task.selected_at = datetime.utcnow()
    
    # Mark selected candidate
    candidate.status = 'selected'
    
    # Reject other candidates
    for other in task.candidates:
        if other.id != candidate_id and other.status == 'pending':
            other.status = 'rejected'
            # Notify rejected candidates
            notification = Notification(
                user_id=other.user_id,
                type='candidate_rejected',
                title='Not Selected',
                message=f'The poster chose someone else for: {task.title}',
                data=f'{{"task_id": {task.id}}}'
            )
            db.session.add(notification)
    
    # Notify selected candidate
    notification = Notification(
        user_id=candidate.user_id,
        type='candidate_selected',
        title='You Were Selected!',
        message=f'You were chosen for: {task.title}. Contact the poster to coordinate.',
        data=f'{{"task_id": {task.id}, "poster_phone": "{task.poster.phone if task.poster else ""}"}}'
    )
    db.session.add(notification)
    
    db.session.commit()
    
    return jsonify({'success': True, 'selected_user': candidate.user.to_dict()})

@bp.route('/api/task/<int:task_id>/reopen', methods=['POST'])
def reopen_task(task_id):
    task = Task.query.get_or_404(task_id)
    user_id = session.get('user_id')
    
    if task.user_id != user_id:
        return jsonify({'success': False, 'error': 'Unauthorized'})
    
    task.status = 'open'
    task.assigned_to = None
    
    # Reset candidate statuses
    for candidate in task.candidates:
        if candidate.status == 'rejected':
            candidate.status = 'pending'
    
    db.session.commit()
    
    return jsonify({'success': True})

@bp.route('/api/task/<int:task_id>/complete', methods=['POST'])
def complete_task(task_id):
    task = Task.query.get_or_404(task_id)
    user_id = session.get('user_id')
    
    # Either poster or assigned person can complete
    if task.user_id != user_id and task.assigned_to != user_id:
        return jsonify({'success': False, 'error': 'Unauthorized'})
    
    task.status = 'completed'
    
    # Update completed tasks count for assigned person
    if task.assigned_to:
        assigned_user = User.query.get(task.assigned_to)
        if assigned_user:
            assigned_user.completed_tasks += 1
    
    db.session.commit()
    
    return jsonify({'success': True})

# At the top of tasks.py, add:
from app.utils.email import send_verification_email

@bp.route('/api/send-verification', methods=['POST'])
def send_verification():
    data = request.json
    email = data.get('email')
    name = data.get('name')
    user_id = session.get('user_id')
    
    if not email.endswith('@kuhes.ac.mw'):
        return jsonify({'success': False, 'error': 'Please use your @kuhes.ac.mw email'})
    
    # Check if user already exists with this email
    existing_user = User.query.filter_by(email=email).first()
    
    if existing_user:
        # Link current session to existing verified user
        session['user_id'] = existing_user.id
        user = existing_user
    else:
        # Get or create user for this session
        if user_id:
            user = User.query.get(user_id)
        else:
            user = User(username=f"user_{uuid.uuid4().hex[:8]}", is_anonymous=True)
            db.session.add(user)
            db.session.commit()
            session['user_id'] = user.id
        
        user.email = email
        if name:
            user.username = name
        user.is_anonymous = False
    
    code = user.generate_verification_code()
    db.session.commit()
    
    # Send email...
    send_verification_email(email, code, user.username)
    
    return jsonify({'success': True, 'message': 'Verification code sent'})

@bp.route('/api/verify-code', methods=['POST'])
def verify_code():
    data = request.json
    code = data.get('code')
    user_id = session.get('user_id')
    
    if not user_id:
        return jsonify({'success': False, 'error': 'User not found'})
    
    user = User.query.get(user_id)
    
    if user.verification_code == code:
        user.is_verified = True
        user.verification_code = None
        user.verified_at = datetime.utcnow()
        
        # Generate backup code for future devices
        backup_code = user.generate_backup_code()
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': 'Email verified!',
            'backup_code': backup_code  # Send to frontend to display
        })
    
    return jsonify({'success': False, 'error': 'Invalid verification code'})

@bp.route('/api/verify-with-backup', methods=['POST'])
def verify_with_backup():
    """Verify a new device using backup code instead of email"""
    data = request.json
    email = data.get('email')
    backup_code = data.get('backup_code')
    
    # Remove spaces from backup code
    clean_code = backup_code.replace(' ', '')
    
    # Find user by email and backup code
    user = User.query.filter_by(email=email, backup_code=clean_code, is_verified=True).first()
    
    if not user:
        return jsonify({'success': False, 'error': 'Invalid email or backup code'})
    
    # Link current session to this verified user
    session['user_id'] = user.id
    
    return jsonify({
        'success': True, 
        'message': 'Device verified using backup code!',
        'username': user.username
    })

@bp.route('/api/notifications')
def get_notifications():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify([])
    
    notifications = Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc()).limit(20).all()
    return jsonify([n.to_dict() for n in notifications])

@bp.route('/api/notifications/<int:notif_id>/read', methods=['POST'])
def mark_notification_read(notif_id):
    notification = Notification.query.get_or_404(notif_id)
    notification.is_read = True
    db.session.commit()
    return jsonify({'success': True})

@bp.route('/api/set-phone', methods=['POST'])
def set_phone():
    data = request.json
    user_id = session.get('user_id')
    if user_id:
        user = User.query.get(user_id)
        if user:
            user.phone = data.get('phone')
            user.whatsapp_id = data.get('whatsapp_id') or data.get('phone')
            user.is_anonymous = False
            db.session.commit()
            return jsonify({'success': True})
    return jsonify({'success': False})

@bp.route('/api/set-name', methods=['POST'])
def set_name():
    data = request.json
    user_id = session.get('user_id')
    
    if not user_id:
        return jsonify({'success': False, 'error': 'User not found'})
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'error': 'User not found'})
    
    new_name = data.get('name', '').strip()
    if new_name:
        user.username = new_name
        user.is_anonymous = False
        db.session.commit()
        return jsonify({'success': True, 'username': new_name})
    
    return jsonify({'success': False, 'error': 'Invalid name'})