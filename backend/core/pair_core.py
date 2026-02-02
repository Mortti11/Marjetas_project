import pandas as pd

from .physics import dewpoint_C, vpd_kpa
from .thresholds import DEFAULT_THRESHOLDS, EnvironmentThresholds


def build_pair_hourly(
    lht_hourly: pd.DataFrame,
    ws_hourly: pd.DataFrame,
    wind_hourly: pd.DataFrame | None = None,
) -> pd.DataFrame:
   
    # LHT
    lht = lht_hourly.copy()
    lht["timestamp"] = pd.to_datetime(lht["Timestamp"])
    lht = lht.sort_values("timestamp").drop_duplicates("timestamp")

    lht["temp_C"] = lht["Temperature_C"].astype(float)
    lht["rh_pct"] = lht["Humidity"].astype(float)
    lht["dewpoint_C"] = dewpoint_C(lht["temp_C"], lht["rh_pct"])
    lht["dp_spread_C"] = lht["temp_C"] - lht["dewpoint_C"]
    lht["vpd_kpa"] = vpd_kpa(lht["temp_C"], lht["rh_pct"])
    lht = lht[["timestamp", "temp_C", "rh_pct", "dewpoint_C", "dp_spread_C", "vpd_kpa"]]
    lht = lht.interpolate(method="linear", limit=3, limit_direction="both", limit_area="inside")

    # WS100
    ws = ws_hourly.copy()
    ws["timestamp"] = pd.to_datetime(ws["Timestamp"])
    ws = ws.sort_values("timestamp").drop_duplicates("timestamp")
    ws = ws.rename(columns={"Rain_mm_hour": "rain_mm_hour"})
    if "ptype_hour" not in ws.columns:
        ws["ptype_hour"] = "NoData"
    ws = ws[["timestamp", "rain_mm_hour", "ptype_hour"]]

    # Merge LHT + WS100
    hourly = pd.merge(lht, ws, on="timestamp", how="left")

    # Optional wind
    if wind_hourly is not None and not wind_hourly.empty:
        wind = wind_hourly.copy()
        wind["timestamp"] = pd.to_datetime(wind["Timestamp"])
        wind = wind.sort_values("timestamp").drop_duplicates("timestamp")
        
        # Define all wind columns we want to keep
        wind_cols = ["wind_speed_kmh", "wind_direction_deg", "wind_gusts_kmh", "surface_pressure_hpa"]
        
        # Ensure wind_speed_kmh exists (fallback logic)
        if "wind_speed_kmh" not in wind.columns:
            for col in wind.columns:
                if "wind" in col and "speed" in col:
                    wind = wind.rename(columns={col: "wind_speed_kmh"})
                    break
        
        # Ensure all expected columns exist in wind df (fill missing with NaN)
        for c in wind_cols:
            if c not in wind.columns:
                wind[c] = float("nan")

        hourly = pd.merge(
            hourly,
            wind[["timestamp"] + wind_cols],
            on="timestamp",
            how="left",
        )
    else:
        hourly["wind_speed_kmh"] = 0.0
        hourly["wind_direction_deg"] = float("nan")
        hourly["wind_gusts_kmh"] = float("nan")
        hourly["surface_pressure_hpa"] = float("nan")

    # Time parts
    hourly["year"] = hourly["timestamp"].dt.year
    hourly["month"] = hourly["timestamp"].dt.month
    hourly["day"] = hourly["timestamp"].dt.day
    hourly["date"] = hourly["timestamp"].dt.date
    hourly["hour"] = hourly["timestamp"].dt.hour

    return hourly


def add_environment_flags(
    hourly_pair: pd.DataFrame,
    thresholds: EnvironmentThresholds | None = None,
) -> pd.DataFrame:

    th = thresholds or DEFAULT_THRESHOLDS
    df = hourly_pair.copy()

    rain = df["rain_mm_hour"].fillna(0.0)
    rh = df["rh_pct"].astype(float)
    dp_spread = df["dp_spread_C"].astype(float)
    vpd = df["vpd_kpa"].astype(float)
    wind = df["wind_speed_kmh"].fillna(0.0).astype(float)

    # Rain based on amount + WS100 type
    df["is_raining"] = (rain > th.rain_event_mm_h) & df["ptype_hour"].isin(["Rain", "Mix", "Snow"])

    # Leaf wetness without rain: high RH and small dewpoint spread
    df["leaf_wetness"] = (rh >= th.leaf_wet_rh_pct) & (dp_spread <= th.leaf_wet_dp_spread_max_C)

    # Any wet condition
    df["wet_or_rain"] = df["is_raining"] | df["leaf_wetness"]

    # Strict rural drying
    no_rain_strict = rain <= th.strict_rain_max_mm_h
    low_rh_strict = rh <= th.strict_rh_max_pct
    good_spread_strict = dp_spread >= th.strict_dp_spread_min_C
    strong_vpd_strict = vpd >= th.strict_vpd_min_kpa
    enough_wind_strict = wind >= th.strict_wind_min_kmh
    df["dry_enough_strict"] = (
        no_rain_strict
        & low_rh_strict
        & good_spread_strict
        & strong_vpd_strict
        & enough_wind_strict
    )

    # City / moderate drying
    no_rain_city = rain <= th.city_rain_max_mm_h
    low_rh_city = rh <= th.city_rh_max_pct
    good_spread_city = dp_spread >= th.city_dp_spread_min_C
    vpd_ok_city = vpd >= th.city_vpd_min_kpa
    enough_wind_city = wind >= th.city_wind_min_kmh
    df["dry_enough_city"] = (
        no_rain_city
        & low_rh_city
        & good_spread_city
        & vpd_ok_city
        & enough_wind_city
    )

    return df
