from flask import Blueprint, request, current_app
from utils.helpers import json_response, error_response
from utils.model_artifacts import (
    get_all,
    transform_inputs,
    artifacts_present,
    artifacts_ready,
    get_expected_feature_names_for_model,
    align_payload_to_expected,
)
from utils.auth import decode_token
from utils.db import get_collections
from bson.objectid import ObjectId
from datetime import datetime
import pandas as pd
from math import isfinite, tanh

carbon_bp = Blueprint("carbon", __name__)

# Emission factors (kg CO2) — aligned with the frontend calculator
EMISSION_FACTORS = {
    "transport": {
        "car": {
            "petrol": 0.192,  # per km
            "diesel": 0.171,
            "electric": 0.047,
            "hybrid": 0.109,
        },
        "public": 0.089,  # per km
        "bike": 0,
        "walk": 0,
    },
    "flights": {
        "never": 0,
        "rarely": 300,  # per year
        "sometimes": 900,
        "frequently": 2400,
    },
    "electricity": {
        "low": 150,  # monthly kg CO2
        "medium": 300,
        "high": 500,
    },
    "waste": {
        "small": 15,  # per bag per week
        "medium": 25,
        "large": 40,
    },
    "recycling": {"multiplier": 0.7},  # 30% reduction
    "diet": {
        "meat-heavy": 3300,  # annual kg CO2
        "balanced": 2500,
        "vegetarian": 1700,
        "vegan": 1500,
    },
    "water": {  # monthly kg CO2
        "twice-daily": 50,
        "daily": 35,
        "every-other": 20,
    },
    "clothing": 22,  # per item
    "screenTime": 0.6,  # per hour daily (monthly)
}


def calculate_travel_emissions(data: dict) -> float:
    emissions = 0.0
    transport = data.get("transport")
    monthly_km = float(data.get("monthlyKm", 0) or 0)

    if transport == "car":
        vehicle = data.get("vehicleType")
        if vehicle in EMISSION_FACTORS["transport"]["car"]:
            emissions += monthly_km * EMISSION_FACTORS["transport"]["car"][vehicle]
    elif transport == "public":
        emissions += monthly_km * EMISSION_FACTORS["transport"]["public"]

    flights = data.get("flightFrequency", "never")
    emissions += EMISSION_FACTORS["flights"].get(flights, 0) / 12
    return round(emissions, 2)


def calculate_home_emissions(data: dict) -> float:
    emissions = 0.0
    electricity = data.get("electricityUsage", "medium")
    emissions += EMISSION_FACTORS["electricity"].get(electricity, 300)

    bags_per_week = float(data.get("wasteBagsPerWeek", 0) or 0)
    bag_size = data.get("wasteBagSize", "medium")
    waste = bags_per_week * 4.33 * EMISSION_FACTORS["waste"].get(bag_size, 25)
    if data.get("wasteRecycling", False):
        waste *= EMISSION_FACTORS["recycling"]["multiplier"]
    emissions += waste
    return round(emissions, 2)


def calculate_lifestyle_emissions(data: dict) -> float:
    emissions = 0.0
    diet = data.get("diet", "balanced")
    emissions += EMISSION_FACTORS["diet"].get(diet, 2500) / 12

    shower = data.get("showerFrequency", "daily")
    emissions += EMISSION_FACTORS["water"].get(shower, 35)

    clothes = float(data.get("newClothesMonthly", 0) or 0)
    emissions += clothes * EMISSION_FACTORS["clothing"]

    screen = float(data.get("screenTimeDaily", 0) or 0)
    emissions += screen * 30 * EMISSION_FACTORS["screenTime"]
    return round(emissions, 2)


@carbon_bp.get("/model/health")
def model_health():
    return json_response({
        "artifacts": artifacts_ready(),
    })


