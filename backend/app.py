import os
from flask import Flask, send_from_directory, request, jsonify
from flask_mail import Mail
from flask_cors import CORS
from config import Config
from models import db, User

mail = Mail()
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    mail.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    from auth import auth_bp
    from admin_routes import admin_bp
    from staff_routes import staff_bp
    from user_routes import user_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(staff_bp)
    app.register_blueprint(user_bp)

    @app.errorhandler(404)
    def not_found(error):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Not found"}), 404
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.errorhandler(500)
    def internal_error(error):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Internal server error"}), 500
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        if path.startswith("api/"):
            return jsonify({"error": "Not found"}), 404
        full_path = os.path.join(FRONTEND_DIR, path)
        if path and os.path.exists(full_path):
            resp = send_from_directory(FRONTEND_DIR, path)
        else:
            resp = send_from_directory(FRONTEND_DIR, "index.html")
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        return resp

    with app.app_context():
        db.create_all()
        if not User.query.filter_by(role="admin").first():
            admin = User(name="Admin", email="admin@tma.com", role="admin")
            admin.set_password("admin123")
            db.session.add(admin)
            db.session.commit()
            print("Default admin created -> email: admin@tma.com | password: admin123")

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
