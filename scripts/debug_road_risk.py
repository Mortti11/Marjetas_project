import sys
import os
import pandas as pd

# Add project root to path
sys.path.append(os.getcwd())

from backend.core.forecast_adapter import build_forecast_with_risk
from backend.core.openmeteo_fetcher import fetch_openmeteo_jyvaskyla

def main():
    # 1) Fetch 2 days of forecast
    print("Fetching forecast...")
    df_forecast = fetch_openmeteo_jyvaskyla(forecast_days=2)

    # 2) Adapt + add flags + add risk
    print("Adapting and calculating risk...")
    df = build_forecast_with_risk(df_forecast)

    # 3) Print sample
    cols = [
        "timestamp",
        "temp_C",
        "wet_or_rain",
        "slippery_score",
        "slippery_level"
    ]
    
    print("\n=== ROAD RISK SAMPLE (first 24 hours) ===")
    print(df[cols].head(24))
    
    print("\nShape:", df.shape)
    
    # Check if we have any non-zero risk
    max_score = df["slippery_score"].max()
    print(f"\nMax Slippery Score in window: {max_score}")
    
    if max_score > 0:
        print("High risk rows:")
        print(df[df["slippery_score"] >= 40][cols])

if __name__ == "__main__":
    main()
