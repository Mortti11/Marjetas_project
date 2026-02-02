import sys
import os
import json
from datetime import datetime

# Add project root to path
sys.path.append(os.getcwd())

from backend.services.road_forecast_service import build_city_road_forecast

def main():
    print("Building city road forecast (3 days)...")
    summary = build_city_road_forecast(forecast_days=3)

    print("\n=== STATS ===")
    stats = summary["stats"]
    print(json.dumps(stats, indent=2))

    print("\n=== HIGH-RISK PERIODS (24h) ===")
    for i, p in enumerate(stats.get("high_risk_periods_24h", []), start=1):
        print(f"{i}) {p['start_ts']} -> {p['end_ts']} | duration: {p['duration_h']} h | max_score: {p['max_score']}")

    print("\n=== HIGH-RISK PERIODS (72h) ===")
    for i, p in enumerate(stats.get("high_risk_periods_72h", []), start=1):
        print(f"{i}) {p['start_ts']} -> {p['end_ts']} | duration: {p['duration_h']} h | max_score: {p['max_score']}")

if __name__ == "__main__":
    main()
