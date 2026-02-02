"""Forecast service: small utilities to load and summarize 10-day hourly forecast CSV.

This module follows the simple patterns used in other services (lht_service, ws100_service).
"""
from pathlib import Path
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import pandas as pd
from backend.config import FORECAST_DATA_PATH, CLEANED_DATA_ROOT

import logging

logger = logging.getLogger(__name__)


def _load_forecast_df() -> pd.DataFrame | None:
    """
    Load forecast CSV, parse 'time' and ensure timestamps are timezone-aware in Europe/Helsinki.

    Implements the same fallback logic as before (configured path -> legacy file in CLEANED_DATA_ROOT).
    Returns None if file missing or parsing fails.
    """
    try:
        p = Path(FORECAST_DATA_PATH)
        if not p.exists():
            alt = Path(CLEANED_DATA_ROOT) / "jyvaskyla_weather_forecast.csv"
            if alt.exists():
                p = alt
            else:
                raise FileNotFoundError(f"Forecast CSV not found at {FORECAST_DATA_PATH}")

        # Read without forcing tz parsing; we'll normalize afterwards
        df = pd.read_csv(p, parse_dates=["time"])

        helsinki = ZoneInfo("Europe/Helsinki")
        if "time" in df.columns:
            df["time"] = pd.to_datetime(df["time"], errors="coerce")
            # if timestamps are naive, localize to Helsinki; if aware, convert
            if df["time"].dt.tz is None:
                df["time"] = df["time"].dt.tz_localize(helsinki)
            else:
                df["time"] = df["time"].dt.tz_convert(helsinki)

        if df is None or df.empty:
            raise ValueError("Forecast CSV parsed but contained no rows")

        return df
    except Exception:
        logger.exception("Failed to load forecast CSV")
        return None


def _split_current_and_window(df: pd.DataFrame):
    """
    Given a forecast dataframe with tz-aware 'time', return (current_row_series, window_df).

    current: single pandas Series for the current hour (now rounded down to hour). If exact match
    is missing, returns the nearest future row. If still missing, returns (None, None).

    window: dataframe with rows from now (inclusive) to now + 10 days (inclusive).
    """
    tz = ZoneInfo("Europe/Helsinki")
    now = datetime.now(tz).replace(minute=0, second=0, microsecond=0)
    end = now + timedelta(days=10)

    # Ensure times are in Helsinki tz
    if df["time"].dt.tz is None:
        df["time"] = df["time"].dt.tz_localize(tz)
    else:
        df["time"] = df["time"].dt.tz_convert(tz)

    # Window for 10-day summary
    window = df[(df["time"] >= now) & (df["time"] <= end)].copy()

    # Debug print window bounds
    if not window.empty:
        first_ts = window["time"].iloc[0]
        last_ts = window["time"].iloc[-1]
        print(f"[forecast_service] using forecast window from {first_ts} to {last_ts} (requested {now} -> {end})")
    else:
        print(f"[forecast_service] no forecast rows in window {now} -> {end}")

    # Current hour row – prefer the first row in the window with time >= now (truncated)
    # If none found, fall back to the last available row in the window.
    current_row = window.loc[window["time"] >= now]
    if current_row.empty:
        # fallback to last row in window
        if not window.empty:
            current = window.iloc[-1]
            return current, window
        return None, None

    current = current_row.iloc[0]
    return current, window


def summary_10d() -> dict:
    """
    Return JSON containing current hour values and 10-day aggregates.

    Structure:
    {
      "has_data": True/False,
      "current": {"timestamp": iso, "temp_C": float, "rh_pct": float},
      "summary_10d": { ... same aggregates as before ... }
    }
    """
    df = _load_forecast_df()

    empty_result = {"has_data": False}
    if df is None:
        return empty_result

    current, window = _split_current_and_window(df)
    if current is None or window is None or window.empty:
        return empty_result

    try:
        # current hour
        curr_temp = float(current["temperature_2m"]) if "temperature_2m" in current.index else None
        curr_rh = float(current["relativehumidity_2m"]) if "relativehumidity_2m" in current.index else None

        # 10-day aggregates
        win = window
        avg_temp = float(win["temperature_2m"].mean()) if "temperature_2m" in win.columns else None
        min_temp = float(win["temperature_2m"].min()) if "temperature_2m" in win.columns else None
        max_temp = float(win["temperature_2m"].max()) if "temperature_2m" in win.columns else None

        avg_rh = float(win["relativehumidity_2m"].mean()) if "relativehumidity_2m" in win.columns else None
        high_rh_pct = float((win["relativehumidity_2m"] >= 90).mean() * 100.0) if "relativehumidity_2m" in win.columns else None

        rain_col = "rain" if "rain" in win.columns else ("precipitation" if "precipitation" in win.columns else None)
        total_rain = float(win[rain_col].sum()) if rain_col is not None else 0.0
        rainy_hours = int((win[rain_col] > 0.1).sum()) if rain_col is not None else 0

        total_snow = float(win["snowfall"].sum()) if "snowfall" in win.columns else 0.0

        # Also expose flat current_* fields for easier frontend consumption
        return {
            "has_data": True,
            "current": {
                "timestamp": current["time"].isoformat(),
                "temp_C": curr_temp,
                "rh_pct": curr_rh,
            },
            # flat current_* fields
            "current_time": current["time"].isoformat(),
            "current_temp": float(curr_temp) if curr_temp is not None else None,
            "current_rh": float(curr_rh) if curr_rh is not None else None,
            "summary_10d": {
                "avg_temp": float(avg_temp) if avg_temp is not None else None,
                "min_temp": float(min_temp) if min_temp is not None else None,
                "max_temp": float(max_temp) if max_temp is not None else None,
                "avg_rh": float(avg_rh) if avg_rh is not None else None,
                "high_rh_pct": float(high_rh_pct) if high_rh_pct is not None else None,
                "total_rain_mm": float(total_rain),
                "rainy_hours": int(rainy_hours),
                "total_snow_mm": float(total_snow),
            },
        }
    except Exception:
        logger.exception("Failed to aggregate forecast summary")
        return empty_result
