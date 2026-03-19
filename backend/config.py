import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-change-in-prod")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///attendance.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt-secret-change-in-prod")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
    EXPORT_FOLDER = os.path.join(os.path.dirname(__file__), "exports")
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB

    # SMS — Twilio
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")

    # SMS — Fast2SMS (India, alternative to Twilio)
    FAST2SMS_API_KEY = os.getenv("FAST2SMS_API_KEY", "")
    SMS_PROVIDER = os.getenv("SMS_PROVIDER", "twilio")  # "twilio" or "fast2sms"

    ATTENDANCE_THRESHOLD = float(os.getenv("ATTENDANCE_THRESHOLD", "75.0"))


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_ECHO = False


class ProductionConfig(Config):
    DEBUG = False


config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
