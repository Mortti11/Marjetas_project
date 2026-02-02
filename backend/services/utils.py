# backend/services/utils.py
import math
from typing import Any

import numpy as np
import pandas as pd


def sanitize_for_json(obj: Any) -> Any:
    """
    Recursively convert NaN / +/-inf to None so FastAPI JSONResponse
    can serialize the payload.
    Works for dicts, lists, pandas Series/DataFrames, numpy scalars/arrays.
    """
    # pandas objects
    if isinstance(obj, pd.DataFrame):
        clean_df = obj.replace([np.inf, -np.inf], np.nan)
        clean_df = clean_df.where(pd.notnull(clean_df), None)
        return clean_df.to_dict(orient="list")

    if isinstance(obj, pd.Series):
        clean_s = obj.replace([np.inf, -np.inf], np.nan)
        clean_s = clean_s.where(pd.notnull(clean_s), None)
        return clean_s.tolist()

    # numpy scalars / arrays
    if isinstance(obj, (np.floating, np.integer)):
        v = float(obj)
        return v if math.isfinite(v) else None

    if isinstance(obj, np.ndarray):
        return [sanitize_for_json(x) for x in obj.tolist()]

    # plain Python float
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None

    # containers
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}

    if isinstance(obj, (list, tuple)):
        return [sanitize_for_json(v) for v in obj]

    # everything else (str, bool, None, int, etc.)
    return obj
