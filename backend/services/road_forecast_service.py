import pandas as pd
from typing import Dict, Any
from backend.core.openmeteo_fetcher import fetch_openmeteo_jyvaskyla
from backend.core.forecast_adapter import build_forecast_with_risk, build_forecast_events_with_drying

def build_city_road_forecast(forecast_days: int = 10) -> Dict[str, Any]:
    """
    Fetch Open-Meteo forecast for Jyväskylä and build a structured
    road-forecast summary for a single city-level zone.
    No FastAPI endpoint here, just a pure service function.
    """
    # 1. Fetch data
    df_forecast = fetch_openmeteo_jyvaskyla(forecast_days=forecast_days)
    
    # 2. Run adapter + risk
    df_hourly = build_forecast_with_risk(df_forecast)
    
    # 3. Run events + drying
    events = build_forecast_events_with_drying(df_forecast)
    
    # 4. Compute simple stats for next 24h and next 72h
    if df_hourly.empty:
        return {
            "generated_at": pd.Timestamp.now().isoformat(),
            "hourly": [],
            "events": [],
            "stats": {
                "high_risk_hours_24h": 0,
                "high_risk_hours_72h": 0,
                "max_slippery_score_24h": 0,
                "total_events_72h": 0,
                "high_risk_periods_24h": [],
                "high_risk_periods_72h": [],
            },
        }

    now_ts = df_hourly["timestamp"].min()
    h24 = now_ts + pd.Timedelta(hours=24)
    h72 = now_ts + pd.Timedelta(hours=72)

    mask_24 = df_hourly["timestamp"] < h24
    mask_72 = df_hourly["timestamp"] < h72

    high_24 = int((df_hourly.loc[mask_24, "slippery_level"] == "high").sum())
    high_72 = int((df_hourly.loc[mask_72, "slippery_level"] == "high").sum())

    # Handle empty 24h window for max score (e.g. if forecast is empty or very short)
    if mask_24.any():
        max_score_24 = int(df_hourly.loc[mask_24, "slippery_score"].max())
    else:
        max_score_24 = 0
        
    total_events_72 = sum(
        1 for e in events
        if e["start_ts"] < h72.isoformat()
    )

    # Extract contiguous high-risk periods
    high_periods_24 = _extract_high_risk_periods(df_hourly, h24)
    high_periods_72 = _extract_high_risk_periods(df_hourly, h72)

    # 5. Build output dict (JSON-friendly)
    summary: Dict[str, Any] = {
        "generated_at": now_ts.isoformat(),
        "hourly": [
            {
                "timestamp": row["timestamp"].isoformat(),
                "temp_C": float(row["temp_C"]),
                "slippery_score": int(row["slippery_score"]),
                "slippery_level": str(row["slippery_level"]),
            }
            for ts, row in df_hourly.iterrows()
        ],
        "events": events,
        "stats": {
            "high_risk_hours_24h": high_24,
            "high_risk_hours_72h": high_72,
            "max_slippery_score_24h": max_score_24,
            "total_events_72h": total_events_72,
            "high_risk_periods_24h": high_periods_24,
            "high_risk_periods_72h": high_periods_72,
        },
    }
    
    return summary


def _extract_high_risk_periods(df: pd.DataFrame, end_ts: pd.Timestamp) -> list[Dict[str, Any]]:
    """
    Look at df rows with timestamp < end_ts and slippery_level == 'high'.
    Group contiguous hours into periods and return a list of dicts.
    """
    mask = (df["timestamp"] < end_ts) & (df["slippery_level"] == "high")
    high = df.loc[mask].sort_values("timestamp")

    if high.empty:
        return []

    # Compute a “break” whenever the gap between consecutive timestamps is > 1 hour
    gaps = high["timestamp"].diff() > pd.Timedelta(hours=1)
    group_ids = gaps.cumsum()  # each contiguous block gets a group id

    periods = []
    for _, group in high.groupby(group_ids):
        start_ts = group["timestamp"].iloc[0]
        end_ts_period = group["timestamp"].iloc[-1]
        duration_h = float(len(group))
        max_score = int(group["slippery_score"].max())

        periods.append({
            "start_ts": start_ts.isoformat(),
            "end_ts": end_ts_period.isoformat(),
            "duration_h": duration_h,
            "max_score": max_score,
        })

    return periods
