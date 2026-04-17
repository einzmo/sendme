# app/routes/auth.py
from flask import Blueprint, request, jsonify, session
from app.models import User
from app import db

bp = Blueprint('auth', __name__)

@bp.route('/api/set-phone', methods=['POST'])
def set_phone():
    data = request.json
    user_id = session.get('user_id')
    
    if user_id:
        user = User.query.get(user_id)
        if user:
            user.phone = data.get('phone')
            user.is_anonymous = False
            db.session.commit()
            return jsonify({'success': True})
    
    return jsonify({'success': False})

@bp.route('/api/user-status')
def user_status():
    user_id = session.get('user_id')
    if user_id:
        user = User.query.get(user_id)
        if user:
            return jsonify({
                'authenticated': True,
                'phone': user.phone,
                'username': user.username
            })
    return jsonify({'authenticated': False})


# app/routes/auth.py - Add this new route

@bp.route('/api/set-name', methods=['POST'])
def set_name():
    data = request.json
    user_id = session.get('user_id')
    
    if not user_id:
        return jsonify({'success': False, 'error': 'User not found'})
    
    user = User.query.get(user_id)
    if user:
        user.username = data.get('name')
        user.is_anonymous = False
        db.session.commit()
        return jsonify({'success': True, 'username': user.username})
    
    return jsonify({'success': False, 'error': 'User not found'})