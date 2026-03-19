from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_migrate import Migrate
import os

db = SQLAlchemy()
jwt = JWTManager()
migrate = Migrate()


def create_app(config_name="default"):
    app = Flask(__name__)

    from config import config
    app.config.from_object(config[config_name])

    # Ensure upload/export dirs exist
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(app.config["EXPORT_FOLDER"], exist_ok=True)

    # Extensions
    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)
    CORS(app, origins=["http://localhost:5173", "http://localhost:3000"])

    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.attendance import attendance_bp
    from app.routes.students import students_bp
    from app.routes.reports import reports_bp
    from app.routes.sms import sms_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(attendance_bp, url_prefix="/api/attendance")
    app.register_blueprint(students_bp, url_prefix="/api/students")
    app.register_blueprint(reports_bp, url_prefix="/api/reports")
    app.register_blueprint(sms_bp, url_prefix="/api/sms")

    # Health check
    @app.route("/api/health")
    def health():
        return {"status": "ok", "version": "1.0.0"}

    return app
