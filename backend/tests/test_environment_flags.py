import pandas as pd
from backend.core.pair_core import add_environment_flags
from backend.core.thresholds import EnvironmentThresholds, DEFAULT_THRESHOLDS

def build_sample():
    # Two synthetic hours: one wet (rain + high RH), one potential dry (low RH, good dp spread)
    data = {
        "timestamp": pd.to_datetime(["2025-01-01 00:00:00", "2025-01-01 01:00:00"]),
        "temp_C": [10.0, 15.0],
        "rh_pct": [95.0, 60.0],
        "dewpoint_C": [9.0, 5.0],
        "dp_spread_C": [1.0, 10.0],
        "vpd_kpa": [0.2, 1.0],
        "rain_mm_hour": [0.5, 0.0],
        "ptype_hour": ["Rain", "NoData"],
        "wind_speed_kmh": [3.0, 3.0],
    }
    return pd.DataFrame(data)

def test_default_thresholds_logic():
    df = build_sample()
    out = add_environment_flags(df)
    # First row raining -> wet
    assert out.loc[0, "is_raining"] is True
    assert out.loc[0, "wet_or_rain"] is True
    # Second row dry enough strict & city due to low RH, high spread, strong VPD, enough wind
    # However VPD is 1.0 (>0.6 strict) so strict passes; rain is 0.0; dp spread 10 >=2; RH 60 <=75
    assert out.loc[1, "dry_enough_strict"] is True
    assert out.loc[1, "dry_enough_city"] is True


def test_custom_thresholds_more_strict():
    df = build_sample()
    custom = EnvironmentThresholds(
        rain_event_mm_h=0.1,  # higher threshold: small rain ignored
        leaf_wet_rh_pct=92.0,
        leaf_wet_dp_spread_max_C=1.5,
        strict_rain_max_mm_h=0.0,
        strict_rh_max_pct=70.0,
        strict_dp_spread_min_C=3.0,
        strict_vpd_min_kpa=0.8,
        strict_wind_min_kmh=2.0,
        city_rain_max_mm_h=0.05,
        city_rh_max_pct=85.0,
        city_dp_spread_min_C=2.0,
        city_vpd_min_kpa=0.5,
        city_wind_min_kmh=2.0,
    )
    out = add_environment_flags(df, thresholds=custom)
    # Rain 0.5 > 0.1 so still raining
    assert out.loc[0, "is_raining"] is True
    # Second row: RH 60 <=70, spread 10 >=3, VPD 1.0 >=0.8, wind 3 >=2 -> strict dry still True
    assert out.loc[1, "dry_enough_strict"] is True
    # City thresholds stricter than default but still satisfied
    assert out.loc[1, "dry_enough_city"] is True


def test_custom_thresholds_more_lenient():
    df = build_sample()
    custom = EnvironmentThresholds(
        rain_event_mm_h=0.5,  # equal to rain amount -> not counted as rain (> not >=)
        leaf_wet_rh_pct=94.0,  # first row RH 95 -> still leaf wet
        leaf_wet_dp_spread_max_C=2.0,
        strict_rain_max_mm_h=0.0,
        strict_rh_max_pct=80.0,
        strict_dp_spread_min_C=2.0,
        strict_vpd_min_kpa=0.5,
        strict_wind_min_kmh=2.0,
        city_rain_max_mm_h=0.5,
        city_rh_max_pct=90.0,
        city_dp_spread_min_C=1.0,
        city_vpd_min_kpa=0.2,
        city_wind_min_kmh=1.0,
    )
    out = add_environment_flags(df, thresholds=custom)
    # is_raining uses > rain_event_mm_h so 0.5 > 0.5 is False
    assert out.loc[0, "is_raining"] is False
    # Leaf wetness still True due to RH 95 >=94 and spread 1 <=2
    assert out.loc[0, "leaf_wetness"] is True
    # Dry flags for second row still True
    assert out.loc[1, "dry_enough_city"] is True
    assert out.loc[1, "dry_enough_strict"] is True

if __name__ == "__main__":
    # Allow running directly for quick manual check
    test_default_thresholds_logic()
    test_custom_thresholds_more_strict()
    test_custom_thresholds_more_lenient()
    print("All environment flag tests passed.")
