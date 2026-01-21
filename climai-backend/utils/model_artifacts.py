import os
import pickle
from functools import lru_cache
from typing import Any, Dict, Optional, Tuple, List

import pandas as pd

# Base directory for ML artifacts; defaults to backend/ml
DEFAULT_MODEL_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "ml")
)


def _model_dir() -> str:
    # Allow override via env var; resolve relative to backend root if relative
    base = os.getenv("MODEL_DIR")
    if not base:
        return DEFAULT_MODEL_DIR
    if os.path.isabs(base):
        return base
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", base))


def _load_pickle(path: str) -> Any:
    # Try joblib, then pickle, then cloudpickle
    # This improves compatibility with artifacts saved via joblib or cloudpickle
    try:
        import joblib  # type: ignore
        return joblib.load(path)
    except Exception as e_joblib:
        try:
            with open(path, "rb") as f:
                return pickle.load(f)
        except Exception as e_pickle:
            try:
                import cloudpickle  # type: ignore
                with open(path, "rb") as f:
                    return cloudpickle.load(f)
            except Exception as e_cloud:
                raise RuntimeError(f"Failed to load artifact {path}: joblib={e_joblib}; pickle={e_pickle}; cloudpickle={e_cloud}")


@lru_cache(maxsize=1)
def _artifact_paths() -> Dict[str, str]:
    d = _model_dir()
    candidates = {
        "model": ["model.pkl", "model.joblib", "carbon_emission_model.pkl"],
        "scaler": ["scaler.pkl", "scaler.joblib"],
        "encoder": ["encoder.pkl", "encoders.pkl", "label_encoders.pkl", "encoders.joblib"],
    }
    out: Dict[str, str] = {}
    for key, files in candidates.items():
        for fname in files:
            p = os.path.join(d, fname)
            if os.path.isfile(p):
                out[key] = p
                break
    return out


def artifacts_present() -> Dict[str, bool]:
    paths = _artifact_paths()
    return {
        "model": "model" in paths,
        "scaler": "scaler" in paths,
        "encoder": "encoder" in paths,
        "dir": _model_dir(),
    }


def artifacts_ready() -> Dict[str, Any]:
    """Report presence and load status of artifacts."""
    present = artifacts_present()
    loaded = {"model": False, "scaler": False, "encoder": False}
    err: Dict[str, Optional[str]] = {"model": None, "scaler": None, "encoder": None}
    for name, getter in ("model", get_model), ("scaler", get_scaler), ("encoder", get_encoder):
        try:
            obj = getter()
            loaded[name] = obj is not None
        except Exception as e:  # pragma: no cover - diagnostics only
            err[name] = str(e)
    return {"present": present, "loaded": loaded, "errors": err}


@lru_cache(maxsize=None)
def get_model() -> Optional[Any]:
    p = _artifact_paths().get("model")
    return _load_pickle(p) if p else None


@lru_cache(maxsize=None)
def get_scaler() -> Optional[Any]:
    p = _artifact_paths().get("scaler")
    return _load_pickle(p) if p else None


@lru_cache(maxsize=None)
def get_encoder() -> Optional[Any]:
    p = _artifact_paths().get("encoder")
    return _load_pickle(p) if p else None


def get_all() -> Dict[str, Any]:
    return {
        "model": get_model(),
        "scaler": get_scaler(),
        "encoder": get_encoder(),
    }


def transform_inputs(payload: Dict[str, Any], schema: Optional[Dict[str, str]] = None) -> Tuple[pd.DataFrame, Optional[pd.DataFrame]]:
    """Convert raw JSON payload into model-ready matrices.

    - Builds a one-row DataFrame from payload
    - Applies encoder to categorical columns if present
    - Applies scaler to numeric columns if present

    Returns (X_num_scaled_or_original, X_cat_encoded_or_None)
    """
    df = pd.DataFrame([payload])

    enc = get_encoder()
    scaler = get_scaler()

    X_cat = None
    X_num = df

    # Apply encoder if provided and supports transform
    if enc is not None and hasattr(enc, "transform"):
        try:
            X_cat = enc.transform(df.select_dtypes(include=["object", "category"]).fillna(""))  # type: ignore
        except Exception:
            X_cat = None

    # Apply scaler if provided and supports transform
    if scaler is not None and hasattr(scaler, "transform"):
        num_df = df.select_dtypes(exclude=["object", "category"]).fillna(0)
        try:
            X_num = pd.DataFrame(scaler.transform(num_df), columns=num_df.columns)
        except Exception:
            X_num = num_df

    return X_num, X_cat


def _normalize_key(s: str) -> str:
    return "".join(ch for ch in s.lower() if ch.isalnum())


