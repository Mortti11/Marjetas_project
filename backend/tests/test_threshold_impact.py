import pytest
from pathlib import Path
import pandas as pd
import sys
import os

# Add project root to path
sys.path.append(os.getcwd())

from backend.config import LHT_DATA_DIR, WS100_DATA_DIR, WIND_DATA_PATH
from backend.core.io_lht import clean_lht_sensor, aggregate_lht_hourly
from backend.core.io_ws100 import clean_ws100_sensor, aggregate_ws100_hourly
from backend.core.io_wind import load_wind_hourly
from backend.core.pair_core import build_pair_hourly, add_environment_flags
from backend.core.event_core import detect_events, build_event_windows, aggregate_fractions
from backend.services.pair_service import DEFAULT_LHT, DEFAULT_WS100

def load_full_pair():
    # Load & merge (same logic as pair_daily_analysis)
    lht_path = Path(LHT_DATA_DIR) / f"{DEFAULT_LHT}.csv"
    if not lht_path.exists():
        pytest.skip("LHT data not found")
        
    lht_raw = pd.read_csv(lht_path)
    lht_clean = clean_lht_sensor(lht_raw)
    lht_hourly = aggregate_lht_hourly(lht_clean)

    ws_path = Path(WS100_DATA_DIR) / f"df_{DEFAULT_WS100}.csv"
    if not ws_path.exists():
        pytest.skip("WS100 data not found")

    ws_raw = pd.read_csv(ws_path)
    ws_clean = clean_ws100_sensor(ws_raw, rain_col="precipitationQuantityDiff_mm")
    ws_hourly = aggregate_ws100_hourly(ws_clean)

    wind_hourly = load_wind_hourly(WIND_DATA_PATH)

    pair_hourly = build_pair_hourly(lht_hourly, ws_hourly, wind_hourly)
    pair_hourly = add_environment_flags(pair_hourly)
    pair_hourly = pair_hourly.sort_values("timestamp")
    return pair_hourly

def test_threshold_impact():
    print("Loading data...")
    try:
        pair_hourly = load_full_pair()
    except Exception as e:
        pytest.skip(f"Error loading data: {e}")

    # 1. Check event count decrease
    print("Detecting events with old threshold (0.02)...")
    events_old = detect_events(pair_hourly, rain_threshold=0.02)
    print("Detecting events with new threshold (0.2)...")
    events_new = detect_events(pair_hourly, rain_threshold=0.2)
    
    print(f"Events with 0.02mm: {len(events_old)}")
    print(f"Events with 0.2mm: {len(events_new)}")
    
    assert len(events_new) < len(events_old), "Number of events should decrease with higher threshold"

    # 2. Check median drying hours for 2023-07-28...2023-07-29
    # We need to filter events that start on these dates
    target_dates = ["2023-07-28", "2023-07-29"]
    
    for date_str in target_dates:
        date_events = events_new[events_new["start_date"] == date_str].copy()
        if date_events.empty:
            print(f"No events found for {date_str}")
            continue
        
        print(f"Events for {date_str}:")
        print(date_events)

        windows = build_event_windows(
            pair_hourly,
            date_events,
            pre_h=6,
            post_h=12,
        )
        
        if not windows.empty:
            # Check if any dry rows exist
            dry_rows = windows[windows["dry_enough_city"] == True]
            print(f"Total rows in window: {len(windows)}")
            print(f"Dry rows in window: {len(dry_rows)}")
            
            _, median_drying = aggregate_fractions(windows)
            print(f"Median drying hours for {date_str}: {median_drying}")
        else:
            print(f"No windows for {date_str}")
