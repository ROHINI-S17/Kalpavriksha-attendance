"""QR Code Service — generate and scan QR codes for attendance."""
import qrcode
import os
import json


def generate_student_qr(student, upload_folder: str) -> str:
    """Generate a QR code PNG for a student and save it. Returns file path."""
    payload = json.dumps({
        "student_id": student.student_id,
        "name": student.name,
        "class": student.class_name,
    })
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    filename = f"qr_{student.student_id}.png"
    filepath = os.path.join(upload_folder, filename)
    img.save(filepath)

    student.qr_code_path = filepath
    return filepath


def decode_qr_from_image(image_path: str) -> dict | None:
    """Decode QR code from an image file. Returns parsed payload or None."""
    try:
        from pyzbar.pyzbar import decode
        from PIL import Image
        img = Image.open(image_path)
        decoded = decode(img)
        if decoded:
            data = decoded[0].data.decode("utf-8")
            return json.loads(data)
    except Exception:
        pass
    return None
