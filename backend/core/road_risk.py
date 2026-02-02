import pandas as pd
import numpy as np
from typing import Literal

SlipperyLevel = Literal["low", "medium", "high"]

def add_slippery_risk(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add two columns to an hourly forecast+flags DataFrame:
    - slippery_score: int in [0, 100]
    - slippery_level: 'low' | 'medium' | 'high'
    The input df is expected to come from build_forecast_windows(...).
    """
    # Ensure we work on a copy to avoid side effects
    df = df.copy()
    
    # Helpers
    # is_freezing_band = (df["temp_C"] >= -4.0) & (df["temp_C"] <= 1.0)
    is_freezing_band = (df["temp_C"] >= -4.0) & (df["temp_C"] <= 1.0)
    
    # recent_wet = df["wet_or_rain"] | df["wet_or_rain"].shift(1, fill_value=False) | df["wet_or_rain"].shift(2, fill_value=False)
    # wet_or_rain is boolean. shift fills with NaN for object/float, but if boolean dtype it might need care.
    # Let's ensure it's treated as boolean/int for bitwise OR.
    wet_series = df["wet_or_rain"].fillna(False).astype(bool)
    recent_wet = wet_series | wet_series.shift(1, fill_value=False) | wet_series.shift(2, fill_value=False)
    
    # black_ice_candidate
    black_ice_candidate = (
        is_freezing_band
        & recent_wet
        & (df["rh_pct"] >= 95.0)
        & (df["dp_spread_C"] <= 1.0)
    )
    
    # is_snow_or_mix
    is_snow_or_mix = df["ptype_hour"].isin(["Snow", "Mix"])
    
    # Start score
    score = pd.Series(0.0, index=df.index)
    
    # Add components
    score += recent_wet.astype(float) * 30.0
    score += is_freezing_band.astype(float) * 30.0
    score += black_ice_candidate.astype(float) * 20.0
    score += is_snow_or_mix.astype(float) * 10.0
    
    # Commute boost
    # hour = df["timestamp"].dt.hour
    # is_commute = hour.isin([5, 6, 7, 8, 16, 17, 18, 19])
    # Note: timestamp should be timezone aware (Helsinki) from forecast_adapter.
    # If it's not, dt.hour is just hour. If it is, it's local hour.
    # forecast_adapter ensures Europe/Helsinki.
    hour = df["timestamp"].dt.hour
    is_commute = hour.isin([5, 6, 7, 8, 16, 17, 18, 19])
    score += is_commute.astype(float) * 10.0
    
    # Clip and cast
    score = score.clip(lower=0.0, upper=100.0).round().astype(int)
    
    # Map to levels
    # >= 70 high, >= 40 medium, else low
    conditions = [
        score >= 70,
        score >= 40
    ]
    choices = ["high", "medium"]
    # np.select evaluates conditions in order.
    # If score >= 70, it matches first.
    # If 40 <= score < 70, it matches second.
    # Else "low".
    
    levels = np.select(conditions, choices, default="low")
    
    df["slippery_score"] = score
    df["slippery_level"] = levels
    
    return df
