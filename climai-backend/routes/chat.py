import os
import re
import random
from datetime import datetime
from flask import Blueprint, request
from bson.objectid import ObjectId
from utils.helpers import json_response, error_response
from utils.auth import decode_token
from utils.db import get_collections
from routes.region import (
    _get_user_city,
    _geocode_city,
    _fetch_air_pollution,
    _fetch_weather,
    _mock_forest_cover,
    _mock_water_stress,
)

chat_bp = Blueprint("chat", __name__)

# Expanded structured knowledge base.
TOPICS = [
    {
        "key": "climate_change",
        "patterns": [r"climate change", r"global warming", r"temperature anomaly"],
        "answer": (
            "Climate change refers to long-term shifts in temperatures and weather patterns. "
            "Primary driver: rising greenhouse gases from burning fossil fuels, deforestation, and industrial processes. "
            "Impacts include more extreme heat, shifting rainfall, glacier loss, and higher sea levels."
        ),
    },
    {
        "key": "causes",
        "patterns": [r"causes of climate", r"what causes global warming", r"why is climate changing"],
        "answer": (
            "Main causes: CO₂ from fossil fuels, methane from agriculture & waste, nitrous oxide from fertilizers, "
            "land-use change reducing natural carbon sinks, and industrial fluorinated gases."
        ),
    },
    {
        "key": "greenhouse_gases",
        "patterns": [r"greenhouse gas", r"ghg", r"co2", r"methane", r"nitrous oxide"],
        "answer": (
            "Key greenhouse gases: CO₂ (long-lived), CH₄ (≈28x CO₂ warming over 100 yrs), N₂O (≈265x), and F-gases (very potent). "
            "They trap infrared radiation, raising atmospheric temperature."
        ),
    },
    {
        "key": "renewable_energy",
        "patterns": [r"renewable", r"solar", r"wind", r"hydro", r"geothermal"],
        "answer": (
            "Renewable energy (solar, wind, hydro, geothermal) generates electricity with very low operational emissions, reducing reliance on coal/oil and lowering air pollution."
        ),
    },
    {
        "key": "carbon_footprint",
        "patterns": [r"carbon footprint", r"my emissions", r"lower footprint", r"reduce emissions"],
        "answer": (
            "Reduce footprint: shift to public or active transport, improve home efficiency (insulation, LEDs), use efficient appliances, adopt more plant-based meals, reduce flights, minimize waste & overconsumption."
        ),
    },
    {
        "key": "recycling",
        "patterns": [r"recycling", r"waste", r"reuse"],
        "answer": (
            "Recycling lowers energy use and raw material extraction. Prioritize: reduce first, then reuse, then recycle. Proper sorting prevents contamination. Compost organics to cut methane."
        ),
    },
    {
        "key": "energy_saving",
        "patterns": [r"save energy", r"energy efficiency", r"lower electricity"],
        "answer": (
            "Energy saving tips: LED lighting, smart thermostats, efficient HVAC, unplug idle devices, seal drafts, manage peak usage, and consider rooftop solar or community solar."
        ),
    },
    {
        "key": "sustainable_transport",
        "patterns": [r"sustainable transport", r"public transit", r"electric car", r"bike commute"],
        "answer": (
            "Sustainable transport: public transit, biking, walking, carpooling, EVs charged with clean electricity. Maintain tire pressure & smooth driving to cut fuel use. Avoid short-haul flights when rail alternatives exist."
        ),
    },
    {
        "key": "individual_impact",
        "patterns": [r"individual impact", r"does my footprint matter", r"personal emissions"],
        "answer": (
            "Individual choices aggregate: energy demand influences grid mix, transport demand shapes infrastructure, dietary shifts reduce agricultural emissions. Personal actions plus advocacy accelerate systemic change."
        ),
    },
    {
        "key": "aqi",
        "patterns": [r"aqi", r"air quality", r"pm2\.5"],
        "answer": (
            "AQI categories (approx.): 0–50 Good, 51–100 Moderate, 101–150 Unhealthy for Sensitive Groups, 151–200 Unhealthy, 201–300 Very Unhealthy, 301+ Hazardous. Sources: traffic, industry, biomass burning."
        ),
    },
    {
        "key": "forest_cover",
        "patterns": [r"forest cover", r"deforestation", r"trees"],
        "answer": (
            "Forest cover change represents gains or losses in tree-dominated land. Loss reduces carbon sinks & biodiversity. Restoration and sustainable forestry help sequester CO₂ and stabilize local climate."
        ),
    },
    {
        "key": "temperature_anomaly",
        "patterns": [r"temperature anomaly", r"anomaly", r"baseline temperature"],
        "answer": (
            "Temperature anomaly = current temperature minus a baseline average (often 20–30 year period). Persistent positive anomalies indicate warming trend; short spikes can be weather variability."
        ),
    },
    {
        "key": "water_stress",
        "patterns": [r"water stress", r"water scarcity", r"drought"],
        "answer": (
            "Water stress reflects ratio of demand to available supply. High stress: over-extraction, drought, pollution. Mitigate via efficiency, leak reduction, watershed protection, sustainable agriculture."
        ),
    },
    {
        "key": "weather_vs_climate",
        "patterns": [r"weather vs climate", r"difference weather climate"],
        "answer": (
            "Weather is short-term atmospheric conditions (hours–days); climate is statistical pattern over decades. Single hot day ≠ climate trend, but increasing frequency of extremes signals climate change."
        ),
    },
    {
        "key": "assistant_identity",
        "patterns": [r"who are you", r"what can you do", r"what are you"],
        "answer": (
            "I'm your climate-focused assistant. I explain climate science, track your footprint, summarize local indicators like AQI or temperature anomalies, and suggest practical steps to cut emissions."
        ),
    },
    {
        "key": "climate_solutions",
        "patterns": [r"climate solutions", r"how to stop climate change", r"fight climate change"],
        "answer": (
            "Key climate solutions: accelerate clean energy deployment, electrify transport, enhance efficiency in buildings, protect and restore forests, adopt climate-smart agriculture, and decarbonize industry. Collective policy, finance, and behavior shifts make these changes scale."
        ),
    },
]

