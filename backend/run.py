from app import create_app, db
import os

app = create_app(os.getenv("FLASK_ENV", "development"))


@app.cli.command("init-db")
def init_db():
    """Initialize the database and create a default admin user."""
    with app.app_context():
        db.create_all()
        from app.models import User
        if not User.query.filter_by(email="admin@trust.edu").first():
            admin = User(name="Admin", email="admin@trust.edu", role="admin")
            admin.set_password("Admin@1234")
            db.session.add(admin)
            db.session.commit()
            print("Default admin created: admin@trust.edu / Admin@1234")
        else:
            print("Database already initialized.")


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
