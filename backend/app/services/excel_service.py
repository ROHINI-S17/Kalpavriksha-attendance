"""
Excel Service — pandas-based import/export for students and attendance.
"""
import pandas as pd
from datetime import datetime
from app import db
from app.models import Student, Attendance


def import_students_from_excel(filepath: str) -> dict:
    try:
        df = pd.read_excel(filepath)
    except Exception as e:
        return {"error": f"Could not read file: {str(e)}"}

    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]

    print("DEBUG columns:", list(df.columns))
    print("DEBUG first row:", df.iloc[0].to_dict() if len(df) > 0 else "empty")

    created, updated, errors = 0, 0, []

    for idx, row in df.iterrows():
        try:
            def get(row, *keys):
                for k in keys:
                    if k in row and pd.notna(row[k]) and str(row[k]).strip() not in ('', 'nan'):
                        return str(row[k]).strip()
                return ''

            sid = get(row, 'student_id', 'studentid', 'id', 's.no', 'sno', 'roll_no', 'rollno')
            name = get(row, 'name', 'student_name', 'studentname', 'full_name')
            cls = get(row, 'class_name', 'class', 'std', 'standard', 'grade')

            if not sid or not name or not cls:
                errors.append(f"Row {idx+2}: Missing student_id='{sid}', name='{name}', class='{cls}'")
                continue

            parent_phone = get(row, 'parent_phone', 'parentphone', 'phone', 'mobile', 'mb-parents', 'mb_parents', 'contact', 'parent_mobile')
            parent_name = get(row, 'parent_name', 'parentname', 'father_name', 'father', 'guardian')
            section = get(row, 'section', 'sec')
            email = get(row, 'email', 'email_id', 'emailid')

            student = Student.query.filter_by(student_id=sid).first()
            if student:
                student.name = name
                student.class_name = cls
                student.section = section or None
                student.parent_phone = parent_phone or None
                student.parent_name = parent_name or None
                student.email = email or None
                updated += 1
            else:
                student = Student(
                    student_id=sid,
                    name=name,
                    class_name=cls,
                    section=section or None,
                    parent_phone=parent_phone or None,
                    parent_name=parent_name or None,
                    email=email or None,
                )
                db.session.add(student)
                created += 1

        except Exception as e:
            errors.append(f"Row {idx+2}: {str(e)}")

    db.session.commit()
    return {"created": created, "updated": updated, "errors": errors[:10]}


def parse_attendance_excel(filepath: str) -> dict:
    try:
        df = pd.read_excel(filepath)
    except Exception as e:
        return {"error": f"Could not read file: {str(e)}"}

    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    created, updated, errors = 0, 0, []

    for idx, row in df.iterrows():
        try:
            def get(row, *keys):
                for k in keys:
                    if k in row and pd.notna(row[k]) and str(row[k]).strip() not in ('', 'nan'):
                        return str(row[k]).strip()
                return ''

            sid = get(row, 'student_id', 'studentid', 'id')
            raw_date = row.get("date", "")
            subject = get(row, 'subject') or "General"
            status = get(row, 'status') or "absent"

            if status not in ("present", "absent", "late"):
                status = "absent"

            if isinstance(raw_date, datetime):
                att_date = raw_date.date()
            else:
                att_date = datetime.strptime(str(raw_date).strip(), "%Y-%m-%d").date()

            student = Student.query.filter_by(student_id=sid).first()
            if not student:
                errors.append(f"Row {idx+2}: Student ID '{sid}' not found")
                continue

            existing = Attendance.query.filter_by(
                student_id=student.id, date=att_date, subject=subject
            ).first()

            if existing:
                existing.status = status
                updated += 1
            else:
                att = Attendance(student_id=student.id, date=att_date, subject=subject, status=status)
                db.session.add(att)
                created += 1

        except Exception as e:
            errors.append(f"Row {idx+2}: {str(e)}")

    db.session.commit()
    return {"created": created, "updated": updated, "errors": errors[:10]}