NORMAL_RANGES = {
    "aqi": "Good < 50; sensitive impacts start >100; sustained >150 warrants mitigation & exposure reduction.",
    "temperature_anomaly": "Global anomaly currently ≈ +1.1–1.3°C vs preindustrial; local anomalies vary seasonally.",
    "forest_cover": "Stable or increasing is positive; rapid annual loss >1–2% signals deforestation risk.",
    "water_stress": "<25% low, 25–50% moderate, 50–75% high, >75% very high stress (approximate tiers)."
}

GENERIC_FALLBACK = (
    "I can help with climate causes, greenhouse gases, renewable energy, carbon footprint reduction, recycling, energy efficiency, transport, and indicators (AQI, forest cover, temperature anomaly, water stress)."
)

BASELINE_MONTHLY = 4000.0 / 12.0

REDUCTION_GUIDE = {
    "aqi": [
        "Cut local combustion (no trash burning, maintain engines).",
        "Shift to public transit, cycling, or walking for short trips.",
        "Plant and protect street trees to absorb pollutants.",
        "Promote cleaner fuels for generators and cookstoves.",
    ],
    "temperature": [
        "Expand urban greenery and reflective roofs to cool streets.",
        "Improve building insulation and efficiency to curb waste heat.",
        "Electrify heating and transport with clean energy where possible.",
        "Cut fossil fuel use in daily routines (carpool, efficient appliances).",
    ],
    "water": [
        "Fix leaks quickly and install low-flow fixtures.",
        "Reuse greywater for irrigation when safe.",
        "Schedule irrigation at dawn or dusk to minimize evaporation.",
        "Support watershed protection and rainwater harvesting schemes.",
    ],
    "forest": [
        "Protect existing tree cover and avoid unnecessary clearing.",
        "Back community reforestation and native species planting.",
        "Choose certified sustainable wood and paper products.",
        "Engage local authorities on enforcing anti-logging rules.",
    ],
    "footprint": [
        "Upgrade to efficient appliances and LED lighting.",
        "Plan trips to reduce mileage; prefer public transit or carpooling.",
        "Adopt more plant-based meals and cut food waste.",
        "Shift to renewable electricity or enroll in green tariffs.",
    ],
}

