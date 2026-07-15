from datetime import date, timedelta
from flask import Blueprint, request, jsonify
from sqlalchemy import func
from models import db, User, Trek, Booking
from auth import role_required
from config import get_redis

admin_bp = Blueprint("admin", __name__)

def _clear_trek_cache(tid=None):
    try:
        r = get_redis()
        r.delete("treks_list")
        if tid:
            r.delete(f"trek_{tid}")
    except Exception:
        pass

@admin_bp.route("/api/admin/dashboard", methods=["GET"])

@role_required("admin")

def dashboard():
    recent_bookings = Booking.query.order_by(Booking.booking_date.desc()).limit(5).all()
    recent_treks = Trek.query.order_by(Trek.created_at.desc()).limit(5).all()
    return jsonify({
        "total_treks": Trek.query.count(),
        "total_users": User.query.filter_by(role="trekker").count(),
        "total_staff": User.query.filter_by(role="staff").count(),
        "total_bookings": Booking.query.count(),
        "recent_bookings": [b.to_dict() for b in recent_bookings],
        "recent_treks": [t.to_dict() for t in recent_treks],
    })


@admin_bp.route("/api/admin/treks", methods=["GET"])
@role_required("admin")
def list_treks():
    treks = Trek.query.order_by(Trek.created_at.desc()).all()
    return jsonify([t.to_dict() for t in treks])


@admin_bp.route("/api/admin/treks", methods=["POST"])
@role_required("admin")
def create_trek():
    d = request.get_json() or {}
    for field in ("name", "location", "difficulty", "total_slots", "start_date"):
        if not d.get(field):
            return jsonify({"error": f"Missing field: {field}"}), 400

    status = d.get("status", "Open")
    if status in ("Pending", "Approved"):
        status = "Open"

    start = date.fromisoformat(d["start_date"])
    dur = int(d.get("duration_days", 0) or 0)
    if start < date.today():
        return jsonify({"error": "Start date cannot be in the past"}), 400
    end_date = start + timedelta(days=dur)

    trek = Trek(
        name=d["name"], location=d["location"], difficulty=d["difficulty"],
        duration_days=dur,
        available_slots=int(d["total_slots"]), total_slots=int(d["total_slots"]),
        status=status, start_date=start, end_date=end_date,
        description=d.get("description", ""),
    )
    db.session.add(trek)
    db.session.commit()
    _clear_trek_cache()
    return jsonify(trek.to_dict()), 201


@admin_bp.route("/api/admin/treks/<int:tid>", methods=["PUT"])
@role_required("admin")
def update_trek(tid):
    trek = Trek.query.get_or_404(tid)
    d = request.get_json() or {}

    start = date.fromisoformat(d["start_date"]) if d.get("start_date") else trek.start_date
    dur = int(d["duration_days"]) if "duration_days" in d else trek.duration_days

    if d.get("start_date") and start < date.today() and start != trek.start_date:
        return jsonify({"error": "New start date cannot be in the past"}), 400

    end_date = start + timedelta(days=dur) if start else None

    for field in ("name", "location", "difficulty", "status", "description"):
        if field in d:
            setattr(trek, field, d[field])

    trek.duration_days = dur
    trek.start_date = start
    trek.end_date = end_date

    if "total_slots" in d:
        diff = int(d["total_slots"]) - trek.total_slots
        trek.total_slots = int(d["total_slots"])
        trek.available_slots = max(0, trek.available_slots + diff)

    db.session.commit()
    _clear_trek_cache(tid)
    return jsonify(trek.to_dict())


@admin_bp.route("/api/admin/treks/<int:tid>", methods=["DELETE"])
@role_required("admin")
def delete_trek(tid):
    trek = Trek.query.get_or_404(tid)
    for b in Booking.query.filter_by(trek_id=tid).all():
        b.status = "Cancelled"
    db.session.delete(trek)
    db.session.commit()
    _clear_trek_cache(tid)
    return jsonify({"message": "Deleted"})


@admin_bp.route("/api/admin/treks/<int:tid>/assign-staff", methods=["PUT"])
@role_required("admin")
def assign_staff(tid):
    trek = Trek.query.get_or_404(tid)
    d = request.get_json() or {}
    staff_id = d.get("staff_id")
    if staff_id:
        staff = User.query.get(staff_id)
        if not staff or staff.role != "staff":
            return jsonify({"error": "Invalid staff"}), 400
    trek.assigned_staff_id = staff_id
    db.session.commit()
    _clear_trek_cache(tid)
    return jsonify(trek.to_dict())


