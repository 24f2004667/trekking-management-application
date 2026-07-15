import datetime
from functools import wraps
import jwt
from flask import Blueprint, request, jsonify, current_app
from models import db, User

auth_bp = Blueprint("auth", __name__)

def make_token(user):
    payload = {
        "user_id": user.id,
        "role": user.role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24),
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")

def decode_token(token):
    try:
        return jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
    except Exception:
        return None

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        data = decode_token(token)
        if not data:
            return jsonify({"error": "Unauthorized"}), 401
        usr = User.query.get(data["user_id"])
        if not usr or not usr.is_active or usr.is_blacklisted:
            return jsonify({"error": "Account disabled"}), 403
        request.current_user = usr
        return f(*args, **kwargs)
    return decorated

def role_required(*roles):
    def decorator(f):
        @wraps(f)
        @login_required
        def decorated(*args, **kwargs):
            if request.current_user.role not in roles:
                return jsonify({"error": "Forbidden"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


# All Routes

@auth_bp.route("/api/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    if not data.get("email") or not data.get("password") or not data.get("name"):
        return jsonify({"error": "Missing fields"}), 400
    email = data.get("email", "").strip().lower()
    phone = data.get("contact", "").strip()
    if not phone or len(phone) != 10 or not phone.isdigit():
        return jsonify({"error": "Contact number is required and must be exactly 10 digits"}), 400
    if not email or "@" not in email or "." not in email:
        return jsonify({"error": "Invalid email address"}), 400
    if len(data["password"]) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 400

    usr = User(name=data["name"].strip(), email=email, role="trekker", contact=phone)
    usr.set_password(data["password"])
    db.session.add(usr)
    db.session.commit()
    return jsonify({"message": "Registered successfully", "user": usr.to_dict()}), 201

@auth_bp.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password", "")
    if not email or not password:
        return jsonify({"error": "Invalid email or password"}), 401

    usr = User.query.filter_by(email=email).first()
    if not usr or not usr.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401
    if usr.is_blacklisted:
        return jsonify({"error": "Account is blacklisted"}), 403
    if not usr.is_active:
        return jsonify({"error": "Account is deactivated"}), 403

    token = make_token(usr)
    return jsonify({"token": token, "user": usr.to_dict()})


@auth_bp.route("/api/logout", methods=["POST"])
def logout():
    return jsonify({"message": "Logged out"})


@auth_bp.route("/api/me", methods=["GET"])
@login_required
def me():
    return jsonify(request.current_user.to_dict())


@auth_bp.route("/api/profile", methods=["PUT"])
@login_required
def update_profile():
    data = request.get_json() or {}
    usr = request.current_user
    name = (data.get("name") or "").strip()
    contact = (data.get("contact") or "").strip()
    if name:
        usr.name = name
    if not contact or len(contact) != 10 or not contact.isdigit():
        return jsonify({"error": "Contact number is required and must be exactly 10 digits"}), 400
    usr.contact = contact
    db.session.commit()
    return jsonify(usr.to_dict())


@auth_bp.route("/api/change-password", methods=["POST"])
@login_required
def change_password():
    data = request.get_json() or {}
    usr = request.current_user
    current_pw = data.get("current_password")
    new_pw = data.get("new_password")
    confirm_pw = data.get("confirm_password")

    if not current_pw or not new_pw or not confirm_pw:
        return jsonify({"error": "Missing fields"}), 400
    if not usr.check_password(current_pw):
        return jsonify({"error": "Incorrect current password"}), 400
    if new_pw != confirm_pw:
        return jsonify({"error": "New passwords do not match"}), 400
    if len(new_pw) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    usr.set_password(new_pw)
    db.session.commit()
    return jsonify({"message": "Password changed successfully"})