REDUCTION_MESSAGES = {
    "aqi": "To improve local air quality, focus on reducing combustion sources, traveling efficiently, and adding city greenery.",
    "temperature": "Lowering urban heat means more shade, reflective surfaces, efficient buildings, and fewer fossil-fuel sources.",
    "water": "Relieve water stress by saving every liter, reusing safely, and protecting shared water resources.",
    "forest": "Guard forest cover through protection, restoration, and smart material choices.",
    "footprint": "Shrink your footprint by cutting energy waste, low-carbon travel, and climate-friendly diets.",
}

GREETING_PATTERNS = [
    r"^\s*(hi|hello|hey)\b",
    r"\bgood\s+(morning|afternoon|evening)\b",
]

CHAT_GREETING_RESPONSES = [
    "Hi there! Ready to explore climate questions or your footprint?",
    "Hello! Tell me what climate or sustainability topic is on your mind.",
    "Hey! I can walk you through air quality, emissions, or any climate question you have.",
    "Hi! How can I support your climate goals today?",
]

SMALL_TALK_PATTERNS = [
    r"how are you",
    r"what'?s up",
    r"how'?s it going",
    r"how do you feel",
]

CHAT_SMALL_TALK_RESPONSES = [
    "I'm running clean and efficient—ready to help with climate insights whenever you are.",
    "Doing great here! Let me know what climate or sustainability questions you want to dive into.",
    "All systems green. Ask about air quality, emissions, or climate solutions anytime.",
    "I'm energized to chat climate. How can I assist today?",
]

APPRECIATION_PATTERNS = [
    r"thank you",
    r"thanks",
    r"appreciate it",
]

CHAT_APPRECIATION_RESPONSES = [
    "Glad to help! Reach out anytime you need climate guidance.",
    "You're welcome! Let me know if you want to explore another topic.",
    "Happy to support. Ready for the next climate question when you are.",
]

FOLLOWUP_DETAIL_PATTERNS = [
    r"tell me more",
    r"more detail",
    r"elaborate",
    r"go deeper",
    r"in detail",
]

FOLLOWUP_SIMPLIFY_PATTERNS = [
    r"simplify",
    r"easy words",
    r"simpler",
    r"explain like",
    r"break it down",
]

FOLLOWUP_REPEAT_PATTERNS = [
    r"repeat",
    r"again please",
    r"say it again",
]


def _sanitize_history(raw_history) -> list[dict]:
    sanitized: list[dict] = []
    if not isinstance(raw_history, list):
        return sanitized
    for item in raw_history[-12:]:  # keep last 12 exchanges max
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        text = (item.get("text") or "").strip()
        if role in {"user", "bot"} and text:
            sanitized.append({"role": role, "text": text})
    return sanitized


def _get_last_bot_message(history: list[dict]) -> str | None:
    for item in reversed(history):
        if item.get("role") == "bot":
            return item.get("text")
    return None


METRIC_KEYWORDS = re.compile(
    r"\b(aqi|air quality|temperature|temp|hot|cold|heat wave|water stress|water scarcity|drought|forest|tree cover|deforestation|footprint|emission|emissions|carbon)\b",
    re.IGNORECASE,
)


def _message_needs_metrics(message: str, history: list[dict]) -> bool:
    if METRIC_KEYWORDS.search(message):
        return True
    if history:
        last = history[-1]
        if last.get("role") == "user" and METRIC_KEYWORDS.search(last.get("text", "")):
            return True
    return False


