from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required
from app.models import Attendance, Student
from app.utils.decorators import role_required
import os

reports_bp = Blueprint("reports", __name__)


@reports_bp.route("/export/excel", methods=["GET"])
@jwt_required()
def export_excel():
    """Export attendance as Excel. Filters: class, start_date, end_date, subject."""
    import pandas as pd
    from datetime import datetime

    query = Attendance.query.join(Student)
    if cls := request.args.get("class"):
        query = query.filter(Student.class_name == cls)
    if start := request.args.get("start_date"):
        query = query.filter(Attendance.date >= start)
    if end := request.args.get("end_date"):
        query = query.filter(Attendance.date <= end)
    if subj := request.args.get("subject"):
        query = query.filter(Attendance.subject == subj)

    records = query.order_by(Attendance.date, Student.class_name, Student.name).all()

    data = [{
        "Student ID": r.student.student_id,
        "Name": r.student.name,
        "Class": r.student.class_name,
        "Date": r.date.isoformat(),
        "Subject": r.subject,
        "Status": r.status.capitalize(),
        "Note": r.note or "",
    } for r in records]

    df = pd.DataFrame(data)
    filename = f"attendance_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    filepath = os.path.join(current_app.config["EXPORT_FOLDER"], filename)

    with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Attendance")
        # Summary sheet
        if not df.empty:
            summary = df.groupby(["Student ID", "Name", "Class"])["Status"].apply(
                lambda x: round((x == "Present").sum() / len(x) * 100, 2)
            ).reset_index()
            summary.columns = ["Student ID", "Name", "Class", "Attendance %"]
            summary.to_excel(writer, index=False, sheet_name="Summary")

    return send_file(filepath, as_attachment=True, download_name=filename)


@reports_bp.route("/export/pdf", methods=["GET"])
@jwt_required()
def export_pdf():
    """Export attendance report as PDF."""
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from datetime import datetime

    query = Attendance.query.join(Student)
    if cls := request.args.get("class"):
        query = query.filter(Student.class_name == cls)
    if start := request.args.get("start_date"):
        query = query.filter(Attendance.date >= start)
    if end := request.args.get("end_date"):
        query = query.filter(Attendance.date <= end)

    records = query.order_by(Attendance.date, Student.name).all()

    filename = f"attendance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    filepath = os.path.join(current_app.config["EXPORT_FOLDER"], filename)

    doc = SimpleDocTemplate(filepath, pagesize=landscape(A4))
    styles = getSampleStyleSheet()
    elements = []

    # Title
    elements.append(Paragraph("Attendance Management System — Report", styles["Title"]))
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%d %B %Y, %I:%M %p')}", styles["Normal"]))
    elements.append(Spacer(1, 0.2 * inch))

    # Table
    table_data = [["Student ID", "Name", "Class", "Date", "Subject", "Status"]]
    for r in records:
        table_data.append([
            r.student.student_id,
            r.student.name,
            r.student.class_name,
            r.date.strftime("%d %b %Y"),
            r.subject,
            r.status.capitalize(),
        ])

    table = Table(table_data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f4f8")]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cccccc")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(table)
    doc.build(elements)

    return send_file(filepath, as_attachment=True, download_name=filename)


@reports_bp.route("/summary", methods=["GET"])
@jwt_required()
def class_summary():
    """Class-wise attendance summary for charts."""
    students = Student.query.filter_by(is_active=True).all()
    class_data = {}

    for s in students:
        cls = s.class_name
        total = len(s.attendances)
        present = sum(1 for a in s.attendances if a.status == "present")
        if cls not in class_data:
            class_data[cls] = {"total": 0, "present": 0, "count": 0}
        class_data[cls]["total"] += total
        class_data[cls]["present"] += present
        class_data[cls]["count"] += 1

    result = []
    for cls, d in class_data.items():
        result.append({
            "class": cls,
            "students": d["count"],
            "pct": round((d["present"] / d["total"] * 100), 1) if d["total"] > 0 else 0,
        })

    return jsonify(sorted(result, key=lambda x: x["class"]))
