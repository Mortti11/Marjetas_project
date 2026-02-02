import sys
import os
import pandas as pd
from pathlib import Path

# Add project root to path
sys.path.append(os.getcwd())

from backend.config import LHT_DATA_DIR, WS100_DATA_DIR, WIND_DATA_PATH
from backend.core.io_lht import clean_lht_sensor, aggregate_lht_hourly
from backend.core.io_ws100 import clean_ws100_sensor, aggregate_ws100_hourly
from backend.core.io_wind import load_wind_hourly
from backend.core.pair_core import build_pair_hourly, add_environment_flags
from backend.core.event_core import detect_events, build_event_windows
from backend.services.pair_service import DEFAULT_LHT, DEFAULT_WS100

def debug_event_drying():
    print(f"Default Pair: LHT={DEFAULT_LHT}, WS100={DEFAULT_WS100}")
    
    # 1. Load Data
    print("Loading data...")
    lht_path = Path(LHT_DATA_DIR) / f"{DEFAULT_LHT}.csv"
    lht_raw = pd.read_csv(lht_path)
    lht_clean = clean_lht_sensor(lht_raw)
    lht_hourly = aggregate_lht_hourly(lht_clean)

    ws_path = Path(WS100_DATA_DIR) / f"df_{DEFAULT_WS100}.csv"
    ws_raw = pd.read_csv(ws_path)
    ws_clean = clean_ws100_sensor(ws_raw, rain_col="precipitationQuantityDiff_mm")
    ws_hourly = aggregate_ws100_hourly(ws_clean)

    wind_hourly = load_wind_hourly(WIND_DATA_PATH)

    # 2. Build Pair
    pair_hourly = build_pair_hourly(lht_hourly, ws_hourly, wind_hourly)
    pair_hourly = add_environment_flags(pair_hourly)
    pair_hourly = pair_hourly.sort_values("timestamp")

    # 3. Detect Events
    events_df = detect_events(pair_hourly)
    
    # 4. Filter for 2023-07-28
    target_date = "2023-07-28"
    date_events = events_df[events_df["start_date"] == target_date].copy()
    
    if date_events.empty:
        print(f"No events found starting on {target_date}")
        return

    # 5. Print Event List
    print(f"\nEvents starting on {target_date}:")
    print(f"{'event_id':<10} {'start':<20} {'end':<20} {'duration_h':<10} {'mm_total':<10} {'ptype_main':<10}")
    
    for _, ev in date_events.iterrows():
        start_ts = pd.to_datetime(ev["start_ts"])
        end_ts = pd.to_datetime(ev["end_ts"])
        duration_h = (end_ts - start_ts).total_seconds() / 3600
        
        # Calculate total rain and main ptype for the event
        # We need to look at the pair_hourly data for this event's duration
        mask = (pair_hourly["timestamp"] >= start_ts) & (pair_hourly["timestamp"] <= end_ts)
        event_data = pair_hourly[mask]
        mm_total = event_data["rain_mm_hour"].sum()
        
        # Simple ptype logic: most frequent ptype that is not NoData, or just "Rain" if mixed
        ptypes = event_data["ptype_hour"].unique()
        ptype_main = "Mix" if len(ptypes) > 1 else (ptypes[0] if len(ptypes) > 0 else "Unknown")
        
        print(f"{ev['event_id']:<10} {str(start_ts):<20} {str(end_ts):<20} {duration_h:<10.1f} {mm_total:<10.2f} {ptype_main:<10}")

    # 6. Print Drying Record
    print(f"\nDrying Record (hours from start):")
    print(f"{'event_id':<10} {'drying_hours':<15}")
    
    # We need windows to calculate drying time as per event_core logic
    # Using a large post_h to capture long drying times
    windows = build_event_windows(pair_hourly, date_events, pre_h=6, post_h=120)
    
    for event_id, sub in windows[windows["rel_hour"] >= 0].groupby("event_id"):
        dry_rows = sub[sub["dry_enough_city"] == True]
        drying_h = "None"
        if not dry_rows.empty:
            drying_h = f"{float(dry_rows['rel_hour'].min()):.1f}"
        print(f"{event_id:<10} {drying_h:<15}")

    # 7. Detailed Table for the big storm
    # Find event starting around 06:00
    # We iterate to find the one closest to 06:00
    target_start_hour = 6
    big_event = None
    for _, ev in date_events.iterrows():
        if pd.to_datetime(ev["start_ts"]).hour == target_start_hour:
            big_event = ev
            break
    
    if big_event is None and not date_events.empty:
        big_event = date_events.iloc[0] # Fallback
        
    if big_event is not None:
        start_ts = pd.to_datetime(big_event["start_ts"])
        end_ts = pd.to_datetime(big_event["end_ts"])
        print(f"\nDetailed Table for Event {big_event['event_id']} (End: {end_ts})")
        print("First 120 hours AFTER event end:")
        
        # Get 120 hours after end
        window_start = end_ts
        window_end = end_ts + pd.Timedelta(hours=120)
        
        mask = (pair_hourly["timestamp"] >= window_start) & (pair_hourly["timestamp"] <= window_end)
        detail_df = pair_hourly[mask].copy()
        
        # Limit to rows 60-120 as requested, but let's show a slice that covers the transition if possible
        # User asked: "Limit to, say, 60–120 rows so I can see how the weather evolves until dry_enough_city becomes True"
        # Let's just print rows where dry_enough_city changes or is about to change, or just the slice requested.
        # I'll print rows 60 to 120 relative to the *end* of the event.
        
        # Add hours_after_end column
        detail_df["hours_after_end"] = (detail_df["timestamp"] - end_ts).dt.total_seconds() / 3600
        
        # Filter for 60-120 hours after end
        slice_df = detail_df[(detail_df["hours_after_end"] >= 60) & (detail_df["hours_after_end"] <= 120)]
        
        print(f"{'timestamp':<20} {'rain':<6} {'rh':<6} {'dp_spr':<8} {'vpd':<6} {'wind':<6} {'dry_city':<10}")
        for _, row in slice_df.iterrows():
            ts_str = row["timestamp"].strftime("%Y-%m-%d %H:%M")
            print(f"{ts_str:<20} {row['rain_mm_hour']:<6.2f} {row['rh_pct']:<6.1f} {row['dp_spread_C']:<8.2f} {row['vpd_kpa']:<6.2f} {row['wind_speed_kmh']:<6.1f} {str(row['dry_enough_city']):<10}")

if __name__ == "__main__":
    debug_event_drying()
