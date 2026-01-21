import os
from typing import Optional, Dict, Any

from dotenv import load_dotenv

try:
    from pymongo import MongoClient
    from pymongo.server_api import ServerApi
except Exception:  # pragma: no cover - allow project to run without pymongo installed yet
    MongoClient = None  # type: ignore
    ServerApi = None  # type: ignore


_client: Optional[MongoClient] = None  # type: ignore
_db = None
_collections: Optional[Dict[str, Any]] = None


def init_mongo(uri: Optional[str] = None, db_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Initialize a MongoDB client and prepare named collections.

    Reads MONGO_URI and MONGO_DB from environment if not provided.
    Returns a dict of collections on success, or None if URI is not configured.
    """
    global _client, _db, _collections

    # Load .env located in the backend folder explicitly to avoid CWD issues
    backend_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
    load_dotenv(dotenv_path=backend_env, override=False)

    uri = uri or os.getenv("MONGO_URI")
    db_name = db_name or os.getenv("MONGO_DB", "climai")

    if not uri:
        # No URI configured; skip initialization gracefully
        return None

    if MongoClient is None:
        raise RuntimeError("pymongo is not installed. Please install dependencies from requirements.txt")

    # Use stable server API for Atlas and SRV URIs; also works for localhost
    _client = MongoClient(uri, server_api=ServerApi("1"), connectTimeoutMS=10000)
    _db = _client[db_name]
    _collections = {
        "users": _db["users"],
        "climate_data": _db["climate_data"],
        "carbon_footprint": _db["carbon_footprint"],
    }

    # Optional: light connectivity check (won't raise on missing network if skipped by caller)
    try:
        _client.admin.command("ping")
        # Ensure index for users.email
        _collections["users"].create_index("email", unique=True)
    except Exception:
        # Leave initialization in place; caller can handle connectivity errors later
        pass

    return _collections


def get_client() -> Optional[MongoClient]:  # type: ignore
    return _client


def get_db():
    return _db


def get_collections() -> Optional[Dict[str, Any]]:
    return _collections
