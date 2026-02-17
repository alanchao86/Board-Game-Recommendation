# recommender_service/app.py
from flask import Flask, request, jsonify
import numpy as np
import pandas as pd
import pickle
from fold_in import compute_user_profile, recommend_top_n
import os
app = Flask(__name__)

# Model path is configurable for container and local runs.
MODEL_DATA_DIR = os.getenv("MODEL_DATA_DIR", "../model_data")
FLASK_HOST = os.getenv("FLASK_HOST", "0.0.0.0")
FLASK_PORT = int(os.getenv("FLASK_PORT", "5000"))

# Load the model data once when the service starts
with open(os.path.join(MODEL_DATA_DIR, "item_factors.pkl"), "rb") as f:
    model_data = pickle.load(f)

from content_based import content_based_recommender
# Load content-based model data
df_themes      = pd.read_pickle(os.path.join(MODEL_DATA_DIR, "themes.pkl"))
df_transform   = pd.read_pickle(os.path.join(MODEL_DATA_DIR, "category_transform.pkl"))
df_games       = pd.read_pickle(os.path.join(MODEL_DATA_DIR, "games.pkl"))

# Load model parameters and metadata
item_factors = model_data["item_factors"]      # shape: (num_items, n_factors)
item_biases = model_data["item_biases"]          # shape: (num_items,)
global_mean = model_data["global_mean"]
item_ids_list = model_data["item_ids_list"]      # list of raw item IDs
item_index_map = model_data["item_index_map"]    # mapping from raw item_id to index
reg_coeff = model_data["reg_coeff"]              # regularization coefficient
n_factors = item_factors.shape[1]                # number of latent factors

# Build inverse map once: raw-id -> CF row?ndex (robust join key)
rawid_to_cfidx = {raw_id: idx for idx, raw_id in enumerate(item_ids_list)}

checkbox_cols  = df_transform.columns[1:]          # order expected from UI
NUM_CHECKBOXES = len(checkbox_cols)
N_ITEMS        = len(item_ids_list)                # sanity check

# ------------------------------------------------------------------
# Utility functions
# ------------------------------------------------------------------
def normalise(arr: np.ndarray) -> np.ndarray:
    """Min?ax normalise to 0?? (no div?y?ero if all identical)."""
    amin, amax = arr.min(), arr.max()
    return (arr - amin) / (amax - amin) if amax > amin else np.zeros_like(arr)

def dynamic_alpha(num_ratings: int,
                  high: float = 0.8,
                  pivot: int = 8) -> float:
    """
    CF weight policy aligned with the presentation:
    - N = 0  -> 0.0
    - N >= 8 -> 0.8
    - otherwise linear: alpha = (N / 8) * 0.8
    """
    if num_ratings <= 0:
        return 0.0
    if num_ratings >= pivot:
        return high
    return (num_ratings / pivot) * high

# ------------------------------------------------------------------
# Flask service
# ------------------------------------------------------------------
@app.route('/recommend', methods=['POST'])
def recommend():
    """
    Expects a JSON payload:
    {
        "username": "user123",
        "ratings": [(item_id, rating), ...]  // all ratings from the user (historical + new)
        "preferences": [true, false, false, true, ...]    // length = num_checkboxes
    }
    """
    data = request.get_json()
    print(data)
    # Get the ratings list (each element is a (item_id, rating) tuple).
    ratings = data.get("ratings", [])


    pref_booleans  = data.get("preferences", [False] * NUM_CHECKBOXES)
    if len(pref_booleans) != NUM_CHECKBOXES:
        return jsonify({"error": f"'preferences' must have {NUM_CHECKBOXES} booleans"}), 400
    
    # Derive the set of rated item IDs from the ratings list.
    rated_item_ids = {item_id for (item_id, rating) in ratings}

     # ----------- 1.  CF score vector -----------
    # Compute the temporary user profile using new ratings.
    b_u, u = compute_user_profile(ratings, item_index_map, item_factors,
                                  item_biases, global_mean, reg_coeff, n_factors)

    # Generate top-N recommendations for the user.
    cf_scores = global_mean + b_u + item_biases + item_factors.dot(u)  # (N_ITEMS,)

    # ----------- 2.  CB score vector -----------
    cb_raw = content_based_recommender(pref_booleans, top_n=None) # get all scores
    cb_scores = np.zeros(N_ITEMS, dtype=np.float64)

    for row_idx, (sim, _avg) in cb_raw:
        # Map df_themes row index -> raw BGGId -> CF row index
        raw_id = df_games.iloc[row_idx]["BGGId"]      # adapt column name if needed
        cf_idx = rawid_to_cfidx.get(raw_id)
        if cf_idx is not None:
            cb_scores[cf_idx] = sim
    
    # ----------- 3.  Blend -----------
    cf_norm = normalise(cf_scores)
    cb_norm = normalise(cb_scores)

    alpha   = dynamic_alpha(len(ratings))
    hybrid  = alpha * cf_norm + (1 - alpha) * cb_norm

    # Exclude rated items!!
    for raw_id in rated_item_ids:
        idx = rawid_to_cfidx.get(raw_id)
        if idx is not None:
            hybrid[idx] = -np.inf

    # ----------- 4.  Top? -----------
    N = int(data.get("top_n", 20))
    top_idx = np.argpartition(hybrid, -N)[-N:]
    top_idx = top_idx[np.argsort(hybrid[top_idx])[::-1]]

    recommendations = [
        (int(item_ids_list[i]), float(hybrid[i])) for i in top_idx
    ]


    # ----------- 5.  Response -----------
    response = {
        "username": data.get("username", "unknown"),
        "cf_coffcicient": alpha,
        "recommendations": recommendations  # list of (item_id, predicted_rating) tuples
    }
    return jsonify(response)

if __name__ == '__main__':
    app.run(host=FLASK_HOST, port=FLASK_PORT, debug=True)

