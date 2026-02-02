import pandas as pd
import numpy as np
from .thresholds import DEFAULT_THRESHOLDS

PRECIP_TYPES = {"Rain", "Mix", "Snow"}

def classify_event_intensity(mm: float) -> str:
    if mm is None or np.isnan(mm):
        return "unknown"
    if mm < 5.0:
        return "light"
    if mm < 20.0:
        return "moderate"
    if mm < 40.0:
        return "heavy"
    return "extreme"

def detect_events(
    pair_hourly: pd.DataFrame,
    rain_threshold: float = DEFAULT_THRESHOLDS.rain_event_mm_h,
    max_gap_hours: int = 4,) -> pd.DataFrame:

    if pair_hourly.empty:
        return pd.DataFrame(columns=[
            "event_id", "start_ts", "end_ts", "start_date",
            "duration_h", "mm_total", "ptype_main", "event_intensity"
        ])

    df = pair_hourly.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])  
    rain = df.get("rain_mm_hour", 0).fillna(0).astype(float)
    ptype = df.get("ptype_hour", "NoData").astype(str)

    mask = (rain >= rain_threshold) | (ptype.isin(PRECIP_TYPES))
    rainy = df.loc[mask, ["timestamp"]].sort_values("timestamp")
    if rainy.empty:
        return pd.DataFrame(columns=[
            "event_id", "start_ts", "end_ts", "start_date",
            "duration_h", "mm_total", "ptype_main", "event_intensity"
        ])

    events = []
    current_start = None
    last_ts = None
    event_id = 0
    for ts in rainy["timestamp"]:
        if current_start is None:
            # start first event
            event_id += 1
            current_start = ts
            last_ts = ts
            continue
        gap_h = (ts - last_ts) / pd.Timedelta(hours=1)
        if gap_h <= max_gap_hours:
            # continue same event
            last_ts = ts
        else:
            # close previous and start new
            events.append({
                "event_id": event_id,
                "start_ts": current_start,
                "end_ts": last_ts,
                "start_date": current_start.strftime("%Y-%m-%d"),
            })
            event_id += 1
            current_start = ts
            last_ts = ts
    # append final event
    if current_start is not None:
        events.append({
            "event_id": event_id,
            "start_ts": current_start,
            "end_ts": last_ts,
            "start_date": current_start.strftime("%Y-%m-%d"),
        })

    # Enrich events with stats (mm_total, duration, intensity)
    enriched = []
    for ev in events:
        # Slice original df to get all hours in [start_ts, end_ts]
        # This includes the gaps if they were bridged
        sub = df[(df["timestamp"] >= ev["start_ts"]) & (df["timestamp"] <= ev["end_ts"])]
        
        mm_total = sub["rain_mm_hour"].sum() if "rain_mm_hour" in sub.columns else 0.0
        # Duration in hours. Since it's hourly data, count of rows is hours (inclusive)
        duration_h = len(sub)
        
        # ptype_main: most frequent ptype
        ptype_main = "Unknown"
        if "ptype_hour" in sub.columns:
            counts = sub["ptype_hour"].value_counts()
            if not counts.empty:
                ptype_main = counts.index[0]

        ev["duration_h"] = float(duration_h)
        ev["mm_total"] = float(mm_total)
        ev["ptype_main"] = str(ptype_main)
        ev["event_intensity"] = classify_event_intensity(float(mm_total))
        enriched.append(ev)

    return pd.DataFrame(enriched)


