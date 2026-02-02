import pytest
from backend.services.pair_service import pair_hourly_preview, pair_daily_analysis

def test_pair_hourly_preview_includes_wind_fields():
    """
    Verify that pair_hourly_preview returns sample rows containing all expected keys,
    including the new wind fields.
    """
    # Arrange
    lht_sensor = 'Kaunisharjuntie'
    ws100_sensor = 'Kotaniementie'
    
    # Act
    result = pair_hourly_preview(lht_sensor, ws100_sensor, max_hours=24)
    
    # Assert
    assert "sample" in result
    assert len(result["sample"]) > 0
    
    row = result["sample"][0]
    
    expected_keys = [
        "timestamp",
        "temp_C",
        "rh_pct",
        "dewpoint_C",
        "dp_spread_C",
        "vpd_kpa",
        "rain_mm_hour",
        "ptype_hour",
        "wind_speed_kmh",
        "wind_direction_deg",
        "wind_gusts_kmh",
        "surface_pressure_hpa",
        "is_raining",
        "leaf_wetness",
        "wet_or_rain",
        "dry_enough_city",
        "dry_enough_strict",
    ]
    
    for key in expected_keys:
        assert key in row, f"Key '{key}' missing from pair_hourly_preview sample row"

def test_pair_daily_analysis_includes_wind_fields():
    """
    Verify that pair_daily_analysis returns hourly rows containing all expected keys,
    including the new wind fields.
    """
    # Arrange
    lht_sensor = 'Kaunisharjuntie'
    ws100_sensor = 'Kotaniementie'
    date_str = '2023-07-28'
    
    # Act
    result = pair_daily_analysis(lht_sensor, ws100_sensor, date_str)
    
    # Assert
    assert "hourly" in result
    hourly = result["hourly"]
    assert len(hourly) > 0
    
    row = hourly[0]
    
    expected_keys = [
        "timestamp",
        "temp_C",
        "rh_pct",
        "dewpoint_C",
        "dp_spread_C",
        "vpd_kpa",
        "rain_mm_hour",
        "ptype_hour",
        "wind_speed_kmh",
        "wind_direction_deg",
        "wind_gusts_kmh",
        "surface_pressure_hpa",
        "is_raining",
        "wet_or_rain",
        "dry_enough_city",
        "dry_enough_strict",
    ]
    
    for key in expected_keys:
        assert key in row, f"Key '{key}' missing from pair_daily_analysis hourly row"
