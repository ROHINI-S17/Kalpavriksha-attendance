from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from datetime import date, datetime
from app import db
from app.models import Attendance, Student
from app.utils.decorators import role_required
from app.services.sms_service import send_absent_sms, check_and_alert_threshold

attendance_bp = Blueprint("attendance", __name__)


@attendance_bp.route("/mark", methods=["POST"])
@jwt_required()
def mark_attendance():
    """Mark attendance for one or multiple students."""
    data = request.get_json()
    user_id = int(get_jwt_identity())
    records = data.get("records", [])  # [{student_id, status, subject, date, note}]

    if not records:
        return jsonify({"error": "No records provided"}), 400

    created, updated = 0, 0
    absent_students = []

    for r in records:
        student = Student.query.filter_by(student_id=r["student_id"]).first()
        if not student:
            continue

        att_date = datetime.strptime(r.get("date", date.today().isoformat()), "%Y-%m-%d").date()
        subject = r.get("subject", "General")
        status = r.get("status", "absent")

        existing = Attendance.query.filter_by(
            student_id=student.id, date=att_date, subject=subject
        ).first()

        if existing:
            existing.status = status
            existing.marked_by = user_id
            existing.note = r.get("note")
            updated += 1
        else:
            att = Attendance(
                student_id=student.id,
                date=att_date,
                subject=subject,
                status=status,
                marked_by=user_id,
                note=r.get("note"),
            )
            db.session.add(att)
            created += 1

        if status == "absent" and student.parent_phone:
            absent_students.append(student)

    db.session.commit()

    # Send SMS notifications asynchronously (fire and forget style)
    for student in absent_students:
        try:
            send_absent_sms(student, att_date)
        except Exception as e:
            current_app.logger.error(f"SMS failed for {student.name}: {e}")

    # Check threshold alerts
    for r in records:
        student = Student.query.filter_by(student_id=r["student_id"]).first()
        if student:
            try:
                check_and_alert_threshold(student, current_app.config["ATTENDANCE_THRESHOLD"])
            except Exception as e:
                current_app.logger.error(f"Threshold check failed: {e}")

    return jsonify({"created": created, "updated": updated, "sms_sent": len(absent_students)})


@attendance_bp.route("/", methods=["GET"])
@jwt_required()
def get_attendance():
    """Get attendance with filters: date, class, subject, student_id."""
    claims = get_jwt()
    user_role = claims.get("role")

    query = Attendance.query.join(Student)

    # Students only see their own records
    if user_role == "student":
        user_id = int(get_jwt_identity())
        student = Student.query.filter_by(email=claims.get("email")).first()
        if student:
            query = query.filter(Attendance.student_id == student.id)

    # Filters
    if d := request.args.get("date"):
        query = query.filter(Attendance.date == d)
    if cls := request.args.get("class"):
        query = query.filter(Student.class_name == cls)
    if subj := request.args.get("subject"):
        query = query.filter(Attendance.subject == subj)
    if sid := request.args.get("student_id"):
        student = Student.query.filter_by(student_id=sid).first()
        if student:
            query = query.filter(Attendance.student_id == student.id)
    if start := request.args.get("start_date"):
        query = query.filter(Attendance.date >= start)
    if end := request.args.get("end_date"):
        query = query.filter(Attendance.date <= end)

    records = query.order_by(Attendance.date.desc()).all()
    return jsonify([r.to_dict() for r in records])


@attendance_bp.route("/stats", methods=["GET"])
@jwt_required()
def get_stats():
    """Dashboard stats: total, present today, absent today, overall %."""
    today = date.today()
    total_students = Student.query.filter_by(is_active=True).count()
    today_records = Attendance.query.filter_by(date=today).all()

    present_today = sum(1 for r in today_records if r.status == "present")
    absent_today = sum(1 for r in today_records if r.status == "absent")

    all_records = Attendance.query.all()
    total = len(all_records)
    present_all = sum(1 for r in all_records if r.status == "present")
    overall_pct = round((present_all / total * 100), 1) if total > 0 else 0

    # Weekly trend (last 7 days)
    from datetime import timedelta
    weekly = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        day_records = Attendance.query.filter_by(date=d).all()
        day_total = len(day_records)
        day_present = sum(1 for r in day_records if r.status == "present")
        weekly.append({
            "date": d.isoformat(),
            "day": d.strftime("%a"),
            "present": day_present,
            "absent": day_total - day_present,
            "pct": round((day_present / day_total * 100), 1) if day_total > 0 else 0,
        })

    return jsonify({
        "total_students": total_students,
        "present_today": present_today,
        "absent_today": absent_today,
        "overall_pct": overall_pct,
        "weekly_trend": weekly,
    })


@attendance_bp.route("/bulk-upload", methods=["POST"])
@role_required("admin", "teacher")
def bulk_upload():
    """Upload Excel file and sync attendance records."""
    from app.services.excel_service import parse_attendance_excel
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename.endswith((".xlsx", ".xls")):
        return jsonify({"error": "Only Excel files accepted"}), 400

    import os
    path = os.path.join(current_app.config["UPLOAD_FOLDER"], file.filename)
    file.save(path)

    result = parse_attendance_excel(path)
    return jsonify(result)
