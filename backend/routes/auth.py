#backend/routes/auth.py
from flask import Blueprint, request, jsonify
from backend.models.user import User
from ..db import db

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.json
    required_fields = ['firstName', 'lastName', 'username', 'phoneNumber', 'password']
    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Missing fields'}), 400

    # Check if username or phone number already exists
    existing_user = User.query.filter(
        (User.username == data['username']) | (User.phone_number == data['phoneNumber'])
    ).first()
    if existing_user:
        return jsonify({'error': 'Username or phone number already exists'}), 409

    # Create a new user
    user = User(
        first_name=data['firstName'],
        last_name=data['lastName'],
        username=data['username'],
        phone_number=data['phoneNumber']
    )
    user.set_password(data['password'])  # Hash the password
    db.session.add(user)
    db.session.commit()

    return jsonify({'message': 'User registered successfully'}), 201