def get_expected_feature_names_for_model(model: Any) -> Optional[List[str]]:
    # Many sklearn estimators/pipelines expose feature_names_in_
    names = getattr(model, "feature_names_in_", None)
    if isinstance(names, (list, tuple)):
        return list(names)
    if hasattr(model, "feature_names_in_") and hasattr(model.feature_names_in_, "tolist"):
        try:
            return list(model.feature_names_in_.tolist())  # type: ignore
        except Exception:
            pass
    return None


def align_payload_to_expected(payload: Dict[str, Any], expected: List[str]) -> pd.DataFrame:
    # Build a single-row DataFrame matching expected columns.
    # Strategy:
    # 1) Direct key match
    # 2) Normalized key match
    # 3) Schema mapping for known fields
    incoming = {k: payload.get(k) for k in payload.keys()}

    norm_incoming_map: Dict[str, str] = { _normalize_key(k): k for k in incoming.keys() }

    # Known mappings from our calculator keys to dataset feature names
    def map_flight(v: Any) -> Any:
        m = {
            "never": "Never",
            "rarely": "Rarely",
            "sometimes": "Sometimes",
            "frequently": "Frequently",
        }
        return m.get(str(v).lower(), v)

    def map_diet(v: Any) -> Any:
        m = {
            "balanced": "Balanced",
            "vegetarian": "Vegetarian",
            "vegan": "Vegan",
            "meat-heavy": "Meat Heavy",
        }
        return m.get(str(v).lower(), v)

    def map_energy(v: Any) -> Any:
        m = {"low": "Low", "medium": "Medium", "high": "High"}
        return m.get(str(v).lower(), v)

    def map_cooking(v: Any) -> Any:
        m = {"gas": "Gas", "electric": "Electric", "oil": "Oil", "renewable": "Renewable"}
        return m.get(str(v).lower(), v)

    def map_vehicle(v: Any) -> Any:
        m = {"petrol": "Petrol", "diesel": "Diesel", "hybrid": "Hybrid", "electric": "Electric"}
        return m.get(str(v).lower(), v)

    schema_mapping: Dict[str, Any] = {
        # expected normalized key: function(payload) or value
        "frequencyoftravelingbyair": lambda p: map_flight(p.get("flightFrequency")),
        "diet": lambda p: map_diet(p.get("diet")),
        "energyefficiency": lambda p: map_energy(p.get("electricityUsage")),
        "cookingwith": lambda p: map_cooking(p.get("heatingSource")),
        "bodytype": lambda p: map_vehicle(p.get("vehicleType") or p.get("transport")),
        # Common numeric fields guess
        "monthlykm": lambda p: float(p.get("monthlyKm") or 0),
        "newclothesmonthly": lambda p: float(p.get("newClothesMonthly") or 0),
        "screentimedaily": lambda p: float(p.get("screenTimeDaily") or 0),
        "wastebagsperweek": lambda p: float(p.get("wasteBagsPerWeek") or 0),
        "wasterecycling": lambda p: bool(p.get("wasteRecycling")),
    }

    out: Dict[str, Any] = {}
    for col in expected:
        if col in incoming:
            out[col] = incoming[col]
            continue
        ncol = _normalize_key(col)
        # normalized incoming
        src = norm_incoming_map.get(ncol)
        if src is not None:
            out[col] = incoming[src]
            continue
        # schema mapping function
        mapper = schema_mapping.get(ncol)
        if callable(mapper):
            try:
                out[col] = mapper(payload)
                continue
            except Exception:
                pass
        # default fill
        out[col] = None

    return pd.DataFrame([out])


def apply_label_encoders(df: pd.DataFrame, enc: Any) -> pd.DataFrame:
    """Apply a dict of sklearn LabelEncoders per-column. Unseen labels map to first class.

    If enc is not a dict of LabelEncoders, returns df unchanged.
    """
    try:
        import numpy as np  # type: ignore
    except Exception:
        np = None  # type: ignore

    if not isinstance(enc, dict):
        return df
    out = df.copy()
    for col, le in enc.items():
        if col in out.columns and hasattr(le, "classes_") and hasattr(le, "transform"):
            val = out[col].iloc[0]
            try:
                # Direct transform if valid
                out[col] = le.transform([str(val)]) if out.shape[0] == 1 else le.transform(out[col].astype(str))
            except Exception:
                # Map unseen to first class
                try:
                    fallback = le.classes_[0]
                    out[col] = [fallback]
                    out[col] = le.transform(out[col].astype(str))
                except Exception:
                    # If still failing, coerce to 0
                    out[col] = 0
    # Ensure numeric dtype
    try:
        out = out.apply(pd.to_numeric, errors="coerce").fillna(0)
    except Exception:
        pass
    return out