def _infer_topic_from_text(text: str) -> str | None:
    lower = text.lower()
    if "aqi" in lower or "air quality" in lower or "pm2" in lower:
        return "aqi"
    if "temperature" in lower or "heat" in lower or "anomaly" in lower:
        return "temperature"
    if "water" in lower or "drought" in lower:
        return "water"
    if "forest" in lower or "tree" in lower or "deforestation" in lower:
        return "forest"
    if "footprint" in lower or "emission" in lower or "carbon" in lower:
        return "footprint"
    return None


def _simplify_text(text: str) -> str:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    if not sentences:
        return text
    summary = " ".join(sentences[:2])
    key_points = sentences[: min(4, len(sentences))]
    if len(key_points) > 1:
        bullet_like = "; ".join(key_points[1:])
        return f"Here's the short version: {summary} Key points: {bullet_like}."
    return f"Here's the short version: {summary}"


def _detail_from_previous(previous: str) -> str:
    topic = _infer_topic_from_text(previous)
    detail_parts = [
        "Earlier we covered: " + previous,
    ]
    if topic and topic in REDUCTION_MESSAGES:
        detail_parts.append(REDUCTION_MESSAGES[topic])
        detail_parts.append("Practical steps: " + "; ".join(REDUCTION_GUIDE[topic][:3]))
    else:
        detail_parts.append(
            "Key climate takeaway: individual choices plus policy support accelerate progress across energy, transport, and conservation."
        )
    return " ".join(detail_parts)


def match_answer(message: str) -> str:
    text = message.lower()
    if re.search(r"normal range|what is normal|reference range", text):
        for key, desc in NORMAL_RANGES.items():
            if key in text:
                return f"Normal {key} range: {desc}"
        return (
            "Normal ranges: AQI <50 good; water stress <25% low; temperature anomaly globally ~+1.2°C; forest cover stable or rising is beneficial. Specify an indicator for more detail."
        )
    for topic in TOPICS:
        for pattern in topic["patterns"]:
            if re.search(pattern, text):
                return topic["answer"]
    return GENERIC_FALLBACK

def _collect_context_metrics() -> dict:
    city = _get_user_city()
    api_key = os.getenv("OPENWEATHER_API_KEY")

    temp = humidity = None
    aqi_region = None
    if api_key:
        lat, lon = _geocode_city(city + ", Pakistan", api_key)
        if lat is not None and lon is not None:
            aqi_region = _fetch_air_pollution(lat, lon, api_key)
        temp, humidity = _fetch_weather(city, api_key)

    if aqi_region is None:
        aqi_region = 140
    if temp is None:
        temp = 28.0
    if humidity is None:
        humidity = 60.0

    forest_pct = _mock_forest_cover(city)
    water_stress = _mock_water_stress(humidity)
    temp_anomaly = round(temp - 15.0, 2)

    user_monthly = None
    auth = request.headers.get("Authorization", "")
    cols = get_collections()
    if cols and auth.startswith("Bearer "):
        payload = decode_token(auth.split(" ", 1)[1])
        if payload and payload.get("sub"):
            cur = (
                cols["carbon_footprint"]
                .find({"userId": ObjectId(payload["sub"]) })
                .sort("created_at", -1)
                .limit(1)
            )
            docs = list(cur)
            if docs:
                user_monthly = float(docs[0].get("predicted", BASELINE_MONTHLY))

    ratio = (user_monthly if user_monthly is not None else BASELINE_MONTHLY) / BASELINE_MONTHLY

    return {
        "city": city,
        "aqi": int(round(aqi_region)),
        "temperatureC": round(float(temp), 1),
        "humidityPct": round(float(humidity), 1),
        "temperatureAnomalyC": temp_anomaly,
        "waterStressPct": int(round(water_stress)),
        "forestCoverChangePct": float(forest_pct),
        "userMonthlyKg": round(float(user_monthly), 2) if user_monthly is not None else None,
        "baselineMonthlyKg": round(BASELINE_MONTHLY, 2),
        "userRatio": round(ratio, 2),
        "collectedAt": datetime.utcnow().isoformat() + "Z",
    }


