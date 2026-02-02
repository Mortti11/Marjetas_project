import sys
import os
import pandas as pd
from datetime import datetime

# Add project root to path
sys.path.append(os.getcwd())

from backend.core.forecast_adapter import build_forecast_events_with_drying
from backend.core.openmeteo_fetcher import fetch_openmeteo_jyvaskyla

def main():
    # 1) Fetch 3 days of forecast
    print("Fetching forecast (3 days)...")
    df_forecast = fetch_openmeteo_jyvaskyla(forecast_days=3)

    # 2) Build events with drying
    print("Building events and drying times...")
    events = build_forecast_events_with_drying(df_forecast)

    # 3) Print output
    print(f"\n=== FORECAST EVENTS (next 3 days) ===")
    if not events:
        print("No events detected.")
    else:
        for i, ev in enumerate(events, 1):
            # Parse timestamps for nice formatting
            start = datetime.fromisoformat(ev["start_ts"])
            end = datetime.fromisoformat(ev["end_ts"])
            
            start_str = start.strftime("%Y-%m-%d %H:%M")
            end_str = end.strftime("%Y-%m-%d %H:%M")
            
            ptype = ev["ptype_main"]
            intensity = ev["event_intensity"]
            mm = ev["mm_total"]
            drying = ev["drying_hours_from_end"]
            
            drying_str = f"drying ≈ {drying:.1f} h" if drying is not None else "drying unknown (horizon end)"
            
            print(f"{i}) {start_str} → {end_str} | {ptype}, {intensity} | {mm:.1f} mm | {drying_str}")

if __name__ == "__main__":
    main()
