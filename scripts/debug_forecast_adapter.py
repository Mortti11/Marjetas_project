import sys
import os
import pandas as pd

# Add project root to path
sys.path.append(os.getcwd())

from backend.core.forecast_adapter import build_forecast_windows
from backend.core.openmeteo_fetcher import fetch_openmeteo_jyvaskyla

def main():
    # 1) Fetch 2 days of forecast to keep output small
    print("Fetching forecast...")
    df_forecast = fetch_openmeteo_jyvaskyla(forecast_days=2)

    # 2) Adapt + add environment flags
    print("Adapting and flagging...")
    pair_df = build_forecast_windows(df_forecast)

    # 3) Print a compact sample so we can visually check correctness
    cols = [
        "timestamp",
        "temp_C",
        "rh_pct",
        "dewpoint_C",
        "dp_spread_C",
        "rain_mm_hour",
        "wind_speed_kmh",  # Note: corrected name from user request 'windspeed_kmh'
        "ptype_hour",
        "wet_or_rain",
        "dry_enough_city",
    ]
    
    # Handle column name difference if user script used 'windspeed_kmh' but I implemented 'wind_speed_kmh'
    # The user request had 'windspeed_kmh' in the print list, but I fixed it to 'wind_speed_kmh' in my implementation.
    # I should use the correct name in the print list.

    print("\n=== RAW FORECAST SAMPLE (first 5 rows) ===")
    print(df_forecast.head())

    print("\n=== ADAPTED + FLAGS SAMPLE (first 24 hours) ===")
    # Check if columns exist
    missing = [c for c in cols if c not in pair_df.columns]
    if missing:
        print(f"Warning: Missing columns: {missing}")
        # Fallback to available columns
        cols = [c for c in cols if c in pair_df.columns]

    print(pair_df[cols].head(24))

    print("\nShape:", pair_df.shape)

if __name__ == "__main__":
    main()