def _classify_aqi(aqi: float) -> str:
    if aqi >= 301:
        return "hazardous"
    if aqi >= 201:
        return "very unhealthy"
    if aqi >= 151:
        return "unhealthy"
    if aqi >= 101:
        return "unhealthy for sensitive groups"
    if aqi >= 51:
        return "moderate"
    return "good"


def _handle_aqi(metrics: dict | None):
    if not metrics:
        return "Live air quality data is unavailable right now. Try again soon.", []
    value = metrics["aqi"]
    category = _classify_aqi(value)
    message = (
        f"Air quality in {metrics['city']} is {category} today (AQI {value}). "
    )
    if value >= 151:
        message += "Limit outdoor exposure and tackle nearby emission sources."
    elif value >= 101:
        message += "Sensitive groups should take precautions and keep indoor air clean."
    else:
        message += "Conditions are manageable; keep supporting low-emission habits."
    tips = REDUCTION_GUIDE["aqi"][:3] if value >= 101 else REDUCTION_GUIDE["aqi"][:2]
    return message.strip(), tips


def _handle_temperature(metrics: dict | None):
    if not metrics:
        return "Temperature data is unavailable right now. Check again shortly.", []
    temp = metrics["temperatureC"]
    anomaly = metrics["temperatureAnomalyC"]
    message = (
        f"Current temperature in {metrics['city']} is {temp:.1f}°C, "
        f"which is {anomaly:+.2f}°C relative to the long-term baseline." 
    )
    if anomaly > 0.8 or temp >= 35:
        message += " Sustained heat like this stresses health and infrastructure."
    elif anomaly < -0.8:
        message += " This dip is likely weather variability rather than a long-term signal."
    else:
        message += " Values remain close to seasonal expectations."
    tips = REDUCTION_GUIDE["temperature"][:3] if (anomaly > 0.8 or temp >= 35) else []
    return message.strip(), tips


def _handle_water_stress(metrics: dict | None):
    if not metrics:
        return "Water stress data is unavailable; please retry later.", []
    stress = metrics["waterStressPct"]
    if stress >= 75:
        status = "very high"
    elif stress >= 50:
        status = "high"
    elif stress >= 25:
        status = "moderate"
    else:
        status = "low"
    message = (
        f"Estimated water stress around {metrics['city']} is {stress}% ({status}). "
    )
    if stress >= 50:
        message += "Aggressive conservation and supply protection are essential."
    else:
        message += "Keep building efficient habits to stay resilient."
    tips = REDUCTION_GUIDE["water"][:3] if stress >= 50 else REDUCTION_GUIDE["water"][:2]
    return message.strip(), tips


def _handle_forest(metrics: dict | None):
    if not metrics:
        return "Forest cover change data is unavailable right now.", []
    change = metrics["forestCoverChangePct"]
    if change < -1:
        trend = "declining"
    elif change > 1:
        trend = "improving"
    else:
        trend = "fairly stable"
    message = (
        f"Forest cover near {metrics['city']} looks {trend} (change {change:+.1f}%). "
    )
    if change < 0:
        message += "Protect remaining trees and accelerate local reforestation." 
    else:
        message += "Keep supporting conservation and urban greenery projects."
    tips = REDUCTION_GUIDE["forest"][:3] if change < 0 else REDUCTION_GUIDE["forest"][:2]
    return message.strip(), tips


def _handle_footprint(metrics: dict | None):
    if not metrics or metrics.get("userMonthlyKg") is None:
        message = (
            "I do not have a saved footprint estimate yet. Run the carbon calculator to generate one."
        )
        return message, REDUCTION_GUIDE["footprint"][:3]
    monthly = metrics["userMonthlyKg"]
    ratio = metrics["userRatio"]
    message = (
        f"Your latest monthly footprint is {monthly:.0f} kg CO₂, about {ratio*100:.0f}% of a typical resident's {metrics['baselineMonthlyKg']:.0f} kg baseline. "
    )
    if ratio > 1.1:
        message += "Focus on cutting energy waste and cleaner transport choices."
    elif ratio < 0.9:
        message += "Great progress—keep reinforcing those low-carbon habits."
    else:
        message += "You are close to average; small tweaks can push you below it."
    return message.strip(), REDUCTION_GUIDE["footprint"][:3]


