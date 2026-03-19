from app import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime


class User(db.Model):
    """Auth users: admin, teacher, student"""
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="student")  # admin | teacher | student
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
        }


class Student(db.Model):
    """Student profile loaded from Excel or added manually"""
    __tablename__ = "students"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.String(50), unique=True, nullable=False)  # e.g. "STU001"
    name = db.Column(db.String(120), nullable=False)
    class_name = db.Column(db.String(50), nullable=False)       # e.g. "10A"
    section = db.Column(db.String(20), nullable=True)
    parent_phone = db.Column(db.String(20), nullable=True)       # for SMS
    parent_name = db.Column(db.String(120), nullable=True)
    email = db.Column(db.String(120), nullable=True)
    face_encoding = db.Column(db.Text, nullable=True)            # JSON array for OpenCV
    qr_code_path = db.Column(db.String(256), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    attendances = db.relationship("Attendance", backref="student", lazy=True, cascade="all, delete-orphan")

    def to_dict(self, include_stats=False):
        data = {
            "id": self.id,
            "student_id": self.student_id,
            "name": self.name,
            "class_name": self.class_name,
            "section": self.section,
            "parent_phone": self.parent_phone,
            "parent_name": self.parent_name,
            "email": self.email,
            "is_active": self.is_active,
        }
        if include_stats:
            total = len(self.attendances)
            present = sum(1 for a in self.attendances if a.status == "present")
            data["total_classes"] = total
            data["present_count"] = present
            data["attendance_pct"] = round((present / total * 100), 2) if total > 0 else 0
        return data


class Attendance(db.Model):
    """One record per student per subject per date"""
    __tablename__ = "attendance"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)
    date = db.Column(db.Date, nullable=False)
    subject = db.Column(db.String(80), nullable=True, default="General")
    status = db.Column(db.String(10), nullable=False, default="absent")  # present | absent | late
    marked_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    marked_at = db.Column(db.DateTime, default=datetime.utcnow)
    note = db.Column(db.String(256), nullable=True)

    __table_args__ = (
        db.UniqueConstraint("student_id", "date", "subject", name="uix_student_date_subject"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student.student_id,
            "student_name": self.student.name,
            "class_name": self.student.class_name,
            "date": self.date.isoformat(),
            "subject": self.subject,
            "status": self.status,
            "note": self.note,
            "marked_at": self.marked_at.isoformat() if self.marked_at else None,
        }