@carbon_bp.post("/predict")
def predict_carbon():
    """Predict carbon emissions using trained model and save result to DB if user is authenticated.

    Expects JSON with fields used by your model. Applies encoder/scaler if available, feeds to model.
    Returns { predicted: float } and persists as a history record for the user when possible.
    """
    payload = request.get_json(silent=True) or {}

    # Validate basic presence of payload
    if not isinstance(payload, dict) or not payload:
        return error_response("Invalid or empty payload", 400)

    # Ensure model is present
    try:
        artifacts = get_all()
    except Exception as e:
        current_app.logger.exception("Model load failed: %s", e)
        return error_response(f"Model load failed: {e}", 503)

    model = artifacts.get("model")
    if model is None or not hasattr(model, "predict"):
        return error_response("Model not available", 503)

    # Attempt 1: If model exposes expected feature names, align payload and predict directly
    predicted = None
    prediction_path = "unknown"
    expected = get_expected_feature_names_for_model(model)
    if expected:
        try:
            X_df = align_payload_to_expected(payload, expected)
            # Apply label encoders if provided as a dict
            enc = artifacts.get("encoder")
            if enc is not None:
                from utils.model_artifacts import apply_label_encoders
                X_df = apply_label_encoders(X_df, enc)
            # Apply scaler if available (assume trained on all features)
            scaler = artifacts.get("scaler")
            if scaler is not None and hasattr(scaler, "transform"):
                X_scaled = pd.DataFrame(scaler.transform(X_df), columns=X_df.columns)
            else:
                X_scaled = X_df
            preds = model.predict(X_scaled)
            predicted = float(preds[0])
            prediction_path = "aligned_features"
        except Exception as e1:
            current_app.logger.info("Aligned DF predict failed, will try transformed numeric matrix: %s", e1)

    # Attempt 2: Transform with encoder/scaler, then predict
    if predicted is None:
        try:
            X_num, X_cat = transform_inputs(payload)
            if X_cat is not None:
                try:
                    X = pd.concat([X_num.reset_index(drop=True), pd.DataFrame(X_cat).reset_index(drop=True)], axis=1)
                except Exception:
                    X = X_num
            else:
                X = X_num
            preds = model.predict(X)
            predicted = float(preds[0])
            prediction_path = "transformed_matrix"
        except Exception as e2:
            current_app.logger.exception("Prediction failed after transform: %s", e2)
            return error_response(f"Prediction failed: {e2}", 400)

    # Persist result for authenticated user if DB configured
    saved = False
    cols = get_collections()
    if cols is not None:
        auth = request.headers.get("Authorization", "")
        payload_token = None
        if auth.startswith("Bearer "):
            payload_token = decode_token(auth.split(" ", 1)[1])
        if payload_token and payload_token.get("sub"):
            try:
                doc = {
                    "userId": ObjectId(payload_token["sub"]),
                    "input": payload,
                    "predicted": predicted,
                    "created_at": datetime.utcnow(),
                }
                cols["carbon_footprint"].insert_one(doc)
                saved = True
            except Exception as e:
                current_app.logger.exception("Failed to save prediction: %s", e)

    current_app.logger.info(
        "Carbon model prediction complete - model=%s path=%s predicted=%s saved=%s",
        type(model).__name__ if model else "unknown",
        prediction_path,
        f"{predicted:.2f}" if isinstance(predicted, (int, float)) else predicted,
        saved,
    )

    return json_response({"predicted": predicted, "saved": saved})


@carbon_bp.get("/history")
def carbon_history():
    """Return saved prediction history for the authenticated user."""
    cols = get_collections()
    if cols is None:
        return error_response("Database not configured", 503)

    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return error_response("Missing bearer token", 401)
    token = auth.split(" ", 1)[1]
    payload_token = decode_token(token)
    if not payload_token or not payload_token.get("sub"):
        return error_response("Invalid or expired token", 401)

    try:
        cur = cols["carbon_footprint"].find({"userId": ObjectId(payload_token["sub"])})
        items = []
        for d in cur:
            items.append({
                "id": str(d.get("_id")),
                "predicted": float(d.get("predicted", 0)),
                "created_at": d.get("created_at").isoformat() if d.get("created_at") else None,
                "input": d.get("input", {}),
            })
        return json_response({"items": items})
    except Exception as e:
        current_app.logger.exception("History fetch failed: %s", e)
        return error_response(f"History fetch failed: {e}", 500)