def _answer_reduction(topic: str):
    return REDUCTION_MESSAGES[topic], REDUCTION_GUIDE[topic][:3]


def _format_history_for_prompt(history: list[dict]) -> str:
    if not history:
        return "(no prior conversation)"
    lines = []
    for item in history[-10:]:
        role = "User" if item["role"] == "user" else "Assistant"
        lines.append(f"{role}: {item['text']}")
    return "\n".join(lines)


def _metrics_to_prompt(metrics: dict | None) -> str:
    if not metrics:
        return "(metrics unavailable)"
    lines = [
        f"City: {metrics['city']}",
        f"AQI (0-200 scale): {metrics['aqi']}",
        f"Temperature: {metrics['temperatureC']} °C (anomaly {metrics['temperatureAnomalyC']} °C)",
        f"Water stress: {metrics['waterStressPct']}%",
        f"Forest cover change: {metrics['forestCoverChangePct']}%",
    ]
    if metrics.get("userMonthlyKg") is not None:
        lines.append(
            f"User monthly footprint: {metrics['userMonthlyKg']} kg CO₂ (baseline {metrics['baselineMonthlyKg']} kg, ratio {metrics['userRatio']})"
        )
    return "\n".join(lines)


def _gemini_available() -> bool:
    return bool(os.getenv("GEMINI_API_KEY"))


def ask_gemini(message: str, history: list[dict], metrics: dict | None) -> str | None:
    try:
        import google.generativeai as genai

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return None

        genai.configure(api_key=api_key)
        model_name = os.getenv("GEMINI_MODEL_NAME", os.getenv("MODEL_NAME", "gemini-2.0-flash"))

        system_instruction = (
            "You are a climate-specialist assistant. Tasks: answer climate science questions, explain sustainability topics, "
            "reference local indicators (AQI, temperature anomaly, water stress, forest cover, user footprint) WHEN the user asks or it clearly helps, "
            "respond warmly to greetings/thanks, and respect follow-up requests by using conversation history. "
            "Keep answers concise (2-5 sentences), human-readable, and actionable. If a question is outside climate scope, redirect politely."
        )

        history_block = _format_history_for_prompt(history)
        metrics_block = _metrics_to_prompt(metrics) if metrics else "(metrics unavailable)"
        prompt = (
            f"Conversation so far:\n{history_block}\n\n"
            f"Latest user message: {message}\n\n"
            "If the user asks for more detail or simpler wording, build on the previous assistant reply. "
            "Only mention AQI/temperature/water stress/forest/footprint numbers when the user explicitly asks or it clearly improves the answer.\n"
            f"Context metrics (use only when relevant):\n{metrics_block}\n"
        )

        model = genai.GenerativeModel(model_name, system_instruction=system_instruction)
        resp = model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.35,
                "max_output_tokens": 640,
                "top_p": 0.9,
            },
        )
        text = getattr(resp, "text", None)
        if not text and getattr(resp, "candidates", None):
            for c in resp.candidates:
                parts = getattr(getattr(c, "content", None), "parts", None)
                if parts:
                    stitched = " ".join(str(p.text) for p in parts if hasattr(p, "text"))
                    if stitched:
                        return stitched.strip()
        return text.strip() if text else None
    except Exception:
        return None


