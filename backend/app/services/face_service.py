"""
Face Recognition Service — OpenCV + face_recognition library.
Install: pip install face-recognition opencv-python-headless
Note: face_recognition requires dlib which needs cmake. 
Alternative: use deepface (pip install deepface) for easier setup.
"""
import json
import numpy as np


def encode_face_from_image(image_path: str) -> list | None:
    """Extract face encoding from a student's photo. Returns list or None."""
    try:
        import face_recognition
        image = face_recognition.load_image_file(image_path)
        encodings = face_recognition.face_encodings(image)
        if encodings:
            return encodings[0].tolist()
    except Exception as e:
        print(f"Face encoding error: {e}")
    return None


def identify_student_from_frame(frame, students_with_encodings: list) -> dict | None:
    """
    Compare a webcam frame against known student encodings.
    students_with_encodings: list of {"student_id": ..., "encoding": [...]}
    Returns matched student dict or None.
    """
    try:
        import face_recognition
        rgb_frame = frame[:, :, ::-1]  # BGR to RGB
        face_locations = face_recognition.face_locations(rgb_frame)
        face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)

        known_encodings = []
        student_ids = []
        for item in students_with_encodings:
            if item.get("encoding"):
                known_encodings.append(np.array(item["encoding"]))
                student_ids.append(item["student_id"])

        for face_encoding in face_encodings:
            matches = face_recognition.compare_faces(known_encodings, face_encoding, tolerance=0.5)
            if True in matches:
                idx = matches.index(True)
                return {"student_id": student_ids[idx]}
    except Exception as e:
        print(f"Face recognition error: {e}")
    return None


def run_face_attendance_session(subject: str = "General") -> list:
    """
    Run a live webcam session for face-based attendance.
    Returns list of {"student_id": ..., "status": "present"}.
    Press 'q' to quit.
    """
    import cv2
    from app.models import Student
    from app import db

    students = Student.query.filter(Student.face_encoding.isnot(None)).all()
    students_data = [
        {"student_id": s.student_id, "encoding": json.loads(s.face_encoding)}
        for s in students
    ]

    cap = cv2.VideoCapture(0)
    marked = set()
    results = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        match = identify_student_from_frame(frame, students_data)
        if match and match["student_id"] not in marked:
            marked.add(match["student_id"])
            results.append({"student_id": match["student_id"], "status": "present"})
            cv2.putText(frame, f"Marked: {match['student_id']}", (50, 50),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        cv2.imshow("Face Attendance — Press Q to finish", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    return results
