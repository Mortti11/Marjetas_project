import pandas as pd
import numpy as np
from .physics import vpd_kpa
from .pair_core import add_environment_flags
from .thresholds import DEFAULT_THRESHOLDS
from .road_risk import add_slippery_risk
from .event_core import detect_events, build_event_windows, compute_event_drying_times
from typing import List, Dict, Any
import numpy as np

def forecast_to_pair_hourly(forecast_df: pd.DataFrame) -> pd.DataFrame:
    """
    Adapt Open-Meteo hourly forecast for Jyväskylä into the schema expected
    by add_environment_flags() and detect_events(), for a single city-level zone.
    """
    # Ensure timezone awareness (Europe/Helsinki) and sorting
    df = forecast_df.copy()
    if not pd.api.types.is_datetime64_any_dtype(df["time"]):
        df["time"] = pd.to_datetime(df["time"])
    
    # If naive, assume UTC and convert to Helsinki, or if already aware, convert to Helsinki
    # Open-Meteo usually returns UTC if not specified, or requested timezone.
    # We'll assume the input might be naive (UTC) or aware.
    # Best practice: ensure it ends up as Europe/Helsinki.
    # However, the user prompt says "Ensure forecast_df['time'] is timezone-aware (Europe/Helsinki)"
    # We will try to localize if naive, or convert if aware.
    
    if df["time"].dt.tz is None:
         # Assuming input is UTC if naive, then convert to Helsinki
         # But usually Open-Meteo libraries might give naive local time if requested.
         # Let's assume we need to localize to Helsinki directly if it looks like local time, 
         # OR assume UTC. 
         # Given "Ensure ... is timezone-aware", let's assume we standardize on Helsinki.
         # Let's assume the incoming dataframe has a "time" column that needs to be treated carefully.
         # For safety, let's just ensure it is set to the target timezone.
         # If the user fetches it as "auto" timezone from OpenMeteo, it might be naive local.
         # Let's assume we just localize to Helsinki.
         df["time"] = df["time"].dt.tz_localize("Europe/Helsinki", ambiguous="NaT", nonexistent="shift_forward")
    else:
         df["time"] = df["time"].dt.tz_convert("Europe/Helsinki")
         
    df = df.sort_values("time")

    pair_df = pd.DataFrame()
    pair_df["timestamp"] = df["time"]
    pair_df["temp_C"] = df["temperature_2m"].astype(float)
    pair_df["rh_pct"] = df["relativehumidity_2m"].astype(float)
    pair_df["dewpoint_C"] = df["dewpoint_2m"].astype(float)
    
    # Derived
    pair_df["dp_spread_C"] = pair_df["temp_C"] - pair_df["dewpoint_C"]
    
    # Map others
    pair_df["rain_mm_hour"] = df["rain"].astype(float)
    pair_df["snow_mm_hour"] = df["snowfall"].astype(float)
    pair_df["wind_speed_kmh"] = df["windspeed_10m"].astype(float)
    pair_df["wind_direction_deg"] = df["winddirection_10m"].astype(float)
    pair_df["surface_pressure_hpa"] = df["surface_pressure"].astype(float)
    
    # VPD
    pair_df["vpd_kpa"] = vpd_kpa(pair_df["temp_C"], pair_df["rh_pct"])
    
    # Ptype logic
    # if snowfall > 0 and temp_C <= -0.5: "Snow"
    # elif rain > 0 and temp_C >= 1.0: "Rain"
    # elif (rain > 0 and snowfall > 0) or (-2.0 <= temp_C <= 1.0): "Mix"
    # else: "NoData" (or "None" / "Dry"?) -> User said "NoData" in the example else block, 
    # but usually "NoData" implies missing. If it's dry, maybe we want "NoData" as the default for "no precip type"?
    # The prompt says: else: "NoData". I will follow that.
    
    def get_ptype(row):
        rain = row["rain_mm_hour"]
        snow = row["snow_mm_hour"]
        temp = row["temp_C"]
        
        if snow > 0 and temp <= -0.5:
            return "Snow"
        elif rain > 0 and temp >= 1.0:
            return "Rain"
        elif (rain > 0 and snow > 0) or (rain > 0 and -2.0 <= temp <= 1.0) or (snow > 0 and -2.0 <= temp <= 1.0):
             # The user prompt logic was:
             # elif (rain > 0 and snowfall > 0) or (-2.0 <= temp_C <= 1.0): "Mix"
             # Wait, the second condition (-2.0 <= temp_C <= 1.0) is very broad. 
             # It implies ANY temp in that range is "Mix"? That seems wrong if there is no precip.
             # I should probably check if there is ANY precip.
             # Let's look closer at the user prompt:
             # if snowfall > 0 and temp_C <= -0.5: "Snow"
             # elif rain > 0 and temp_C >= 1.0: "Rain"
             # elif (rain > 0 and snowfall > 0) or (-2.0 <= temp_C <= 1.0): "Mix"
             # else: "NoData"
             
             # This logic seems to imply that if temp is between -2 and 1, it is Mix, regardless of precip?
             # That might be a "potential ptype" logic, or maybe the user implies "if there is precip".
             # However, the user said "Derive ptype_hour (string) from rain, snowfall, weathercode, and temp_C with a simple deterministic rule".
             # And gave that example.
             # If I follow it strictly:
             # If temp is 0.0 and rain=0, snow=0 -> It hits the "Mix" condition.
             # That seems weird for "ptype" (Precipitation Type). Usually "NoData" or "None" if dry.
             # But maybe "NoData" is what they want for "Dry" too? Or maybe they only care about ptype when raining?
             # Let's assume the user wants strictly that logic.
             # BUT, usually ptype is only relevant if precip > 0.
             # Let's refine the "Mix" logic to be safer, or just follow instructions blindly?
             # "Use ... simple deterministic rule, e.g.:" -> "e.g." implies example.
             # I should probably make it sensible.
             # If rain=0 and snow=0, it should probably be "NoData" (or "Dry" if that was an option, but "NoData" is the requested fallback).
             # So I will add a check for precip > 0 for the Mix case, OR assume the user meant "If precip is happening...".
             # Actually, let's look at the weathercode. The user mentioned "weathercode" in the input list but didn't use it in the example logic.
             # I'll stick to the example logic but add `(rain > 0 or snow > 0)` constraint for the Mix case if it relies on temp, 
             # OR just implement exactly as requested and let the user correct if it's weird.
             # "elif (rain > 0 and snowfall > 0) or (-2.0 <= temp_C <= 1.0): 'Mix'"
             # This literally says if temp is in range, it's Mix.
             # I will implement it but maybe add a guard: if rain+snow == 0, return "NoData"?
             # No, `add_environment_flags` uses `ptype_hour` in `df["is_raining"] = (rain > th.rain_event_mm_h) & df["ptype_hour"].isin(["Rain", "Mix", "Snow"])`.
             # So if ptype is "Mix" but rain is 0, `is_raining` will be false (0 > 0.2 is false).
             # So it doesn't hurt if ptype is "Mix" when dry, as long as rain amount is 0.
             # So I will follow the logic strictly.
             pass
        
        if snow > 0 and temp <= -0.5:
            return "Snow"
        elif rain > 0 and temp >= 1.0:
            return "Rain"
        elif (rain > 0 and snow > 0) or (-2.0 <= temp <= 1.0):
            # Note: This will label dry hours between -2 and 1 as "Mix".
            # As analyzed, this is harmless for `is_raining` flag.
            return "Mix"
        else:
            return "NoData"

    pair_df["ptype_hour"] = pair_df.apply(get_ptype, axis=1)
    
    # Select final columns
    cols = [
        "timestamp", "temp_C", "rh_pct", "dewpoint_C", "dp_spread_C", 
        "rain_mm_hour", "wind_speed_kmh", "wind_direction_deg", 
        "surface_pressure_hpa", "vpd_kpa", "ptype_hour"
    ]
    # Snow is not in the requested return list, but let's keep it if useful? 
    # User said: 'Return pair_df with at least these columns: ["timestamp", ... "ptype_hour"]'
    # So I will return exactly that list to be clean.
    
    return pair_df[cols]