DYNAMIC_HANDLERS = [
    {
        "patterns": [r"current aqi", r"aqi now", r"air quality now", r"what is the aqi", r"aqi today"],
        "needs_metrics": True,
        "handler": _handle_aqi,
    },
    {
        "patterns": [r"current temperature", r"temperature now", r"how hot", r"temperature anomaly"],
        "needs_metrics": True,
        "handler": _handle_temperature,
    },
    {
        "patterns": [r"water stress", r"water scarcity", r"water level now"],
        "needs_metrics": True,
        "handler": _handle_water_stress,
    },
    {
        "patterns": [r"forest cover", r"deforestation", r"tree cover"],
        "needs_metrics": True,
        "handler": _handle_forest,
    },
    {
        "patterns": [r"my footprint", r"monthly emissions", r"carbon footprint"],
        "needs_metrics": True,
        "handler": _handle_footprint,
    },
    {
        "patterns": [r"reduce aqi", r"improve air quality"],
        "needs_metrics": False,
        "handler": lambda _: _answer_reduction("aqi"),
    },
    {
        "patterns": [r"reduce temperature", r"cool (?:city|area)", r"urban heat"],
        "needs_metrics": False,
        "handler": lambda _: _answer_reduction("temperature"),
    },
    {
        "patterns": [r"reduce water stress", r"save water"],
        "needs_metrics": False,
        "handler": lambda _: _answer_reduction("water"),
    },
    {
        "patterns": [r"protect forest", r"improve forest", r"increase trees", r"stop deforestation"],
        "needs_metrics": False,
        "handler": lambda _: _answer_reduction("forest"),
    },
    {
        "patterns": [r"lower footprint", r"reduce footprint", r"cut emissions", r"decarbonize"],
        "needs_metrics": False,
        "handler": lambda _: _answer_reduction("footprint"),
    },
]


@chat_bp.post("/ask")
def ask():
    data = request.get_json(silent=True) or {}
    msg = (data.get("message") or "").strip()
    if not msg:
        return error_response("Message required", 400)
    if len(msg) > 500:
        return error_response("Message too long", 400)

    history = _sanitize_history(data.get("history") or [])
    lower = msg.lower()

    suggestions: list[str] = []
    metrics_cache: dict | None = None
    metrics_used = False
    answer = None
    answer_source = "custom-logic"

    gemini_enabled = _gemini_available()
    if gemini_enabled:
        if _message_needs_metrics(lower, history):
            metrics_cache = _collect_context_metrics()
            metrics_used = metrics_cache is not None
        answer = ask_gemini(msg, history, metrics_cache if metrics_used else None)
        if answer:
            answer_source = "gemini"

    last_bot_reply = _get_last_bot_message(history)

    if not answer:
        if any(re.search(pattern, lower) for pattern in GREETING_PATTERNS):
            answer = random.choice(CHAT_GREETING_RESPONSES)
        elif any(re.search(pattern, lower) for pattern in SMALL_TALK_PATTERNS):
            answer = random.choice(CHAT_SMALL_TALK_RESPONSES)
        elif any(re.search(pattern, lower) for pattern in APPRECIATION_PATTERNS):
            answer = random.choice(CHAT_APPRECIATION_RESPONSES)
        elif last_bot_reply and any(re.search(pat, lower) for pat in FOLLOWUP_REPEAT_PATTERNS):
            answer = f"Sure, here it is again: {last_bot_reply}"
        elif last_bot_reply and any(re.search(pat, lower) for pat in FOLLOWUP_SIMPLIFY_PATTERNS):
            answer = _simplify_text(last_bot_reply)
        elif last_bot_reply and any(re.search(pat, lower) for pat in FOLLOWUP_DETAIL_PATTERNS):
            answer = _detail_from_previous(last_bot_reply)

    if not answer:
        for entry in DYNAMIC_HANDLERS:
            if any(re.search(pattern, lower) for pattern in entry["patterns"]):
                if entry["needs_metrics"]:
                    if metrics_cache is None:
                        metrics_cache = _collect_context_metrics()
                    answer, suggestions = entry["handler"](metrics_cache)
                    metrics_used = True
                else:
                    answer, suggestions = entry["handler"](metrics_cache)
                break

    if not answer:
        answer = match_answer(msg)

    payload = {
        "message": msg,
        "answer": answer,
        "source": answer_source,
    }
    if metrics_used and metrics_cache:
        payload["metrics"] = metrics_cache
    if suggestions:
        payload["suggestions"] = suggestions

    return json_response(payload)
