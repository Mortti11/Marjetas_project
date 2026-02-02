
from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class EnvironmentThresholds:

    rain_event_mm_h: float = 0.2  

    leaf_wet_rh_pct: float = 90.0
    leaf_wet_dp_spread_max_C: float = 2.0

    strict_rain_max_mm_h: float = 0.0          
    strict_rh_max_pct: float = 75.0
    strict_dp_spread_min_C: float = 2.0
    strict_vpd_min_kpa: float = 0.6
    strict_wind_min_kmh: float = 2.0

    city_rain_max_mm_h: float = 0.02           
    city_rh_max_pct: float = 88.0
    city_dp_spread_min_C: float = 1.0
    city_vpd_min_kpa: float = 0.3
    city_wind_min_kmh: float = 1.0


DEFAULT_THRESHOLDS = EnvironmentThresholds()
