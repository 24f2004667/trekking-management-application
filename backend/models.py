from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db=SQLAlchemy()

class User(db.Model):
    __tablename__ = "user"

    id=db.Column(db.Integer,primary_key=True)
    name=db.Column(db.String(100),nullable=False)
    email=db.Column(db.String(120),unique=True,nullable=False)
    password_hash=db.Column(db.String(256),nullable=False)
    role=db.Column(db.String(20),nullable=False,default="trekker")
    contact=db.Column(db.String(20),nullable=True)
    is_active=db.Column(db.Boolean,default=True)
    is_blacklisted=db.Column(db.Boolean,default=False)
    created_at=db.Column(db.DateTime,default=datetime.utcnow)

    treks_assigned=db.relationship("Trek",backref="staff",foreign_keys="Trek.assigned_staff_id")
    bookings=db.relationship("Booking",backref="user",foreign_keys="Booking.user_id")

    def set_password(self,pw):
        self.password_hash = generate_password_hash(pw)

    def check_password(self,pw):
        return check_password_hash(self.password_hash,pw)

    def to_dict(self):
        return {
            "id":self.id,
            "name":self.name,
            "email":self.email,
            "role":self.role,
            "contact":self.contact,
            "is_active":self.is_active,
            "is_blacklisted":self.is_blacklisted,
            "created_at":self.created_at.isoformat(),
            }


class Trek(db.Model):
    __tablename__ = "trek"

    id=db.Column(db.Integer,primary_key=True)
    name=db.Column(db.String(150),nullable=False)
    location=db.Column(db.String(150),nullable=False)
    difficulty=db.Column(db.String(20),nullable=False) 
    duration_days=db.Column(db.Integer,nullable=False)
    available_slots=db.Column(db.Integer,nullable=False)
    total_slots=db.Column(db.Integer,nullable=False)
    assigned_staff_id=db.Column(db.Integer,db.ForeignKey("user.id"),nullable=True)
    status=db.Column(db.String(20),nullable=False,default="Pending")
    start_date=db.Column(db.Date,nullable=True)
    end_date=db.Column(db.Date,nullable=True)
    description=db.Column(db.Text,nullable=True)
    created_at=db.Column(db.DateTime,default=datetime.utcnow)

    bookings=db.relationship("Booking", backref="trek", foreign_keys="Booking.trek_id", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id":self.id,
            "name":self.name,
            "location":self.location,
            "difficulty":self.difficulty,
            "duration_days":self.duration_days,
            "available_slots":self.available_slots,
            "total_slots":self.total_slots,
            "assigned_staff_id":self.assigned_staff_id,
            "assigned_staff_name":self.staff.name if self.staff else None,
            "status":self.status,
            "start_date":self.start_date.isoformat() if self.start_date else None,
            "end_date":self.end_date.isoformat() if self.end_date else None,
            "description":self.description,
            "created_at":self.created_at.isoformat(),
            }


class Booking(db.Model):
    __tablename__ = "booking"

    id=db.Column(db.Integer, primary_key=True)
    user_id=db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    trek_id=db.Column(db.Integer, db.ForeignKey("trek.id"), nullable=False)
    booking_date=db.Column(db.DateTime, default=datetime.utcnow)
    status=db.Column(db.String(20), nullable=False, default="Booked")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": self.user.name if self.user else None,
            "user_email": self.user.email if self.user else None,
            "trek_id": self.trek_id,
            "trek_name": self.trek.name if self.trek else None,
            "trek_location": self.trek.location if self.trek else None,
            "trek_start_date": self.trek.start_date.isoformat() if self.trek and self.trek.start_date else None,
            "trek_end_date": self.trek.end_date.isoformat() if self.trek and self.trek.end_date else None,
            "booking_date": self.booking_date.isoformat(),
            "status": self.status,
        }
