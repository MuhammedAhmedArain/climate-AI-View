# ML Artifacts

Place your trained model files here. Recommended filenames:

- `model.pkl` — your trained estimator/model
- `scaler.pkl` — feature scaler (e.g., StandardScaler)
- `encoder.pkl` — categorical encoder (e.g., OneHotEncoder/LabelEncoder)

Optional environment variable (override location):
- `MODEL_DIR` — absolute or relative path to the directory containing these files.

These artifacts are loaded by `utils/model_artifacts.py` with simple getters and caching.
