from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
from app import db
from app.models import Student
from app.utils.decorators import role_required

students_bp = Blueprint("students", __name__)


@students_bp.route("/", methods=["GET"])
@jwt_required()
def list_students():
    cls = request.args.get("class")
    query = Student.query.filter_by(is_active=True)
    if cls:
        query = query.filter_by(class_name=cls)
    students = query.order_by(Student.class_name, Student.name).all()
    include_stats = request.args.get("stats") == "true"
    return jsonify([s.to_dict(include_stats=include_stats) for s in students])


@students_bp.route("/<int:student_db_id>", methods=["GET"])
@jwt_required()
def get_student(student_db_id):
    s = Student.query.get_or_404(student_db_id)
    return jsonify(s.to_dict(include_stats=True))


@students_bp.route("/", methods=["POST"])
@role_required("admin", "teacher")
def create_student():
    data = request.get_json()
    required = ["student_id", "name", "class_name"]
    if not all(k in data for k in required):
        return jsonify({"error": "Missing required fields"}), 400

    if Student.query.filter_by(student_id=data["student_id"]).first():
        return jsonify({"error": "Student ID already exists"}), 409

    s = Student(
        student_id=data["student_id"],
        name=data["name"],
        class_name=data["class_name"],
        section=data.get("section"),
        parent_phone=data.get("parent_phone"),
        parent_name=data.get("parent_name"),
        email=data.get("email"),
    )
    db.session.add(s)
    db.session.commit()

    # Generate QR code for student
    try:
        from app.services.qr_service import generate_student_qr
        generate_student_qr(s, current_app.config["UPLOAD_FOLDER"])
        db.session.commit()
    except Exception as e:
        current_app.logger.warning(f"QR generation failed: {e}")

    return jsonify(s.to_dict()), 201


@students_bp.route("/<int:student_db_id>", methods=["PUT"])
@role_required("admin", "teacher")
def update_student(student_db_id):
    s = Student.query.get_or_404(student_db_id)
    data = request.get_json()
    updatable = ["name", "class_name", "section", "parent_phone", "parent_name", "email"]
    for field in updatable:
        if field in data:
            setattr(s, field, data[field])
    db.session.commit()
    return jsonify(s.to_dict())


@students_bp.route("/<int:student_db_id>", methods=["DELETE"])
@role_required("admin")
def delete_student(student_db_id):
    s = Student.query.get_or_404(student_db_id)
    s.is_active = False  # soft delete
    db.session.commit()
    return jsonify({"message": "Student deactivated"})


@students_bp.route("/import-excel", methods=["POST"])
@role_required("admin", "teacher")
def import_from_excel():
    """Import students from uploaded Excel file."""
    from app.services.excel_service import import_students_from_excel
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files["file"]
    import os
    path = os.path.join(current_app.config["UPLOAD_FOLDER"], file.filename)
    file.save(path)
    result = import_students_from_excel(path)
    return jsonify(result)


@students_bp.route("/classes", methods=["GET"])
@jwt_required()
def list_classes():
    classes = db.session.query(Student.class_name).distinct().all()
    return jsonify([c[0] for c in classes])
@students_bp.route("/<int:student_db_id>/upload-face", methods=["POST"])
@role_required("admin", "teacher")
def upload_face(student_db_id):
    """Save student face photo for recognition."""
    import os, base64
    s = Student.query.get_or_404(student_db_id)
    data = request.get_json()
    img_data = data.get("image", "")
    if "," in img_data:
        img_data = img_data.split(",")[1]
    folder = os.path.join(current_app.config["UPLOAD_FOLDER"], "faces")
    os.makedirs(folder, exist_ok=True)
    filepath = os.path.join(folder, f"{s.student_id}.jpg")
    with open(filepath, "wb") as f:
        f.write(base64.b64decode(img_data))
    s.face_encoding = filepath
    from app import db
    db.session.commit()
    return jsonify({"message": "Face saved", "student": s.name})


@students_bp.route("/faces", methods=["GET"])
@jwt_required()
def list_faces():
    """Return all students with registered faces."""
    import os
    students = Student.query.filter(Student.face_encoding.isnot(None)).all()
    result = []
    for s in students:
        if s.face_encoding and os.path.exists(s.face_encoding):
            result.append({
                "student_id": s.student_id,
                "name": s.name,
                "class_name": s.class_name,
                "face_path": f"/api/students/face-image/{s.student_id}"
            })
    return jsonify(result)


@students_bp.route("/face-image/<student_id>", methods=["GET"])
def get_face_image(student_id):
    """Serve face image for a student."""
    import os
    from flask import send_file
    s = Student.query.filter_by(student_id=student_id).first_or_404()
    if s.face_encoding and os.path.exists(s.face_encoding):
        return send_file(s.face_encoding, mimetype="image/jpeg")
    return jsonify({"error": "No face registered"}), 404
