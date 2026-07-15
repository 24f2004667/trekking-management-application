import os
import json

from flask import Blueprint, request, jsonify, current_app, send_file

from models import db, Trek, Booking
from auth import login_required
from config import get_redis

user_bp = Blueprint("user", __name__)


def _clear_trek_cache(tid=None):
    try:
        r = get_redis()
        r.delete("treks_list")
        if tid:
            r.delete(f"trek_{tid}")
    except Exception:
        pass


@user_bp.route("/api/treks", methods=["GET"])
def list_treks():
    diff = request.args.get("difficulty")
    loc = request.args.get("location")
    dur = request.args.get("duration")
    no_filters = not diff and not loc and not dur

    if no_filters:
        try:
            r = get_redis()
            cached = r.get("treks_list")
            if cached:
                return jsonify(json.loads(cached))
        except Exception:
            pass

    q = Trek.query.filter(Trek.status == "Open", Trek.assigned_staff_id.isnot(None))
    if diff:
        q = q.filter(Trek.difficulty == diff)
    if loc:
        q = q.filter(Trek.location.ilike(f"%{loc}%"))
    if dur:
        q = q.filter(Trek.duration_days <= int(dur))

    result = [t.to_dict() for t in q.all()]

    if no_filters:
        try:
            r = get_redis()
            r.setex("treks_list", current_app.config.get("CACHE_TTL", 120), json.dumps(result))
        except Exception:
            pass

    return jsonify(result)


@user_bp.route("/api/treks/<int:tid>", methods=["GET"])
def get_trek(tid):
    try:
        r = get_redis()
        cached = r.get(f"trek_{tid}")
        if cached:
            return jsonify(json.loads(cached))
    except Exception:
        pass

    trek = Trek.query.get_or_404(tid)
    result = trek.to_dict()

    try:
        r = get_redis()
        r.setex(f"trek_{tid}", 60, json.dumps(result))
    except Exception:
        pass

    return jsonify(result)


@user_bp.route("/api/bookings", methods=["POST"])
@login_required
def book_trek():
    if request.current_user.role != "trekker":
        return jsonify({"error": "Only trekkers can book"}), 403
    d = request.get_json() or {}
    trek = Trek.query.get(d.get("trek_id"))
    if not trek:
        return jsonify({"error": "Trek not found"}), 404
    if trek.status != "Open":
        return jsonify({"error": "Trek is not open for booking"}), 400
    if trek.available_slots <= 0:
        return jsonify({"error": "No slots available"}), 400

    existing = Booking.query.filter_by(
        user_id=request.current_user.id, trek_id=trek.id
    ).filter(Booking.status != "Cancelled").first()
    if existing:
        return jsonify({"error": "You have already booked this trek"}), 400

    if trek.start_date:
        active_bookings = Booking.query.filter_by(
            user_id=request.current_user.id, status="Booked"
        ).all()
        for b in active_bookings:
            ob = b.trek
            if ob and ob.start_date and ob.end_date and ob.start_date <= trek.start_date <= ob.end_date:
                return jsonify({
                    "error": (
                        f"You have already booked another trek (\"{ob.name}\") from "
                        f"{ob.start_date.isoformat()} to {ob.end_date.isoformat()}. "
                        f"Please choose a trek with different dates."
                    )
                }), 400

    booking = Booking(user_id=request.current_user.id, trek_id=trek.id)
    trek.available_slots -= 1
    db.session.add(booking)
    db.session.commit()
    _clear_trek_cache(trek.id)
    return jsonify(booking.to_dict()), 201


@user_bp.route("/api/bookings/<int:bid>/cancel", methods=["PUT"])
@login_required
def cancel_booking(bid):
    booking = Booking.query.get_or_404(bid)
    if booking.user_id != request.current_user.id:
        return jsonify({"error": "Not your booking"}), 403
    if booking.status == "Cancelled":
        return jsonify({"error": "Already cancelled"}), 400
    booking.status = "Cancelled"
    booking.trek.available_slots += 1
    db.session.commit()
    _clear_trek_cache(booking.trek_id)
    return jsonify(booking.to_dict())


@user_bp.route("/api/bookings/my", methods=["GET"])
@login_required
def my_bookings():
    bookings = Booking.query.filter_by(user_id=request.current_user.id, status="Booked").all()
    return jsonify([b.to_dict() for b in bookings])


@user_bp.route("/api/bookings/history", methods=["GET"])
@login_required
def booking_history():
    bookings = Booking.query.filter_by(user_id=request.current_user.id).order_by(
        Booking.booking_date.desc()
    ).all()
    return jsonify([b.to_dict() for b in bookings])


@user_bp.route("/api/bookings/export", methods=["POST"])
@login_required
def export_bookings():
    """Triggers an async Celery job that writes a CSV of the user's booking history."""
    from tasks import export_csv_task
    task = export_csv_task.delay(request.current_user.id)
    return jsonify({"task_id": task.id})


@user_bp.route("/api/bookings/export/status/<task_id>", methods=["GET"])
@login_required
def export_status(task_id):
    from tasks import celery
    result = celery.AsyncResult(task_id)
    if result.ready():
        return jsonify({"status": "done", "file": result.result})
    return jsonify({"status": result.state.lower()})


@user_bp.route("/api/bookings/export/download/<task_id>", methods=["GET"])
@login_required
def download_export(task_id):
    from tasks import celery
    result = celery.AsyncResult(task_id)
    if not result.ready():
        return jsonify({"error": "Export not ready"}), 400
    filepath = result.result
    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "File not found"}), 404
    return send_file(filepath, as_attachment=True, download_name="booking_history.csv", mimetype="text/csv")
