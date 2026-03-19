"""
SMS Service — supports Twilio (global) and Fast2SMS (India).
Set SMS_PROVIDER env var to "twilio" or "fast2sms".
"""
import os
import requests
from flask import current_app


def send_sms_to_number(phone: str, message: str) -> bool:
    """Core SMS dispatch — picks provider from config."""
    provider = current_app.config.get("SMS_PROVIDER", "twilio")
    try:
        if provider == "fast2sms":
            return _send_fast2sms(phone, message)
        return _send_twilio(phone, message)
    except Exception as e:
        current_app.logger.error(f"SMS error: {e}")
        return False


def _send_twilio(phone: str, message: str) -> bool:
    from twilio.rest import Client
    sid = current_app.config["TWILIO_ACCOUNT_SID"]
    token = current_app.config["TWILIO_AUTH_TOKEN"]
    from_number = current_app.config["TWILIO_PHONE_NUMBER"]
    if not sid or not token:
        current_app.logger.warning("Twilio credentials not set — SMS skipped")
        return False
    client = Client(sid, token)
    client.messages.create(body=message, from_=from_number, to=phone)
    return True


def _send_fast2sms(phone: str, message: str) -> bool:
    api_key = current_app.config["FAST2SMS_API_KEY"]
    if not api_key:
        current_app.logger.warning("Fast2SMS API key not set — SMS skipped")
        return False
    resp = requests.post(
        "https://www.fast2sms.com/dev/bulkV2",
        headers={"authorization": api_key},
        json={
            "route": "q",
            "message": message,
            "language": "english",
            "flash": 0,
            "numbers": phone.lstrip("+").replace(" ", ""),
        },
        timeout=10,
    )
    return resp.status_code == 200


def send_absent_sms(student, att_date) -> bool:
    """Send SMS to parent when student is marked absent."""
    if not student.parent_phone:
        return False
    parent = student.parent_name or "Parent"
    msg = (
        f"Dear {parent}, your ward {student.name} (ID: {student.student_id}, "
        f"Class: {student.class_name}) was marked ABSENT on "
        f"{att_date.strftime('%d %b %Y')}. "
        f"Please contact the school for details. — Attendance System"
    )
    return send_sms_to_number(student.parent_phone, msg)


def check_and_alert_threshold(student, threshold: float = 75.0) -> bool:
    """Send SMS if student's attendance falls below threshold."""
    from app.models import Attendance
    records = Attendance.query.filter_by(student_id=student.id).all()
    total = len(records)
    if total == 0 or not student.parent_phone:
        return False
    present = sum(1 for r in records if r.status == "present")
    pct = (present / total) * 100
    if pct < threshold:
        parent = student.parent_name or "Parent"
        msg = (
            f"Dear {parent}, {student.name}'s attendance is {pct:.1f}%, "
            f"which is below the required {threshold:.0f}%. "
            f"Please ensure regular attendance. — Attendance System"
        )
        return send_sms_to_number(student.parent_phone, msg)
    return False
