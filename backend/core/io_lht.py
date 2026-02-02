import pandas as pd
import numpy as np
from backend.core.physics import dewpoint_C, vpd_kpa, abs_humidity_gm3


def clean_lht_sensor(
    raw_data: pd.DataFrame,
    timestamp_col: str = "Timestamp",
    temp_col: str = "TempC_SHT",
    hum_col: str = "Hum_SHT",
    start_date: str = "2021-01-08",
    temp_range=(-40.0, 38.0),
    hum_range=(0.0, 100.0),):
   
    df = raw_data.copy()

    # Parse and sort timestamps
    df[timestamp_col] = pd.to_datetime(df[timestamp_col])
    df = df.sort_values(timestamp_col)

    # Keep only data after the start date (outdoor period)
    start_dt = pd.to_datetime(start_date)
    df = df[df[timestamp_col] >= start_dt]

    # Rename to standard column names
    df = df.rename(columns={temp_col: "Temperature_C", hum_col: "Humidity"})

    # Use timestamp as index for time-based interpolation
    df = df.set_index(timestamp_col)

    # Filter out physically impossible values
    correct_temperature = (
        (df["Temperature_C"] >= temp_range[0])
        & (df["Temperature_C"] <= temp_range[1])
    )
    correct_humidity = (
        (df["Humidity"] >= hum_range[0])
        & (df["Humidity"] <= hum_range[1])
    )
    df.loc[~correct_temperature, "Temperature_C"] = pd.NA
    df.loc[~correct_humidity, "Humidity"] = pd.NA

    # Interpolate short gaps in time
    df = df.interpolate(
        method="time",
        limit=3,
        limit_direction="both",
        limit_area="inside",
    )

    # Back to a clean, time-sorted dataframe with Timestamp column
    df = df.reset_index().rename(columns={timestamp_col: "Timestamp"})
    df = df.sort_values("Timestamp").reset_index(drop=True)

    return df


def prepare_and_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Prepare a cleaned LHT dataframe and compute derived features:
    - Dew point
    - Absolute humidity
    - VPD
    - hour and date columns
    """
    report_df = df.copy()
    report_df = report_df.dropna(subset=["Timestamp"]).sort_values("Timestamp")

    report_df["Temperature_C"] = pd.to_numeric(
        report_df["Temperature_C"], errors="coerce"
    )
    report_df["Humidity"] = pd.to_numeric(report_df["Humidity"], errors="coerce")

    # Derived variables
    report_df["DewPoint_C"] = dewpoint_C(
        report_df["Temperature_C"], report_df["Humidity"]
    )
    report_df["AbsHum_gm3"] = abs_humidity_gm3(
        report_df["Temperature_C"], report_df["Humidity"]
    )
    report_df["VPD_kPa"] = vpd_kpa(
        report_df["Temperature_C"], report_df["Humidity"]
    )

    report_df["hour"] = report_df["Timestamp"].dt.hour
    report_df["date"] = report_df["Timestamp"].dt.date

    return report_df


def summarize(report_df: pd.DataFrame) -> dict:
    df = report_df.copy()

    # typical time step in minutes
    step_min = df["Timestamp"].diff().dt.total_seconds().median() / 60.0

    # Daily temperature range (median T_max - T_min)
    daily = (
        df.groupby("date")
        .agg(
            T_min=("Temperature_C", "min"),
            T_max=("Temperature_C", "max"),
            RH_mean=("Humidity", "mean"),
        )
    )
    if not daily.empty:
        daily_temp_range = (daily["T_max"] - daily["T_min"]).median()
    else:
        daily_temp_range = float("nan")

    # Diurnal amplitude (24h cycle) for temperature and humidity
    hourly = (
        df.groupby("hour")
        .agg(
            T=("Temperature_C", "mean"),
            RH=("Humidity", "mean"),
        )
    )
    if not hourly.empty:
        Temperature_24H = (hourly["T"].max() - hourly["T"].min())
        Humidity_24H = (hourly["RH"].max() - hourly["RH"].min())
    else:
        Temperature_24H = float("nan")
        Humidity_24H = float("nan")

    # VPD peaks: mean of daily maxima
    daily_vpd_max = df.groupby("date")["VPD_kPa"].max()
    vpd_peak_mean = daily_vpd_max.mean() if not daily_vpd_max.empty else float("nan")

    # VPD smoothed peaks: mean of top-4 VPD values per day, averaged over days
    data_sorted = df.sort_values(["date", "VPD_kPa"], ascending=[True, False])
    top4 = data_sorted.groupby("date").head(4)
    daily_vpd_top4 = top4.groupby("date")["VPD_kPa"].mean()
    vpd_peak_smooth = (
        daily_vpd_top4.mean() if not daily_vpd_top4.empty else float("nan")
    )

    # Comfort / condensation percentages
    pct_RH_gt90 = (df["Humidity"] >= 90).mean() * 100.0
    pct_RH_lt30 = (df["Humidity"] <= 30).mean() * 100.0

    return {
        "rows": int(len(df)),
        "step_min": float(step_min) if step_min == step_min else float("nan"),
        "T_mean": float(df["Temperature_C"].mean()),
        "T_min": float(df["Temperature_C"].min()),
        "T_max": float(df["Temperature_C"].max()),
        "RH_mean": float(df["Humidity"].mean()),
        "RH_min": float(df["Humidity"].min()),
        "RH_max": float(df["Humidity"].max()),
        "DewPoint_mean": float(df["DewPoint_C"].mean()),
        "AbsHum_mean": float(df["AbsHum_gm3"].mean()),
        "VPD_peak_mean": float(vpd_peak_mean) if vpd_peak_mean == vpd_peak_mean else float("nan"),
        "VPD_peak_smooth": float(vpd_peak_smooth) if vpd_peak_smooth == vpd_peak_smooth else float("nan"),
        "DTR_median": float(daily_temp_range) if daily_temp_range == daily_temp_range else float("nan"),
        "Temperature_24H": float(Temperature_24H) if Temperature_24H == Temperature_24H else float("nan"),
        "Humidity_24H": float(Humidity_24H) if Humidity_24H == Humidity_24H else float("nan"),
        "%RH>=90": float(pct_RH_gt90),
        "%RH<=30": float(pct_RH_lt30),
    }


def aggregate_lht_hourly(df: pd.DataFrame) -> pd.DataFrame:
    hourly = df.copy()
    hourly["Timestamp"] = pd.to_datetime(hourly["Timestamp"])
    hourly = hourly.set_index("Timestamp")
    
    # Hourly means
    hourly_agg = hourly[["Temperature_C", "Humidity"]].resample("h").mean()
    
    return hourly_agg.reset_index()
