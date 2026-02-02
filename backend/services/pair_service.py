from pathlib import Path
import numpy as np
import math
from collections.abc import Mapping, Sequence

import pandas as pd
from fastapi import FastAPI, HTTPException
from backend.services import pair_service

import numpy as np 
from backend.config import LHT_DATA_DIR, WS100_DATA_DIR, WIND_DATA_PATH
from backend.core.io_lht import clean_lht_sensor, aggregate_lht_hourly
from backend.core.io_ws100 import clean_ws100_sensor, aggregate_ws100_hourly
from backend.core.io_wind import load_wind_hourly
from backend.core.pair_core import build_pair_hourly, add_environment_flags
from backend.core.event_core import (
    detect_events,
    build_event_windows,
    aggregate_environment,
    aggregate_fractions,
    build_rh_heatmap,
)
from backend.services import lht_service, ws100_service

DEFAULT_LHT = "Kaunisharjuntie"
DEFAULT_WS100 = "Kotaniementie"


def demo_analysis() -> dict:
    """
    Combine the demo LHT and WS100 summaries into a single analysis payload.

    This is a placeholder for the real merged analysis (LHT + WS100 + wind + events).
    Later we will replace the internals with the real logic, but keep the same shape.
    """
    lht_stats = lht_service.demo_summary()
    ws_stats = ws100_service.demo_summary()

    return {
        "lht": lht_stats,
        "ws100": ws_stats,
    }
    
def _deep_clean(obj):
    """
    Recursively walk any nested dict/list and make it JSON-safe:

    - np.floating / np.integer -> plain float / int
    - NaN / +/-inf             -> None
    """
    if isinstance(obj, dict):
        return {k: _deep_clean(v) for k, v in obj.items()}

    if isinstance(obj, list):
        return [_deep_clean(v) for v in obj]

    # NumPy scalars
    if isinstance(obj, (np.floating, np.integer)):
        v = float(obj)
        return v if np.isfinite(v) else None

    # Plain Python float
    if isinstance(obj, float):
        return obj if np.isfinite(obj) else None

    return obj


def _df_to_json_records(df: pd.DataFrame) -> list[dict]:
    """
    Convert a DataFrame to a list of JSON-safe records:
    - replace +/-inf with NaN
    - replace NaN with None
    """
    if df is None or df.empty:
        return []

    clean = df.replace([np.inf, -np.inf], np.nan)
    clean = clean.where(clean.notna(), None)
    return clean.to_dict(orient="records")


def _safe_float_matrix(matrix) -> list[list[float | None]]:
    """
    Convert a 2D matrix (list-of-lists or np.array) to JSON-safe floats,
    mapping NaN/inf to None.
    """
    safe_rows: list[list[float | None]] = []
    if matrix is None:
        return safe_rows

    for row in matrix:
        safe_row: list[float | None] = []
        for v in list(row):
            if v is None:
                safe_row.append(None)
            elif isinstance(v, (float, int)):
                if not np.isfinite(v):
                    safe_row.append(None)
                else:
                    safe_row.append(float(v))
            else:
                safe_row.append(None)
        safe_rows.append(safe_row)
    return safe_rows

def _make_json_safe(obj):
    """
    Recursively convert a nested structure (dict/list/tuple/values)
    into something that json.dumps(..., allow_nan=False) accepts:
    - Replace NaN / +/-inf with None
    - Convert pandas/NumPy scalars to plain Python types
    - Convert Timestamps/datetimes to ISO strings
    - Leave ints/str/bool/None as-is
    - Convert unknown types to str(...)
    """
    # Floats: kill NaN/inf
    if isinstance(obj, float):
        return float(obj) if math.isfinite(obj) else None

    # Basic types
    if obj is None or isinstance(obj, (int, str, bool)):
        return obj

    # Pandas / numpy scalars
    if isinstance(obj, (np.floating, np.integer)):
        v = float(obj)
        return v if math.isfinite(v) else None

    # Timestamps / datetimes
    if isinstance(obj, (pd.Timestamp,)):
        return obj.isoformat()

    # Mappings (dict-like)
    if isinstance(obj, Mapping):
        return {str(k): _make_json_safe(v) for k, v in obj.items()}

    # Sequences (list/tuple) but not strings/bytes
    if isinstance(obj, Sequence) and not isinstance(obj, (str, bytes, bytearray)):
        return [_make_json_safe(v) for v in obj]

    # Fallback: string representation
    return str(obj)