def build_event_windows(
    pair_hourly: pd.DataFrame,
    events_df: pd.DataFrame,
    pre_h: int,
    post_h: int,
) -> pd.DataFrame:
    """Construct per-event time windows around the start timestamp.

    For each event take rows where timestamp in [start_ts - pre_h, start_ts + post_h].
    rel_hour is (timestamp - start_ts) in hours (can be negative for pre window).
    
    IMPORTANT: Creates a complete hourly time series for each event window,
    even if source data has gaps. Missing hours will have NaN values.

    Returns combined DataFrame with columns:
      event_id, timestamp, rel_hour,
      rh_pct, dp_spread_C, vpd_kpa, wind_speed_kmh, wind_direction_deg, 
      wind_gusts_kmh, surface_pressure_hpa, wet_or_rain, dry_enough_city
    """
    if pair_hourly.empty or events_df.empty:
        return pd.DataFrame(columns=[
            "event_id", "timestamp", "rel_hour", "rh_pct", "dp_spread_C",
            "vpd_kpa", "wind_speed_kmh", "wind_direction_deg", "wind_gusts_kmh",
            "surface_pressure_hpa", "wet_or_rain", "dry_enough_city"
        ])

    base = pair_hourly.copy()
    base["timestamp"] = pd.to_datetime(base["timestamp"])
    rows = []
    
    for _, ev in events_df.iterrows():
        start_ts = pd.to_datetime(ev["start_ts"]) if not isinstance(ev["start_ts"], pd.Timestamp) else ev["start_ts"]
        window_start = start_ts - pd.Timedelta(hours=pre_h)
        window_end = start_ts + pd.Timedelta(hours=post_h)
        
        # Create COMPLETE hourly time range for this window
        complete_range = pd.date_range(
            start=window_start,
            end=window_end,
            freq='h'
        )
        
        # Build a dataframe with all hours
        complete_df = pd.DataFrame({'timestamp': complete_range})
        complete_df['event_id'] = int(ev["event_id"])
        complete_df['start_ts'] = start_ts
        complete_df['end_ts'] = pd.to_datetime(ev["end_ts"])
        complete_df['rel_hour'] = (complete_df["timestamp"] - start_ts) / pd.Timedelta(hours=1)
        
        # Get actual data for this window
        subset = base[(base["timestamp"] >= window_start) & (base["timestamp"] <= window_end)].copy()
        
        # Merge complete time range with available data (left join to keep all hours)
        merged = pd.merge(
            complete_df,
            subset,
            on='timestamp',
            how='left'
        )
        
        # Keep necessary columns
        keep_cols = [
            "event_id", "timestamp", "rel_hour", "rh_pct", "dp_spread_C",
            "vpd_kpa", "wind_speed_kmh", "wind_direction_deg", "wind_gusts_kmh", 
            "surface_pressure_hpa", "wet_or_rain", "dry_enough_city",
            "start_ts", "end_ts"
        ]
        
        # Ensure all columns exist
        for col in keep_cols:
            if col not in merged.columns:
                merged[col] = np.nan if col not in ["event_id", "timestamp", "rel_hour", "start_ts", "end_ts"] else None
        
        rows.append(merged[keep_cols])
    
    if not rows:
        return pd.DataFrame(columns=[
            "event_id", "timestamp", "rel_hour", "rh_pct", "dp_spread_C",
            "vpd_kpa", "wind_speed_kmh", "wind_direction_deg", "wind_gusts_kmh",
            "surface_pressure_hpa", "wet_or_rain", "dry_enough_city",
            "start_ts", "end_ts"
        ])
    
    out = pd.concat(rows, ignore_index=True).sort_values(["event_id", "timestamp"])
    return out


def aggregate_environment(windows: pd.DataFrame) -> pd.DataFrame:
    """Aggregate environment metrics by rel_hour across all events.

    Computes mean of rh_pct, dp_spread_C, vpd_kpa, wind_speed_kmh.
    Returns DataFrame with columns: rel_hour, rh_mean, dp_spread_mean, vpd_mean, wind_mean
    """
    if windows.empty:
        return pd.DataFrame(columns=[
            "rel_hour", "rh_mean", "dp_spread_mean", "vpd_mean", "wind_mean",
            "wind_direction_deg_mean", "wind_gusts_kmh_mean", "surface_pressure_hpa_mean"
        ])

    agg_spec = {
        "rh_pct": "mean",
        "dp_spread_C": "mean",
        "vpd_kpa": "mean",
        "wind_speed_kmh": "mean",
    }
    # Add optional wind fields if present
    optional_cols = [
        ("wind_direction_deg_mean", "wind_direction_deg"),
        ("wind_gusts_kmh_mean", "wind_gusts_kmh"),
        ("surface_pressure_hpa_mean", "surface_pressure_hpa"),
    ]
    for out_name, src_name in optional_cols:
        if src_name in windows.columns:
            agg_spec[src_name] = "mean"

    grp = windows.groupby("rel_hour", as_index=False).agg(agg_spec)
    rename_map = {
        "rh_pct": "rh_mean",
        "dp_spread_C": "dp_spread_mean",
        "vpd_kpa": "vpd_mean",
        "wind_speed_kmh": "wind_mean",
        "wind_direction_deg": "wind_direction_deg_mean",
        "wind_gusts_kmh": "wind_gusts_kmh_mean",
        "surface_pressure_hpa": "surface_pressure_hpa_mean",
    }
    grp = grp.rename(columns=rename_map)
    return grp.sort_values("rel_hour")


