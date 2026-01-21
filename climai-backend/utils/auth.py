import os
import datetime as dt
from typing import Optional, Dict, Any

import jwt
from passlib.context import CryptContext
from dotenv import load_dotenv


# Support multiple hashing schemes so we can migrate off problematic bcrypt builds.
# New hashes will use pbkdf2_sha256; existing bcrypt hashes still verify if backend works.
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256", "bcrypt"],
    default="pbkdf2_sha256",
    deprecated="auto",
)


def get_secret() -> str:
    # Load .env from backend directory explicitly
    backend_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
    load_dotenv(dotenv_path=backend_env, override=False)
    return os.getenv("SECRET_KEY", "dev-secret")


def hash_password(password: str) -> str:
    # Truncate overly long passwords for bcrypt compatibility edge cases (>72 bytes)
    if len(password) > 200:  # hard cap to avoid abuse
        password = password[:200]
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    # If bcrypt backend is broken, pbkdf2 hashes still work; bcrypt hashes may raise.
    try:
        return pwd_context.verify(password, password_hash)
    except ValueError:
        # Bcrypt failure due to backend bug or length; deny auth gracefully.
        return False


def create_access_token(user_id: str, email: str, expires_minutes: int = 60 * 24) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": dt.datetime.utcnow() + dt.timedelta(minutes=expires_minutes),
        "iat": dt.datetime.utcnow(),
        "type": "access",
    }
    token = jwt.encode(payload, get_secret(), algorithm="HS256")
    return token


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        data = jwt.decode(token, get_secret(), algorithms=["HS256"])
        return data
    except Exception:
        return None