def compute_daily_summary(df_day: pd.DataFrame) -> dict:
    """
    Compute daily-level stats from one day's hourly merged data.

    Expects columns at least:
      temp_C, rh_pct, rain_mm_hour, vpd_kpa,
      is_raining, wet_or_rain, dry_enough_city, dry_enough_strict.
    """

    if df_day.empty:
        return {
            "rows": 0,
            "T_mean": None,
            "T_min": None,
            "T_max": None,
            "RH_mean": None,
            "RH_min": None,
            "RH_max": None,
            "rain_total_mm": None,
            "rain_hours": None,
            "wet_hours": None,
            "dry_city_hours": None,
            "dry_strict_hours": None,
        }

    T = df_day["temp_C"]
    RH = df_day["rh_pct"]
    rain = df_day["rain_mm_hour"]

    return {
        "rows": int(len(df_day)),
        "T_mean": float(T.mean()),
        "T_min": float(T.min()),
        "T_max": float(T.max()),
        "RH_mean": float(RH.mean()),
        "RH_min": float(RH.min()),
        "RH_max": float(RH.max()),
        "rain_total_mm": float(rain.sum()),
        "rain_hours": int((rain > 0.0).sum()),
        "wet_hours": int(df_day["wet_or_rain"].sum()),
        "dry_city_hours": int(df_day["dry_enough_city"].sum()),
        "dry_strict_hours": int(df_day["dry_enough_strict"].sum()),
    }
    
    


def pair_hourly_preview(
    lht_sensor: str = DEFAULT_LHT,
    ws100_sensor: str = DEFAULT_WS100,
    max_hours: int = 168,
) -> dict:
    """
    Load real CSVs for one LHT + WS100 pair, build the merged hourly dataset
    with environment flags, and return a lightweight JSON preview.
    """

    # --- LHT ---
    lht_path = Path(LHT_DATA_DIR) / f"{lht_sensor}.csv"
    lht_raw = pd.read_csv(lht_path)
    lht_clean = clean_lht_sensor(lht_raw)
    lht_hourly = aggregate_lht_hourly(lht_clean)

    # --- WS100 ---
    ws_path = Path(WS100_DATA_DIR) / f"df_{ws100_sensor}.csv"
    ws_raw = pd.read_csv(ws_path)
    ws_clean = clean_ws100_sensor(ws_raw, rain_col="precipitationQuantityDiff_mm")
    ws_hourly = aggregate_ws100_hourly(ws_clean)

    # --- Wind (single global station) ---
    wind_hourly = load_wind_hourly(WIND_DATA_PATH)

    # --- Merge + flags ---
    pair_hourly = build_pair_hourly(lht_hourly, ws_hourly, wind_hourly)
    pair_hourly = add_environment_flags(pair_hourly)

    pair_hourly = pair_hourly.sort_values("timestamp")
    if max_hours is not None:
        pair_hourly = pair_hourly.tail(max_hours)

    # Select columns for sample
    cols = [
        "timestamp",
        "temp_C",
        "rh_pct",
        "dewpoint_C",
        "dp_spread_C",
        "vpd_kpa",
        "rain_mm_hour",
        "ptype_hour",
        "wind_speed_kmh",
        "wind_direction_deg",
        "wind_gusts_kmh",
        "surface_pressure_hpa",
        "is_raining",
        "leaf_wetness",
        "wet_or_rain",
        "dry_enough_city",
        "dry_enough_strict",
    ]
    cols = [c for c in cols if c in pair_hourly.columns]

    return {
        "lht_sensor": lht_sensor,
        "ws100_sensor": ws100_sensor,
        "n_hours": int(len(pair_hourly)),
        "start": pair_hourly["timestamp"].min().isoformat() if not pair_hourly.empty else None,
        "end": pair_hourly["timestamp"].max().isoformat() if not pair_hourly.empty else None,
        # keep the sample small so frontend can inspect structure;
        # charts can use a separate endpoint later
        "sample": pair_hourly[cols].tail(48).to_dict(orient="records"),
    }



