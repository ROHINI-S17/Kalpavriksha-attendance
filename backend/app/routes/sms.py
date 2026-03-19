from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.models import Student
from app.services.sms_service import send_sms_to_number
from app.utils.decorators import role_required

sms_bp = Blueprint("sms", __name__)


@sms_bp.route("/send", methods=["POST"])
@role_required("admin")
def send_manual_sms():
    """Admin can manually send SMS to a student's parent."""
    data = request.get_json()
    student = Student.query.filter_by(student_id=data.get("student_id")).first()
    if not student:
        return jsonify({"error": "Student not found"}), 404
    if not student.parent_phone:
        return jsonify({"error": "No parent phone on record"}), 400

    message = data.get("message", f"Dear Parent, this is a message regarding {student.name}'s attendance.")
    result = send_sms_to_number(student.parent_phone, message)
    return jsonify({"sent": result, "phone": student.parent_phone})
