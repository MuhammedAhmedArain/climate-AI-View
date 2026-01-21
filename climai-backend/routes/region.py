import os
import math
import requests
from flask import Blueprint, request
from utils.helpers import json_response, error_response
from utils.auth import decode_token
from utils.db import get_collections
from bson.objectid import ObjectId

region_bp = Blueprint("region", __name__)


def _get_user_city() -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth.split(" ", 1)[1]
        payload = decode_token(token)
        cols = get_collections()
        if payload and cols and payload.get("sub"):
            u = cols["users"].find_one({"_id": ObjectId(payload["sub"])})
            if u and u.get("city"):
                return u.get("city").strip()
    return "Lahore"  # fallback


def _geocode_city(city: str, api_key: str):
    try:
        resp = requests.get(
            "http://api.openweathermap.org/geo/1.0/direct",
            params={"q": city, "limit": 1, "appid": api_key},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list) and data:
            return data[0].get("lat"), data[0].get("lon")
    except Exception:
        return None, None
    return None, None


def _fetch_air_pollution(lat: float, lon: float, api_key: str):
    try:
        resp = requests.get(
            "http://api.openweathermap.org/data/2.5/air_pollution",
            params={"lat": lat, "lon": lon, "appid": api_key},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        aqi = data.get("list", [{}])[0].get("main", {}).get("aqi")  # 1-5 scale
        # Convert 1-5 into 0-200 style index rough mapping
        if aqi is not None:
            mapping = {1: 25, 2: 75, 3: 125, 4: 175, 5: 200}
            return mapping.get(aqi, 100)
    except Exception:
        pass
    return None


def _fetch_weather(city: str, api_key: str):
    try:
        resp = requests.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={"q": city, "appid": api_key, "units": "metric"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        temp = data.get("main", {}).get("temp")
        humidity = data.get("main", {}).get("humidity")
        return temp, humidity
    except Exception:
        return None, None


def _mock_forest_cover(city: str):
    # Deterministic pseudo value based on city name hash
    h = sum(ord(c) for c in city.lower()) % 21  # 0..20
    return round((h - 10) / 2.0, 1)  # -5..5 step 0.5


def _mock_water_stress(humidity: float | None):
    if humidity is None:
        return 60
    # Lower humidity => higher stress
    return round(max(0, min(100, 100 - humidity)))


@region_bp.get("/climate")
def regional_climate():
    """Return regional climate metrics for a user's city and user contribution deltas.

    Response:
    {
      city,
      region: { aqi, forestCoverChangePct, temperatureAnomalyC, waterStressPct },
      user: { monthlyKg, contribution: { aqiDelta, forestDeltaPct, tempDeltaC, waterStressDeltaPct } }
    }
    """
    city = (request.args.get("city") or "").strip() or _get_user_city()
    api_key = os.getenv("OPENWEATHER_API_KEY")

    if not city:
        return error_response("City not resolved", 400)

    # Fetch region data (AQI, temp, humidity); forest and water stress mocked/derived
    temp = humidity = None
    aqi_region = None
    if api_key:
        lat, lon = _geocode_city(city, api_key)
        if lat is not None and lon is not None:
            aqi_region = _fetch_air_pollution(lat, lon, api_key)
        t, h = _fetch_weather(city, api_key)
        temp, humidity = t, h
    # Fallbacks if API not available
    if aqi_region is None:
        aqi_region = 120  # moderate placeholder
    if temp is None:
        temp = 26.0
    if humidity is None:
        humidity = 55.0

    # Forest cover change mock (percentage change vs some baseline)
    forest_pct = _mock_forest_cover(city)
    # Water stress derived from inverse humidity
    water_stress = _mock_water_stress(humidity)

    # Temperature anomaly: difference from nominal 15°C baseline
    temp_anomaly = round(temp - 15.0, 2)

    # User latest monthly kg
    user_monthly = None
    cols = get_collections()
    if cols is not None:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            payload = decode_token(auth.split(" ", 1)[1])
            if payload and payload.get("sub"):
                cur = cols["carbon_footprint"].find({"userId": ObjectId(payload["sub"]) }).sort("created_at", -1).limit(1)
                docs = list(cur)
                if docs:
                    user_monthly = float(docs[0].get("predicted", 0))

    # Contribution deltas (simple heuristic relationships)
    # Baseline monthly kg
    baseline_monthly = 4000.0 / 12.0
    if user_monthly is None:
        user_monthly = baseline_monthly
    ratio = user_monthly / baseline_monthly

    # AQI delta: scaled by excess emission
    aqi_delta = round((ratio - 1.0) * 8.0, 2)  # each 10% over baseline ~0.8 index points
    # Forest delta: additional pressure (negative change)
    forest_delta_pct = round((ratio - 1.0) * -0.6, 2)  # -0.6% per 10% over baseline
    # Temperature delta (milli °C -> converted to °C)
    temp_delta_c = round((ratio - 1.0) * 0.02, 3)  # very small per-user signal
    # Water stress delta: increase if over baseline
    water_stress_delta_pct = round((ratio - 1.0) * 2.5, 2)

    return json_response({
        "city": city,
        "region": {
            "aqi": aqi_region,
            "forestCoverChangePct": forest_pct,
            "temperatureAnomalyC": temp_anomaly,
            "waterStressPct": water_stress,
        },
        "user": {
            "monthlyKg": round(user_monthly, 2),
            "baselineMonthlyKg": round(baseline_monthly, 2),
            "ratio": round(ratio, 3),
            "contribution": {
                "aqiDelta": aqi_delta,
                "forestDeltaPct": forest_delta_pct,
                "tempDeltaC": temp_delta_c,
                "waterStressDeltaPct": water_stress_delta_pct,
            },
        },
    })


@region_bp.get("/critical")
def critical_regions_pakistan():
    """Return a list of Pakistan cities with live weather/AQI and risk classification.

    Response: {
      updatedAt,
      regions: [ { city, temperature, humidity, aqi, riskLevel, condition } ],
      pakistanStats: { avgTemp, maxTemp, minTemp, avgAQI, criticalCount }
    }
    """
    api_key = os.getenv("OPENWEATHER_API_KEY")
    # Major cities snapshot
    cities = [
        "Karachi", "Lahore", "Islamabad", "Peshawar", "Quetta",
        "Multan", "Faisalabad", "Rawalpindi", "Sialkot", "Hyderabad"
    ]

    regions = []
    for city in cities:
        temp = humidity = None
        aqi_val = None
        if api_key:
            try:
                t, h = _fetch_weather(city, api_key)
                temp, humidity = t, h
                lat, lon = _geocode_city(city + ", Pakistan", api_key)
                if lat is not None and lon is not None:
                    aqi_val = _fetch_air_pollution(lat, lon, api_key)
            except Exception:
                pass

        # Fallbacks
        if temp is None:
            # pseudo-random but stable temps per city
            base = (sum(ord(c) for c in city) % 20) - 5
            temp = 28.0 + base * 0.6
        if humidity is None:
            humidity = 60
        if aqi_val is None:
            aqi_val = 140 + (sum(ord(c) for c in city) % 60)  # 140..199

        # Determine risk
        condition = "normal"
        risk = "moderate"
        if temp >= 40 or aqi_val >= 200 or temp <= 0:
            risk = "critical"
        elif temp >= 35 or aqi_val >= 150 or temp <= 2:
            risk = "high"
        else:
            risk = "moderate"

        if temp >= 35:
            condition = "heat"
        if aqi_val >= 150 and (temp < 35 or aqi_val >= 175):
            condition = "pollution"
        if temp <= 2:
            condition = "cold"

        regions.append({
            "city": city,
            "temperature": round(float(temp), 1) if isinstance(temp, (int, float)) else None,
            "humidity": int(humidity) if isinstance(humidity, (int, float)) else None,
            "aqi": int(aqi_val) if isinstance(aqi_val, (int, float)) else None,
            "riskLevel": risk,
            "condition": condition,
        })

    # Aggregate stats
    temps = [r["temperature"] for r in regions if isinstance(r["temperature"], (int, float))]
    aqis = [r["aqi"] for r in regions if isinstance(r["aqi"], (int, float))]
    pakistan_stats = {
        "avgTemp": round(sum(temps) / len(temps), 1) if temps else None,
        "maxTemp": max(temps) if temps else None,
        "minTemp": min(temps) if temps else None,
        "avgAQI": round(sum(aqis) / len(aqis)) if aqis else None,
        "criticalCount": sum(1 for r in regions if r["riskLevel"] == "critical"),
    }

    return json_response({
        "updatedAt": request.headers.get("Date"),
        "regions": regions,
        "pakistanStats": pakistan_stats,
    })
