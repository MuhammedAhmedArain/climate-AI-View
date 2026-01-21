from flask import Blueprint, request, current_app
from utils.helpers import json_response, error_response
from utils.db import get_collections
from pymongo.errors import DuplicateKeyError, ServerSelectionTimeoutError
from utils.auth import hash_password, verify_password, create_access_token, decode_token
from bson.objectid import ObjectId
import traceback
from datetime import datetime

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/signup")
def signup():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    city = (data.get("city") or "").strip()

    # ✅ Validate required fields
    if not name or not email or not password or not city:
        return error_response("Name, email, password and city are required", 400)

    cols = get_collections()
    if not cols:
        return error_response("Database not configured", 503)

    users = cols["users"]

    # ✅ Check if email already registered
    try:
        current_app.logger.info("Signup attempt email=%s", email)
        if users.find_one({"email": email}):
            return error_response("Email already registered", 409)
    except ServerSelectionTimeoutError:
        current_app.logger.exception("Mongo timeout on find_one during signup for %s", email)
        return error_response("Database unreachable (timeout)", 503)
    except Exception as e:
        current_app.logger.exception("Mongo error on find_one during signup for %s: %s", email, e)
        return error_response(f"Database error: {e}", 503)

    # ✅ Secure password handling
    try:
        # bcrypt supports up to 72 bytes; truncate longer passwords safely
        if len(password.encode("utf-8")) > 72:
            password = password[:72]

        password_hash = hash_password(password)
    except Exception as e:
        current_app.logger.exception("Password hashing failed for %s: %s", email, e)
        return error_response("Internal error hashing password", 500)

    # ✅ Prepare user document
    doc = {
        "name": name,
        "email": email,
        "password_hash": password_hash,
        "city": city,
        "created_at": datetime.utcnow(),
    }

    # ✅ Insert user into database
    try:
        res = users.insert_one(doc)
        user_id = str(res.inserted_id)
    except DuplicateKeyError:
        return error_response("Email already registered", 409)
    except ServerSelectionTimeoutError:
        current_app.logger.exception("Mongo timeout on insert_one during signup for %s", email)
        return error_response("Database unreachable (timeout)", 503)
    except Exception as e:
        current_app.logger.exception("Signup failed for %s: %s\n%s", email, e, traceback.format_exc())
        return error_response(f"Signup failed: {e}", 500)

    # ✅ Create token
    token = create_access_token(user_id, email)
    current_app.logger.info("Signup success email=%s id=%s", email, user_id)

    return json_response({
        "token": token,
        "user": {"id": user_id, "name": name, "email": email, "city": city},
    }, 201)


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return error_response("Email and password are required", 400)

    cols = get_collections()
    if not cols:
        return error_response("Database not configured", 503)

    users = cols["users"]

    try:
        current_app.logger.info("Login attempt email=%s", email)
        user = users.find_one({"email": email})
    except ServerSelectionTimeoutError:
        current_app.logger.exception("Mongo timeout on find_one during login for %s", email)
        return error_response("Database unreachable (timeout)", 503)
    except Exception as e:
        current_app.logger.exception("Mongo error on find_one during login for %s: %s", email, e)
        return error_response(f"Database error: {e}", 503)

    if not user or not verify_password(password, user.get("password_hash", "")):
        return error_response("Invalid credentials", 401)

    token = create_access_token(str(user["_id"]), email)
    current_app.logger.info("Login success email=%s id=%s", email, str(user["_id"]))

    return json_response({
        "token": token,
        "user": {"id": str(user["_id"]), "name": user.get("name"), "email": email, "city": user.get("city")},
    })


@auth_bp.get("/me")
def me():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return error_response("Missing bearer token", 401)

    token = auth.split(" ", 1)[1]
    payload = decode_token(token)
    if not payload:
        return error_response("Invalid or expired token", 401)

    cols = get_collections()
    if not cols:
        return error_response("Database not configured", 503)

    users = cols["users"]
    user = users.find_one({"_id": ObjectId(payload["sub"])})

    if not user:
        return error_response("User not found", 404)

    return json_response({
        "id": str(user["_id"]),
        "name": user.get("name"),
        "email": user.get("email"),
        "city": user.get("city"),
    })