def pair_daily_analysis(
    lht_sensor: str,
    ws100_sensor: str,
    date_str: str,
) -> dict:
    """
    Analyze one day for a sensor pair.
    
    Args:
        lht_sensor: LHT sensor name
        ws100_sensor: WS100 sensor name
        date_str: date string in YYYY-MM-DD format
    
    Returns:
        {
            "date": str,
            "lht_sensor": str,
            "ws100_sensor": str,
            "summary": { daily stats },
            "hourly": [ array of hourly records for the day ]
        }
    """
    # Load and merge all data (same as pair_hourly_preview)
    lht_path = Path(LHT_DATA_DIR) / f"{lht_sensor}.csv"
    lht_raw = pd.read_csv(lht_path)
    lht_clean = clean_lht_sensor(lht_raw)
    lht_hourly = aggregate_lht_hourly(lht_clean)

    ws_path = Path(WS100_DATA_DIR) / f"df_{ws100_sensor}.csv"
    ws_raw = pd.read_csv(ws_path)
    ws_clean = clean_ws100_sensor(ws_raw, rain_col="precipitationQuantityDiff_mm")
    ws_hourly = aggregate_ws100_hourly(ws_clean)

    wind_hourly = load_wind_hourly(WIND_DATA_PATH)

    pair_hourly = build_pair_hourly(lht_hourly, ws_hourly, wind_hourly)
    pair_hourly = add_environment_flags(pair_hourly)

    # Filter to the target date
    pair_hourly["date_str"] = pair_hourly["timestamp"].dt.strftime("%Y-%m-%d")
    df_day = pair_hourly[pair_hourly["date_str"] == date_str].copy()

    # Compute daily summary
    summary = compute_daily_summary(df_day)

    # --- Make hourly records JSON-friendly ---

    # 1) Drop helper column
    df_day = df_day.drop(columns=["date_str"], errors="ignore")

    # 2) Ensure timestamp is a plain ISO string
    df_day["timestamp"] = pd.to_datetime(df_day["timestamp"]).dt.strftime(
    "%Y-%m-%dT%H:%M:%S")

    # 3) Replace NaN with None so JSON encoder doesn't choke
    df_day = df_day.replace({np.nan: None})

    # 4) (Optional but cleaner) select only the useful columns for the API
    columns = [
        "timestamp",
        "temp_C",
        "rh_pct",
        "dewpoint_C",
        "dp_spread_C",
        "vpd_kpa",
        "rain_mm_hour",
        "ptype_hour",
        "wind_speed_kmh",
        "wind_direction_deg",
        "wind_gusts_kmh",
        "surface_pressure_hpa",
        "is_raining",
        "wet_or_rain",
        "dry_enough_city",
        "dry_enough_strict",
    ]
    # keep only columns that actually exist (defensive)
    columns = [c for c in columns if c in df_day.columns]

    hourly_records = df_day[columns].to_dict(orient="records")

    return {
        "date": date_str,
        "lht_sensor": lht_sensor,
        "ws100_sensor": ws100_sensor,
        "summary": summary,
        "hourly": hourly_records,
    }
def _events_to_records(df: pd.DataFrame) -> list[dict]:
    """Convert events DataFrame to JSON-safe records."""
    if df is None or df.empty:
        return []
    out = df.copy()
    # Normalize timestamps to ISO strings
    for col in ["start_ts", "end_ts"]:
        if col in out.columns:
            out[col] = pd.to_datetime(out[col]).dt.strftime("%Y-%m-%dT%H:%M:%S")
    # Cast numerics to float, sanitize NaN/inf -> None
    out = out.replace([np.inf, -np.inf], np.nan)
    out = out.where(out.notna(), None)
    
    # Select columns if they exist
    desired_cols = [
        "event_id",
        "start_ts",
        "end_ts",
        "start_date",
        "duration_h",
        "mm_total",
        "ptype_main",
        "event_intensity",
        "drying_hours_from_start",
        "drying_hours_from_end",
        "drying_hours",
    ]
    cols = [c for c in desired_cols if c in out.columns]
    return out[cols].to_dict(orient="records")