def build_forecast_windows(forecast_df: pd.DataFrame) -> pd.DataFrame:
    """
    Convenience wrapper:
    - calls forecast_to_pair_hourly(...)
    - then calls add_environment_flags(...)
    - returns the hourly DataFrame with wet_or_rain and dry_enough_city flags for the forecast period.
    """
    pair_df = forecast_to_pair_hourly(forecast_df)
    
    # We use DEFAULT_THRESHOLDS from thresholds.py (imported)
    # add_environment_flags defaults to DEFAULT_THRESHOLDS if None passed.
    flagged_df = add_environment_flags(pair_df, thresholds=DEFAULT_THRESHOLDS)
    
    return flagged_df


def build_forecast_with_risk(forecast_df: pd.DataFrame) -> pd.DataFrame:
    """
    Convenience wrapper:
    - build_forecast_windows(...)
    - then add_slippery_risk(...)
    """
    df = build_forecast_windows(forecast_df)
    df = add_slippery_risk(df)
    return df


def build_forecast_events_with_drying(forecast_df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    From Open-Meteo forecast:
    - adapt to pair_hourly
    - add environment flags
    - detect forecast events
    - estimate drying time for each event using dry_enough_city
    Returns a list of dicts, one per event, suitable for JSON / UI.
    """
    # 1. Adapt and flag
    pair_df = build_forecast_windows(forecast_df)
    
    # 2. Detect events
    events_df = detect_events(
        pair_df, 
        rain_threshold=DEFAULT_THRESHOLDS.rain_event_mm_h, 
        max_gap_hours=4
    )
    
    if events_df.empty:
        return []
        
    # 3. Build windows to find drying times
    # We use a large post_h to ensure we look far enough into the future (up to 10 days)
    # The function clips to available data in pair_df anyway.
    windows_df = build_event_windows(pair_df, events_df, pre_h=0, post_h=240)
    
    # 4. Compute drying times
    drying_df = compute_event_drying_times(windows_df)
    
    # Handle case where drying_df is empty and has no columns (if no drying times found)
    if "event_id" not in drying_df.columns:
        drying_df = pd.DataFrame(columns=["event_id", "drying_hours_from_end"])
    
    # 5. Merge and format
    # drying_df has [event_id, drying_hours_from_start, drying_hours_from_end, drying_hours]
    # events_df has [event_id, start_ts, end_ts, duration_h, mm_total, ptype_main, event_intensity, ...]
    
    # We want to return a list of dicts.
    # Let's iterate over events_df and look up drying info.
    
    results = []
    for _, ev in events_df.iterrows():
        event_id = ev["event_id"]
        
        # Find drying info
        drying_row = drying_df[drying_df["event_id"] == event_id]
        drying_h = None
        if not drying_row.empty:
            val = drying_row.iloc[0]["drying_hours_from_end"]
            if not pd.isna(val):
                drying_h = float(val)
        
        # Construct record
        rec = {
            "event_id": int(event_id),
            "start_ts": ev["start_ts"].isoformat(),
            "end_ts": ev["end_ts"].isoformat(),
            "duration_h": float(ev["duration_h"]),
            "mm_total": float(ev["mm_total"]),
            "ptype_main": str(ev["ptype_main"]),
            "event_intensity": str(ev["event_intensity"]),
            "drying_hours_from_end": drying_h
        }
        results.append(rec)
        
    return results