# Computes drying times for each event.
# Returns both drying_hours_from_start and drying_hours_from_end.
# drying_hours is an alias of drying_hours_from_end for backward compatibility.
def compute_event_drying_times(windows: pd.DataFrame) -> pd.DataFrame:
    """Compute drying times for each event in windows.

    Returns DataFrame with columns:
      event_id, drying_hours_from_start, drying_hours_from_end, drying_hours
    """
    if windows.empty:
        return pd.DataFrame(columns=["event_id", "drying_hours_from_start", "drying_hours_from_end", "drying_hours"])

    results = []
    # Group by event_id
    for event_id, sub in windows.groupby("event_id"):
        # We look for dry_enough_city == True in the post-start window
        post_start = sub[sub["rel_hour"] >= 0]
        dry_rows = post_start[post_start["dry_enough_city"] == True]

        if not dry_rows.empty:
            first_dry_ts = dry_rows["timestamp"].min()
            # Ensure start_ts and end_ts are timestamps
            start_ts = pd.to_datetime(sub["start_ts"].iloc[0])
            end_ts = pd.to_datetime(sub["end_ts"].iloc[0])

            drying_start = (first_dry_ts - start_ts).total_seconds() / 3600.0
            drying_end = (first_dry_ts - end_ts).total_seconds() / 3600.0

            results.append({
                "event_id": event_id,
                "drying_hours_from_start": drying_start,
                "drying_hours_from_end": drying_end,
                "drying_hours": drying_end  
            })

    return pd.DataFrame(results)


def aggregate_fractions(windows: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Aggregate wet/dry fractions by rel_hour and compute median drying time.

    wet_frac = mean(wet_or_rain)
    dry_frac = mean(dry_enough_city)

    Drying time per event: computed via compute_event_drying_times.
    Returns (frac_df, stats_dict).
    stats_dict contains:
      - median_drying_h (from end)
      - median_drying_h_from_start
      - median_drying_h_from_end
    """
    if windows.empty:
        return pd.DataFrame(columns=["rel_hour", "wet_frac", "dry_frac"]), {}

    frac = windows.groupby("rel_hour", as_index=False).agg({
        "wet_or_rain": "mean",
        "dry_enough_city": "mean",}).rename(columns={"wet_or_rain": "wet_frac", "dry_enough_city": "dry_frac"}).sort_values("rel_hour")
    frac[["wet_frac", "dry_frac"]] = frac[["wet_frac", "dry_frac"]].fillna(0.0)
    # Drying time per event
    drying_df = compute_event_drying_times(windows)
    
    stats = {}
    if not drying_df.empty:
        stats["median_drying_h"] = float(drying_df["drying_hours"].median())
        stats["median_drying_h_from_start"] = float(drying_df["drying_hours_from_start"].median())
        stats["median_drying_h_from_end"] = float(drying_df["drying_hours_from_end"].median())
    
    return frac, stats


def build_rh_heatmap(pair_hourly: pd.DataFrame, events_df: pd.DataFrame) -> dict:
    """Create humidity (%) heatmap for dates that have at least one event.

    For each start_date present in events_df, compute mean rh_pct per hour (0..23).
    Returns dict with keys: dates (list), hours (0..23 list), rh_matrix (2D list).
    """
    if pair_hourly.empty or events_df.empty:
        return {"dates": [], "hours": list(range(24)), "rh_matrix": []}

    event_dates = events_df["start_date"].unique().tolist()
    df = pair_hourly.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["date_str"] = df["timestamp"].dt.strftime("%Y-%m-%d")
    df["hour"] = df["timestamp"].dt.hour
    df = df[df["date_str"].isin(event_dates)]
    hours = list(range(24))
    rh_matrix = []
    for d in event_dates:
        sub = df[df["date_str"] == d]
        row_vals = []
        for h in hours:
            h_sub = sub[sub["hour"] == h]
            if h_sub.empty:
                row_vals.append(None)
            else:
                row_vals.append(float(h_sub["rh_pct"].mean()))
        rh_matrix.append(row_vals)
    return {"dates": event_dates, "hours": hours, "rh_matrix": rh_matrix}
