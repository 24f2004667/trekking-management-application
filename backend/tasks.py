import os
import sys
import csv
import datetime

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from celery import Celery
from celery.schedules import crontab

from config import Config, BASE_DIR


def make_celery():
    celery = Celery("tma", broker=Config.CELERY_BROKER_URL, backend=Config.CELERY_RESULT_BACKEND)
    celery.conf.beat_schedule = {
        # Runs daily at 08:00 
        "daily-reminder": {
            "task": "tasks.daily_reminder_task",
            "schedule": crontab(hour=8, minute=0),
        },
        # Runs on the 1st of every month at 09:00
        "monthly-report": {
            "task": "tasks.monthly_report_task",
            "schedule": crontab(day_of_month=1, hour=9, minute=0),
        },
    }
    celery.conf.timezone = "Asia/Kolkata"
    return celery


celery = make_celery()

@celery.task(name="tasks.daily_reminder_task")
def daily_reminder_task():
    """Sends a reminder email to every trekker whose booked trek starts within 3 days."""
    print("[CELERY] daily_reminder_task started")
    from app import create_app
    app = create_app()
    with app.app_context():
        from models import Booking, Trek
        from flask_mail import Message
        from app import mail

        today = datetime.date.today()
        soon = today + datetime.timedelta(days=3)

        bookings = Booking.query.filter_by(status="Booked").join(Trek).filter(
            Trek.start_date <= soon, Trek.start_date >= today
        ).all()

        for b in bookings:
            recipient = b.user.email
            subject = f"TMA — Upcoming Trek Reminder: {b.trek.name}"
            html_body = f"""
            <h3>Hello {b.user.name},</h3>
            <p>This is a reminder that your upcoming trek <strong>{b.trek.name}</strong> is starting soon!</p>
            <ul>
              <li><strong>Location:</strong> {b.trek.location}</li>
              <li><strong>Difficulty:</strong> {b.trek.difficulty}</li>
              <li><strong>Start Date:</strong> {b.trek.start_date.strftime('%d %b %Y') if b.trek.start_date else '-'}</li>
              <li><strong>End Date:</strong> {b.trek.end_date.strftime('%d %b %Y') if b.trek.end_date else '-'}</li>
            </ul>
            <p>Please pack the necessary gear and arrive at the assembly point on time. Have a safe journey!</p>
            <p>Best regards,<br>TMA Team</p>
            """
            try:
                msg = Message(subject, recipients=[recipient], html=html_body)
                mail.send(msg)
                print(f"[REMINDER] Email sent to {recipient}")
            except Exception as e:
                print(f"[REMINDER] Could not email {recipient}: {e}\n[LOGGED] Subject: {subject}")

    print(f"[CELERY] daily_reminder_task done — processed {len(bookings)} bookings")
    return f"Processed {len(bookings)} reminders."


@celery.task(name="tasks.monthly_report_task")
def monthly_report_task():
    """Builds an HTML activity report for last month and emails it to the Admin."""
    print("[CELERY] monthly_report_task started")
    from app import create_app
    app = create_app()
    with app.app_context():
        from models import db, Trek, Booking, User
        from flask_mail import Message
        from app import mail
        from flask import render_template
        from sqlalchemy import func

        today = datetime.date.today()
        first_of_current = today.replace(day=1)
        last_of_prev = first_of_current - datetime.timedelta(days=1)
        first_of_prev = last_of_prev.replace(day=1)
        month_name = first_of_prev.strftime("%B %Y")

        total_treks = Trek.query.filter(
            Trek.start_date >= first_of_prev, Trek.start_date <= last_of_prev
        ).count()

        total_users = db.session.query(func.count(func.distinct(Booking.user_id))).filter(
            Booking.booking_date >= datetime.datetime.combine(first_of_prev, datetime.time.min),
            Booking.booking_date <= datetime.datetime.combine(last_of_prev, datetime.time.max),
            Booking.status.in_(["Booked", "Completed"]),
        ).scalar() or 0

        top = db.session.query(
            Trek.name, func.count(Booking.id).label("cnt")
        ).join(Booking).filter(
            Booking.booking_date >= datetime.datetime.combine(first_of_prev, datetime.time.min),
            Booking.booking_date <= datetime.datetime.combine(last_of_prev, datetime.time.max),
            Booking.status != "Cancelled",
        ).group_by(Trek.id).order_by(func.count(Booking.id).desc()).limit(3).all()

        top_treks_list = [{"name": r[0], "bookings": r[1]} for r in top]

        try:
            report_html = render_template(
                "monthly_report.html", month_name=month_name,
                total_treks=total_treks, total_users=total_users, top_treks=top_treks_list,
            )
        except Exception as te:
            print(f"[MONTHLY REPORT] template error: {te}, falling back to plain HTML")
            top_treks_html = "".join(
                "<li>{0}: {1} bookings</li>".format(t["name"], t["bookings"]) for t in top_treks_list
            )
            report_html = (
                f"<h2>TMA Monthly Report — {month_name}</h2>"
                f"<p>Treks: {total_treks}</p><p>Active Users: {total_users}</p>"
                f"<ul>{top_treks_html}</ul>"
            )

        admin_email = app.config.get("MAIL_DEFAULT_SENDER", "admin@tma.com")
        subject = f"TMA — Monthly Activity Report: {month_name}"
        try:
            msg = Message(subject, recipients=[admin_email], html=report_html)
            mail.send(msg)
            print(f"[MONTHLY REPORT] sent to {admin_email}")
        except Exception as e:
            print(f"[MONTHLY REPORT] could not email {admin_email}: {e}\n[LOGGED] {report_html[:200]}...")

    print("[CELERY] monthly_report_task done")
    return "Monthly report generated successfully."


@celery.task(bind=True, name="tasks.export_csv_task")
def export_csv_task(self, user_id):
    """Exports a trekker's booking history as a CSV file (user-triggered async job)."""
    print(f"[CELERY] export_csv_task started for user {user_id}")
    from app import create_app
    app = create_app()
    with app.app_context():
        from models import Booking, User

        user = User.query.get(user_id)
        user_name = user.name if user else f"User_{user_id}"
        bookings = Booking.query.filter_by(user_id=user_id).order_by(Booking.booking_date.desc()).all()

        export_dir = os.path.join(BASE_DIR, "instance", "exports")
        os.makedirs(export_dir, exist_ok=True)
        filename = os.path.join(export_dir, f"tma_export_{user_id}_{self.request.id}.csv")

        with open(filename, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["User ID", "User Name", "Trek Name", "Location", "Booking Status", "Booking Date", "Trek Start Date", "Trek End Date"])
            for b in bookings:
                writer.writerow([
                    user_id, user_name,
                    b.trek.name if b.trek else "Unknown Trek",
                    b.trek.location if b.trek else "Unknown Location",
                    b.status,
                    b.booking_date.strftime("%Y-%m-%d %H:%M:%S") if b.booking_date else "-",
                    b.trek.start_date.strftime("%Y-%m-%d") if b.trek and b.trek.start_date else "-",
                    b.trek.end_date.strftime("%Y-%m-%d") if b.trek and b.trek.end_date else "-",
                ])

    print(f"[CELERY] export_csv_task done for user {user_id} -> {filename}")
    return filename
