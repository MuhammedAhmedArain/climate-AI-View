import os
from flask import Blueprint, request
from utils.helpers import json_response, error_response
import requests
from utils.auth import decode_token
from utils.db import get_collections
from bson.objectid import ObjectId

weather_bp = Blueprint("weather", __name__)


@weather_bp.get("/current")
def current_weather():
    """Return current weather for a city. Uses OpenWeather if API key is set, else returns a mock."""
    city = request.args.get("city", "Lahore")
    api_key = os.getenv("OPENWEATHER_API_KEY")

    if not api_key:
        # Mock data when no API key is provided
        return json_response({
            "city": city,
            "temperature": 28.0,
            "humidity": 62,
            "aqi": 180,
            "source": "mock",
        })

    try:
        resp = requests.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={"q": city, "appid": api_key, "units": "metric"},
            timeout=10,
        )
        try:
            resp.raise_for_status()
        except requests.exceptions.HTTPError as http_err:
            status = getattr(http_err.response, "status_code", None)
            # If the API key is invalid/unauthorized, fall back to mock so UI doesn't break
            if status in (401, 403):
                return json_response({
                    "city": city,
                    "temperature": 28.0,
                    "humidity": 62,
                    "aqi": 180,
                    "source": "mock-fallback",
                })
            raise
        data = resp.json()
        out = {
            "city": city,
            "temperature": data.get("main", {}).get("temp"),
            "humidity": data.get("main", {}).get("humidity"),
            "aqi": None,  # Not available from this endpoint; left as None
            "source": "openweather",
        }
        return json_response(out)
    except Exception as e:
        return error_response(f"Weather fetch failed: {e}", 502)


@weather_bp.get("")
def weather_root():
    """GET /api/weather: Return weather by user's city (from JWT) or ?city= query.

    Response: { city, temperature, humidity, description }
    """
    # Prefer explicit city param
    city = (request.args.get("city") or "").strip()

    # If not provided, try to infer from user via bearer token
    if not city:
        auth = request.headers.get("Authorization", "")
        payload = None
        if auth.startswith("Bearer "):
            token = auth.split(" ", 1)[1]
            payload = decode_token(token)
        if payload:
            cols = get_collections()
            if cols and payload.get("sub"):
                user = cols["users"].find_one({"_id": ObjectId(payload["sub"])})
                if user and user.get("city"):
                    city = user.get("city")

    if not city:
        city = "Lahore"

    api_key = os.getenv("OPENWEATHER_API_KEY")
    # Fallback when no API key configured
    if not api_key:
        return json_response({
            "city": city,
            "temperature": 28.0,
            "humidity": 62,
            "description": "Partly cloudy (mock)",
            "source": "mock",
        })

    try:
        resp = requests.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={"q": city, "appid": api_key, "units": "metric"},
            timeout=10,
        )
        try:
            resp.raise_for_status()
        except requests.exceptions.HTTPError as http_err:
            status = getattr(http_err.response, "status_code", None)
            if status in (401, 403):
                # Unauthorized from OpenWeather; provide mock so UI stays populated
                return json_response({
                    "city": city,
                    "temperature": 28.0,
                    "humidity": 62,
                    "description": "Partly cloudy (mock)",
                    "source": "mock-fallback",
                })
            raise
        data = resp.json()
        description = None
        if isinstance(data.get("weather"), list) and data["weather"]:
            description = data["weather"][0].get("description")
        out = {
            "city": city,
            "temperature": data.get("main", {}).get("temp"),
            "humidity": data.get("main", {}).get("humidity"),
            "description": description,
            "source": "openweather",
        }
        return json_response(out)
    except Exception as e:
        return error_response(f"Weather fetch failed: {e}", 502)
