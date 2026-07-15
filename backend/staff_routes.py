from flask import Blueprint, request, jsonify

from models import db, Trek, Booking
from auth import role_required
from config import get_redis

staff_bp = Blueprint("staff", __name__)


def _clear_trek_cache(tid=None):
    try:
        r = get_redis()
        r.delete("treks_list")
        if tid:
            r.delete(f"trek_{tid}")
    except Exception:
        pass


@staff_bp.route("/api/staff/treks", methods=["GET"])
@role_required("staff")
def my_treks():
    treks = Trek.query.filter_by(assigned_staff_id=request.current_user.id).all()
    result = []
    for t in treks:
        td = t.to_dict()
        td["participant_count"] = Booking.query.filter_by(trek_id=t.id, status="Booked").count()
        result.append(td)
    return jsonify(result)


@staff_bp.route("/api/staff/treks/<int:tid>", methods=["PUT"])
@role_required("staff")
def update_trek(tid):
    trek = Trek.query.get_or_404(tid)
    if trek.assigned_staff_id != request.current_user.id:
        return jsonify({"error": "Not your trek"}), 403
    d = request.get_json() or {}

    if "total_slots" in d:
        total = int(d["total_slots"])
        if total < 0:
            return jsonify({"error": "Total slots cannot be negative"}), 400
        active_bookings = Booking.query.filter_by(trek_id=trek.id, status="Booked").count()
        if total < active_bookings:
            return jsonify({"error": f"Cannot set slots below {active_bookings} active bookings"}), 400
        trek.total_slots = total
        trek.available_slots = max(0, total - active_bookings)

    if "status" in d:
        status = d["status"]
        if status in ("Open", "Closed"):
            trek.status = status
        else:
            return jsonify({"error": "Allowed status values are Open or Closed only"}), 400

    db.session.commit()
    _clear_trek_cache(trek.id)
    return jsonify(trek.to_dict())


@staff_bp.route("/api/staff/treks/<int:tid>/participants", methods=["GET"])
@role_required("staff")
def participants(tid):
    trek = Trek.query.get_or_404(tid)
    if trek.assigned_staff_id != request.current_user.id:
        return jsonify({"error": "Not your trek"}), 403
    bookings = Booking.query.filter_by(trek_id=tid).all()
    return jsonify([b.to_dict() for b in bookings])


@staff_bp.route("/api/staff/treks/<int:tid>/complete", methods=["PUT"])
@role_required("staff")
def complete_trek(tid):
    trek = Trek.query.get_or_404(tid)
    if trek.assigned_staff_id != request.current_user.id:
        return jsonify({"error": "Not your trek"}), 403
    trek.status = "Completed"
    for b in Booking.query.filter_by(trek_id=tid, status="Booked").all():
        b.status = "Completed"
    db.session.commit()
    _clear_trek_cache(tid)
    return jsonify(trek.to_dict())