@admin_bp.route("/api/admin/staff", methods=["GET"])
@role_required("admin")
def list_staff():
    staff = User.query.filter_by(role="staff").order_by(User.created_at.desc()).all()
    result = []
    for s in staff:
        sd = s.to_dict()
        sd["assigned_trek_count"] = len(s.treks_assigned)
        result.append(sd)
    return jsonify(result)


@admin_bp.route("/api/admin/staff", methods=["POST"])
@role_required("admin")
def create_staff():
    d = request.get_json() or {}
    email = (d.get("email") or "").strip().lower()
    phone = (d.get("contact") or "").strip()
    if not d.get("name") or not d.get("password"):
        return jsonify({"error": "Missing fields"}), 400
    if not phone or len(phone) != 10 or not phone.isdigit():
        return jsonify({"error": "Contact number is required and must be exactly 10 digits"}), 400
    if not email or "@" not in email or "." not in email:
        return jsonify({"error": "Invalid email address format"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already exists"}), 400
    usr = User(name=d["name"], email=email, role="staff", contact=phone)
    usr.set_password(d["password"])
    db.session.add(usr)
    db.session.commit()
    return jsonify(usr.to_dict()), 201


@admin_bp.route("/api/admin/staff/<int:sid>", methods=["PUT"])
@role_required("admin")
def update_staff(sid):
    staff = User.query.filter_by(id=sid, role="staff").first_or_404()
    d = request.get_json() or {}
    phone = (d.get("contact") or "").strip()
    if phone and (len(phone) != 10 or not phone.isdigit()):
        return jsonify({"error": "Invalid phone number, must be exactly 10 digits"}), 400
    if d.get("name"):
        staff.name = d["name"]
    if "contact" in d:
        staff.contact = phone
    if "is_active" in d:
        staff.is_active = bool(d["is_active"])
    db.session.commit()
    return jsonify(staff.to_dict())


@admin_bp.route("/api/admin/users", methods=["GET"])
@role_required("admin")
def list_users():
    users = User.query.filter_by(role="trekker").order_by(User.created_at.desc()).all()
    return jsonify([u.to_dict() for u in users])


@admin_bp.route("/api/admin/users/<int:uid>/status", methods=["PUT"])
@role_required("admin")
def update_user_status(uid):
    usr = User.query.get_or_404(uid)
    d = request.get_json() or {}
    action = d.get("action")  #activate/deactivate
    if action == "activate":
        usr.is_active = True
        usr.is_blacklisted = False
    elif action == "deactivate":
        usr.is_active = False
    elif action == "blacklist":
        usr.is_blacklisted = True
        usr.is_active = False
    elif action == "whitelist":
        usr.is_blacklisted = False
        usr.is_active = True
    else:
        return jsonify({"error": "Invalid action"}), 400
    db.session.commit()
    return jsonify(usr.to_dict())


@admin_bp.route("/api/admin/bookings", methods=["GET"])
@role_required("admin")
def list_bookings():
    bookings = Booking.query.order_by(Booking.booking_date.desc()).all()
    return jsonify([b.to_dict() for b in bookings])


@admin_bp.route("/api/admin/search", methods=["GET"])
@role_required("admin")
def search():
    q = request.args.get("q", "")
    typ = request.args.get("type", "treks")
    status = request.args.get("status", "")
    location = request.args.get("location", "")
    results = []
    if typ == "treks":
        treks_q = Trek.query.filter(Trek.name.ilike(f"%{q}%") | Trek.location.ilike(f"%{q}%"))
        if status:
            treks_q = treks_q.filter(Trek.status == status)
        if location:
            treks_q = treks_q.filter(Trek.location.ilike(f"%{location}%"))
        results = [t.to_dict() for t in treks_q.all()]
    elif typ == "users":
        users = User.query.filter_by(role="trekker").filter(
            User.name.ilike(f"%{q}%") | User.email.ilike(f"%{q}%")
        ).all()
        results = [u.to_dict() for u in users]
    elif typ == "staff":
        staff = User.query.filter_by(role="staff").filter(
            User.name.ilike(f"%{q}%") | User.email.ilike(f"%{q}%")
        ).all()
        results = [s.to_dict() for s in staff]
    return jsonify(results)


@admin_bp.route("/api/admin/reports/monthly", methods=["GET"])
@role_required("admin")
def monthly_report():
    top = db.session.query(
        Trek.name, func.count(Booking.id).label("count")
    ).join(Booking, Trek.id == Booking.trek_id).group_by(Trek.id).order_by(func.count(Booking.id).desc()).limit(5).all()

    total_completed = Trek.query.filter_by(status="Completed").count()
    total_active_bookings = Booking.query.filter_by(status="Booked").count()

    return jsonify({
        "total_completed_treks": total_completed,
        "total_active_bookings": total_active_bookings,
        "top_treks": [{"name": r[0], "bookings": r[1]} for r in top],
    })