def pair_event_aggregates(
    date_str: str,
    lht_sensor: str = DEFAULT_LHT,
    ws100_sensor: str = DEFAULT_WS100,
    pre_h: int = 6,
    post_h: int = 12,
) -> dict:
    """
    Build event-aggregated analysis around precipitation events.

    Steps:
      1. Load & merge hourly pair with environment flags.
      2. Detect precipitation events.
      3. Restrict events to those starting on date_str for window aggregation.
      4. Build windows (pre_h hours before, post_h hours after).
      5. Aggregate environment metrics & wet/dry fractions.
      6. Build RH heatmap for event dates (restricted to date_str).
    """
    # --- Load & merge (same logic as pair_daily_analysis) ---
    lht_path = Path(LHT_DATA_DIR) / f"{lht_sensor}.csv"
    lht_raw = pd.read_csv(lht_path)
    lht_clean = clean_lht_sensor(lht_raw)
    lht_hourly = aggregate_lht_hourly(lht_clean)

    ws_path = Path(WS100_DATA_DIR) / f"df_{ws100_sensor}.csv"
    ws_raw = pd.read_csv(ws_path)
    ws_clean = clean_ws100_sensor(ws_raw, rain_col="precipitationQuantityDiff_mm")
    ws_hourly = aggregate_ws100_hourly(ws_clean)

    wind_hourly = load_wind_hourly(WIND_DATA_PATH)

    pair_hourly = build_pair_hourly(lht_hourly, ws_hourly, wind_hourly)
    pair_hourly = add_environment_flags(pair_hourly)
    pair_hourly = pair_hourly.sort_values("timestamp")

    # --- Detect events over full record ---
    events_df = detect_events(pair_hourly)

    # --- Filter events for target date ---
    date_events = events_df[events_df["start_date"] == date_str].copy()

    # --- Build windows & aggregates for *this* date ---
    windows = build_event_windows(
        pair_hourly,
        date_events,
        pre_h=pre_h,
        post_h=post_h,
    )

    if not windows.empty:
        env_df = aggregate_environment(windows)
        frac_df, drying_stats = aggregate_fractions(windows)
        
        # Merge per-event drying times back into date_events for the response
        # aggregate_fractions calls compute_event_drying_times internally, but we need the raw DF here too
        from backend.core.event_core import compute_event_drying_times
        drying_times_df = compute_event_drying_times(windows)
        
        if not drying_times_df.empty:
            # Merge drying info into date_events
            date_events = date_events.merge(drying_times_df, on="event_id", how="left")
    else:
        env_df = pd.DataFrame()
        frac_df = pd.DataFrame()
        drying_stats = {}

    # --- Heatmap ONLY for this date's event days ---
    if not date_events.empty:
        hm_raw = build_rh_heatmap(pair_hourly, date_events)
        heatmap_payload = {
            "dates": [str(d) for d in hm_raw.get("dates", [])],
            "hours": [int(h) for h in hm_raw.get("hours", [])],
            "rh_matrix": _safe_float_matrix(hm_raw.get("rh_matrix")),
        }
    else:
        heatmap_payload = None

    # --- JSON payloads with NaN/inf handled ---

    # Environment: one row per hour offset from event start
    environment_payload = _df_to_json_records(env_df) if not env_df.empty else None

    # Fractions: records + median drying, both cleaned
    frac_records = _df_to_json_records(frac_df) if not frac_df.empty else []

    # Clean stats
    cleaned_stats = {}
    for k, v in drying_stats.items():
        if v is not None:
            try:
                m = float(v)
                if np.isfinite(m):
                    cleaned_stats[k] = m
                else:
                    cleaned_stats[k] = None
            except Exception:
                cleaned_stats[k] = None
        else:
            cleaned_stats[k] = None

    # Documentation for drying metrics:
    # median_drying_h: Hours since event END (main metric used by frontend).
    # median_drying_h_from_start: Hours since event START.
    # median_drying_h_from_end: Hours since event END (same as median_drying_h, kept for explicitness).
    # Definition: First 2-hour window where dry_enough_city is True (using EnvironmentThresholds).
    fractions_payload = (
        {
            "records": frac_records,
            "median_drying_h": cleaned_stats.get("median_drying_h"),
            "median_drying_h_from_start": cleaned_stats.get("median_drying_h_from_start"),
            "median_drying_h_from_end": cleaned_stats.get("median_drying_h_from_end"),
        }
        if frac_records or cleaned_stats
        else None
    )

    result = {
        "date": date_str,
        "lht_sensor": lht_sensor,
        "ws100_sensor": ws100_sensor,
        "pre_h": int(pre_h),
        "post_h": int(post_h),
        "heatmap": heatmap_payload,
        "environment": environment_payload,
        "fractions": fractions_payload,
        "events": _events_to_records(date_events),
        "n_events_all": int(len(events_df)),
        "n_events_date": int(len(date_events)),
    }

    # Final safety net: clean EVERYTHING before FastAPI sees it
    return _deep_clean(result)

