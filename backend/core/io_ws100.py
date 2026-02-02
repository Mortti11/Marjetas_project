import pandas as pd
import numpy as np


def bucket_precip_type(code):
    if pd.isna(code):
        return "NoData"
    c = int(code)
    if c == 0:
        return "Dry"
    if c == 60:
        return "Rain"
    if 60 < c < 70:
        return "Mix"
    if c == 70:
        return "Snow"
    return "Other"


def clean_ws100_sensor(
    raw_data: pd.DataFrame,
    timestamp_col: str = "Timestamp",
    rain_col: str = "Rain_mm_10min",
    start_date: str | None = None,) -> pd.DataFrame:
    df = raw_data.copy()

    df[timestamp_col] = pd.to_datetime(df[timestamp_col])
    df = df.sort_values(timestamp_col)

    if start_date is not None:
        start_dt = pd.to_datetime(start_date)
        df = df[df[timestamp_col] >= start_dt]

    # Standardize rain column name
    df = df.rename(columns={rain_col: "Rain_mm"})

    # Replace NaNs with 0 and clip negatives
    df["Rain_mm"] = pd.to_numeric(df["Rain_mm"], errors="coerce").fillna(0.0)
    df["Rain_mm"] = df["Rain_mm"].clip(lower=0.0)

    return df.reset_index(drop=True)


def aggregate_ws100_hourly(df: pd.DataFrame) -> pd.DataFrame:
  
    hourly = df.copy()
    hourly["Timestamp"] = pd.to_datetime(hourly["Timestamp"])
    hourly = hourly.set_index("Timestamp")

    # Hourly totals for rain
    hourly_agg = (hourly["Rain_mm"].resample("h").sum().to_frame(name="Rain_mm_hour"))

    if "precipitationType" in hourly.columns:
        ptype_mode = (
            hourly["precipitationType"].resample("h")
            .agg(lambda x: x.mode()[0] if len(x.mode()) > 0 else np.nan).rename("ptype_code"))
        hourly_agg = hourly_agg.join(ptype_mode)
        hourly_agg["ptype_hour"] = hourly_agg["ptype_code"].apply(bucket_precip_type)

    return hourly_agg.reset_index()
