from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import os
import logging

from utils.db import init_mongo, get_collections, get_client


def create_app() -> Flask:
    """Application factory for the Climaiview backend."""
    # Load .env from backend directory explicitly so running from project root works
    env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".env"))
    load_dotenv(dotenv_path=env_path, override=False)

    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret")

    # Ensure model instrumentation logs appear even when running via python app.py
    app.logger.setLevel(logging.INFO)
    logging.getLogger("werkzeug").setLevel(logging.INFO)

    # CORS for frontend dev server(s). Support comma-separated origins.
    raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:8080")
    origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    if not origins:
        origins = ["http://localhost:8080"]
    CORS(app, resources={r"/api/*": {"origins": origins}})

    @app.get("/api/health")
    def health():
        cols = get_collections()
        mongo_ok = bool(cols)
        ping = "not-initialized"
        if mongo_ok:
            try:
                client = get_client()
                if client is not None:
                    client.admin.command("ping")
                    ping = "ok"
                else:
                    ping = "no-client"
            except Exception as e:
                ping = f"error: {e}"
        return {
            "status": "ok",
            "service": "climai-backend",
            "mongo": mongo_ok,
            "mongoPing": ping,
            "collections": list(cols.keys()) if cols else [],
            "allowedOrigins": origins,
            "mongoUriPresent": bool(os.getenv("MONGO_URI")),
            "envFile": env_path if os.path.exists(env_path) else None,
        }

    # Register blueprints
    from routes.auth import auth_bp
    from routes.weather import weather_bp
    from routes.carbon import carbon_bp
    from routes.region import region_bp
    from routes.chat import chat_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(weather_bp, url_prefix="/api/weather")
    app.register_blueprint(carbon_bp, url_prefix="/api/carbon")
    app.register_blueprint(region_bp, url_prefix="/api/region")
    app.register_blueprint(chat_bp, url_prefix="/api/chat")

    # Initialize Mongo (optional if MONGO_URI not set)
    mongo_cols = init_mongo()
    if mongo_cols:
        app.config["MONGO_COLLECTIONS"] = mongo_cols
    else:
        # If no URI, keep running without DB rather than failing hard.
        app.logger.info("MongoDB not initialized: MONGO_URI not provided.")

    # Warm-load ML artifacts on startup (non-fatal if missing)
    try:
        from utils.model_artifacts import get_all, artifacts_present
        arts = get_all()
        present = artifacts_present()
        app.logger.info("ML artifacts loaded: present=%s", present)
        model_obj = arts.get("model") if isinstance(arts, dict) else None
        if present.get("model") and model_obj is not None:
            app.logger.info("Carbon footprint model artifact detected and ready for use (%s).", type(model_obj).__name__)
        elif present.get("model"):
            app.logger.info("Carbon footprint model artifact detected but not yet loaded into memory.")
        else:
            app.logger.warning("Carbon footprint model artifact missing; predictions will fall back or fail.")
        app.config["ML_ARTIFACTS"] = arts
    except Exception as e:
        app.logger.warning("ML artifacts not loaded: %s", e)

    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("PORT", "5001"))
    debug = os.getenv("FLASK_DEBUG", "1") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