@carbon_bp.get("/impact")
def carbon_impact():
    """Return derived impact metrics and history for authenticated user.

    Uses saved model predictions (monthly kg CO2) and computes indices:
    - aqiIndex: 0-200, baseline 50, scaled by vs baseline
    - forestCoverChangePct: +/- %, negative indicates higher pressure
    - temperatureAnomalyC: +/- °C equivalent indicator
    - waterStressPct: 0-100 index
    Also returns trend information and a compact time series for charts.
    """
    cols = get_collections()
    if cols is None:
        return error_response("Database not configured", 503)

    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return error_response("Missing bearer token", 401)
    token = auth.split(" ", 1)[1]
    payload_token = decode_token(token)
    if not payload_token or not payload_token.get("sub"):
        return error_response("Invalid or expired token", 401)

    user_id = ObjectId(payload_token["sub"])
    cursor = cols["carbon_footprint"].find({"userId": user_id}).sort("created_at", 1)
    history = list(cursor)

    if not history:
        return json_response({
            "history": [],
            "latest": None,
            "indices": None,
            "trend": None,
        })

    def clamp(x: float, lo: float, hi: float) -> float:
        return max(lo, min(hi, x))

    def to_ts(d):
        try:
            return d.isoformat()
        except Exception:
            return None

    series = [
        {"t": to_ts(d.get("created_at")), "kg": float(d.get("predicted", 0))}
        for d in history
        if d.get("predicted") is not None
    ]
    latest = series[-1]

    # Baseline: global average per person annual ~4000 kg => monthly ~333.3 kg
    baseline_monthly = 4000.0 / 12.0
    latest_monthly = float(latest["kg"]) if isfinite(latest["kg"]) else baseline_monthly

    # Smoothing: blend latest with mean of previous up to 3 to avoid jitter
    prev = series[:-1]
    prev_avg = None
    if prev:
        window = prev[-3:] if len(prev) >= 3 else prev
        prev_avg = sum(p["kg"] for p in window) / len(window)
    monthly = 0.6 * latest_monthly + 0.4 * prev_avg if prev_avg else latest_monthly

    # Relative to baseline
    r = monthly / baseline_monthly if baseline_monthly > 0 else 1.0
    # Logistic-like scaling for better dynamic range without saturating
    s = tanh((r - 1.0) / 0.6)  # around +/-0.76 for r in [0.6, 1.4]

    aqi_index = clamp(50.0 + 80.0 * s, 0.0, 200.0)
    forest_pct = clamp(-6.0 * s, -10.0, 10.0)
    temp_anom = clamp(0.5 * s, -1.0, 1.0)
    water_stress = clamp(50.0 + 25.0 * s, 0.0, 100.0)

    # Trend: compare latest to mean of previous up to 3 entries
    trend = None
    if prev_avg and prev_avg > 0:
        delta_pct = ((monthly - prev_avg) / prev_avg) * 100.0
        direction = "up" if delta_pct > 1 else ("down" if delta_pct < -1 else "stable")
        trend = {
            "deltaPct": round(delta_pct, 1),
            "direction": direction,
            "prevAvgKg": round(prev_avg, 2),
        }

    return json_response({
        "latest": {"kg": round(monthly, 2), "annualTons": round(monthly * 12.0 / 1000.0, 3), "ts": latest["t"]},
        "indices": {
            "aqi": round(aqi_index),
            "forestCoverChangePct": round(forest_pct, 1),
            "temperatureAnomalyC": round(temp_anom, 2),
            "waterStressPct": round(water_stress),
        },
        "trend": trend,
        "history": series,
        "baselineMonthlyKg": round(baseline_monthly, 2),
    })


@carbon_bp.post("/calculate")
def calculate_carbon():
    payload = request.get_json(silent=True) or {}

    travel = payload.get("travel", {})
    home = payload.get("home", {})
    lifestyle = payload.get("lifestyle", {})

    try:
        travel_em = calculate_travel_emissions(travel)
        home_em = calculate_home_emissions(home)
        life_em = calculate_lifestyle_emissions(lifestyle)
        total = travel_em + home_em + life_em
        annual_total = total * 12

        global_avg = 4000.0
        vs_avg = ((annual_total - global_avg) / global_avg) * 100

        if annual_total < 2500:
            rating = "excellent"
        elif annual_total < 3500:
            rating = "good"
        elif annual_total < 4500:
            rating = "average"
        elif annual_total < 6000:
            rating = "high"
        else:
            rating = "very-high"

        return json_response({
            "total": round(total, 2),
            "breakdown": {
                "travel": travel_em,
                "home": home_em,
                "lifestyle": life_em,
            },
            "annualTotal": round(annual_total, 2),
            "comparison": {
                "vsAverage": round(vs_avg, 1),
                "rating": rating,
            },
        })
    except Exception as e:
        return error_response(f"Calculation failed: {e}", 400)
