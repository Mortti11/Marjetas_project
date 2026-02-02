from pathlib import Path
import pandas as pd
import numpy as np

from backend.config import WS100_DATA_DIR
from backend.core.io_ws100 import clean_ws100_sensor, aggregate_ws100_hourly, bucket_precip_type


def prepare_dynamic_data(df_raw: pd.DataFrame) -> pd.DataFrame:
    """
    Prepare WS100 data for dynamic analysis:
    - Map precipitation types to events
    - Calculate duration of each interval
    """
    df = df_raw.copy()
    
    # Ensure sorted
    df = df.sort_values("Timestamp")
    
    # Map events
    if "precipitationType" in df.columns:
        df["event"] = df["precipitationType"].apply(bucket_precip_type)
    else:
        df["event"] = "Unknown"
        
    # Calculate duration (time until next timestamp)
    dt = df["Timestamp"].shift(-1) - df["Timestamp"]
    dt_sec = dt.dt.total_seconds()
    
    # Fill last/invalid intervals with median positive step (usually 60s or 600s)
    valid_steps = dt_sec[dt_sec > 0]
    median_step = np.nanmedian(valid_steps) if len(valid_steps) > 0 else 600.0
    
    # Replace invalid durations (<=0 or NaN) with median
    dt_sec = np.where((dt_sec <= 0) | np.isnan(dt_sec), median_step, dt_sec)
    
    df["duration_h"] = dt_sec / 3600.0
    
    return df


def analyze_dynamic(
    sensor_name: str, 
    start_date: str, 
    end_date: str, 
    freq: str = "MS"
) -> dict:
    """
    Dynamic analysis for WS100 dashboard.
    """
    csv_path = WS100_DATA_DIR / f"df_{sensor_name}.csv"
    if not csv_path.exists():
        raise FileNotFoundError(f"Sensor '{sensor_name}' not found")
        
    # Load raw data
    raw_df = pd.read_csv(csv_path)
    raw_df["Timestamp"] = pd.to_datetime(raw_df["Timestamp"])
    
    # Rename rain column for consistency with user logic
    if "precipitationQuantityDiff_mm" in raw_df.columns:
        raw_df["rain_mm"] = raw_df["precipitationQuantityDiff_mm"]
    elif "Rain_mm_10min" in raw_df.columns:
         raw_df["rain_mm"] = raw_df["Rain_mm_10min"]
    else:
         raw_df["rain_mm"] = 0.0
         
    df_prep = prepare_dynamic_data(raw_df)
    
    # Filter by date
    mask = (df_prep["Timestamp"] >= pd.to_datetime(start_date)) & \
           (df_prep["Timestamp"] <= pd.to_datetime(end_date))
    sub = df_prep.loc[mask].copy()
    
    if sub.empty:
        return {"stacked_data": [], "total_line": [], "table_data": [], "events": []}

    # Aggregate
    sub = sub.set_index("Timestamp")
    g = pd.Grouper(freq=freq)
    
    # 1. Group by Period + Event
    grouped = sub.groupby([g, "event"])[["duration_h", "rain_mm"]].sum().reset_index()
    
    # 2. Total per period
    total_per_period = sub.groupby(g)[["duration_h", "rain_mm"]].sum().reset_index()
    total_per_period = total_per_period.rename(columns={
        "duration_h": "total_dur_h", 
        "rain_mm": "total_rain_mm"
    })
    
    # Merge
    merged = pd.merge(grouped, total_per_period, on="Timestamp", how="left")
    
    merged["share_pct"] = np.where(
        merged["total_dur_h"] > 0,
        100 * merged["duration_h"] / merged["total_dur_h"],
        0.0
    )
    
    # Rounding
    merged["duration_h"] = merged["duration_h"].round(1)
    merged["rain_mm"] = merged["rain_mm"].round(1)
    merged["share_pct"] = merged["share_pct"].round(1)
    
    # Format for frontend
    stacked_data = []
    for _, row in merged.iterrows():
        stacked_data.append({
            "period": row["Timestamp"].strftime("%Y-%m-%d"),
            "event": row["event"],
            "duration": row["duration_h"],
            "precip": row["rain_mm"],
            "share": row["share_pct"]
        })
        
    total_line = []
    for _, row in total_per_period.iterrows():
        total_line.append({
            "period": row["Timestamp"].strftime("%Y-%m-%d"),
            "total_mm": round(row["total_rain_mm"], 1)
        })
        
    events = sorted(merged["event"].unique())
    
    table_rows = []
    for period, group in merged.groupby("Timestamp"):
        row_obj = {"period": period.strftime("%Y-%m-%d")}
        for e in events:
            row_obj[f"{e}_dur"] = 0.0
            row_obj[f"{e}_mm"] = 0.0
        for _, r in group.iterrows():
            evt = r["event"]
            row_obj[f"{evt}_dur"] = r["duration_h"]
            row_obj[f"{evt}_mm"] = r["rain_mm"]
        table_rows.append(row_obj)
        
    return {
        "stacked_data": stacked_data,
        "total_line": total_line,
        "table_data": table_rows,
        "events": events
    }



def prepare_dynamic_data(df_raw: pd.DataFrame) -> pd.DataFrame:
    """
    Prepare WS100 data for dynamic analysis:
    - Map precipitation types to events
    - Calculate duration of each interval
    """
    df = df_raw.copy()
    
    # Ensure sorted
    df = df.sort_values("Timestamp")
    
    # Map events
    if "precipitationType" in df.columns:
        df["event"] = df["precipitationType"].apply(bucket_precip_type)
    else:
        df["event"] = "Unknown"
        
    # Calculate duration (time until next timestamp)
    dt = df["Timestamp"].shift(-1) - df["Timestamp"]
    dt_sec = dt.dt.total_seconds()
    
    # Fill last/invalid intervals with median positive step (usually 60s or 600s)
    valid_steps = dt_sec[dt_sec > 0]
    median_step = np.nanmedian(valid_steps) if len(valid_steps) > 0 else 600.0
    
    # Replace invalid durations (<=0 or NaN) with median
    dt_sec = np.where((dt_sec <= 0) | np.isnan(dt_sec), median_step, dt_sec)
    
    df["duration_h"] = dt_sec / 3600.0
    
    # Rename rain column for consistency if needed, though we use specific col later
    # We assume 'precipitationQuantityDiff_mm' exists as per user snippet, 
    # or we use 'Rain_mm_10min' if that's what we have.
    # In sensor_summary we renamed precipitationQuantityDiff_mm -> Rain_mm_10min.
    # Let's check what we load. We will load raw and rename.
    
    return df


def analyze_dynamic(
    sensor_name: str, 
    start_date: str, 
    end_date: str, 
    freq: str = "MS"
) -> dict:
    """
    Dynamic analysis for WS100 dashboard.
    
    Args:
        sensor_name: Name of sensor
        start_date: Start date string (YYYY-MM-DD)
        end_date: End date string (YYYY-MM-DD)
        freq: Pandas frequency string (D, W-MON, MS)
        
    Returns:
        Dict with keys: stacked_data, total_line, table_data
    """
    csv_path = WS100_DATA_DIR / f"df_{sensor_name}.csv"
    if not csv_path.exists():
        raise FileNotFoundError(f"Sensor '{sensor_name}' not found")
        
    # Load raw data
    raw_df = pd.read_csv(csv_path)
    raw_df["Timestamp"] = pd.to_datetime(raw_df["Timestamp"])
    
    # Filter by date range first to speed up if needed, but 'prepare' needs next timestamp 
    # so better to prepare then filter, or filter with buffer. 
    # Let's prepare all then filter.
    
    # Rename rain column for consistency with user logic
    if "precipitationQuantityDiff_mm" in raw_df.columns:
        raw_df["rain_mm"] = raw_df["precipitationQuantityDiff_mm"]
    elif "Rain_mm_10min" in raw_df.columns:
         raw_df["rain_mm"] = raw_df["Rain_mm_10min"]
    else:
         raw_df["rain_mm"] = 0.0
         
    df_prep = prepare_dynamic_data(raw_df)
    
    # Filter by date
    mask = (df_prep["Timestamp"] >= pd.to_datetime(start_date)) & \
           (df_prep["Timestamp"] <= pd.to_datetime(end_date))
    sub = df_prep.loc[mask].copy()
    
    if sub.empty:
        return {"stacked_data": [], "total_line": [], "table_data": []}

    # Aggregate
    sub = sub.set_index("Timestamp")
    g = pd.Grouper(freq=freq)
    
    # 1. Group by Period + Event
    # Sum duration and rain
    grouped = sub.groupby([g, "event"])[["duration_h", "rain_mm"]].sum().reset_index()
    
    # 2. Total per period (for line chart and share calc)
    total_per_period = sub.groupby(g)[["duration_h", "rain_mm"]].sum().reset_index()
    total_per_period = total_per_period.rename(columns={
        "duration_h": "total_dur_h", 
        "rain_mm": "total_rain_mm"
    })
    
    # Merge totals back to calculate share
    merged = pd.merge(grouped, total_per_period, on="Timestamp", how="left")
    
    merged["share_pct"] = np.where(
        merged["total_dur_h"] > 0,
        100 * merged["duration_h"] / merged["total_dur_h"],
        0.0
    )
    
    # Rounding
    merged["duration_h"] = merged["duration_h"].round(1)
    merged["rain_mm"] = merged["rain_mm"].round(1)
    merged["share_pct"] = merged["share_pct"].round(1)
    
    # Format for frontend
    # Stacked Data: list of { period, event, duration, precip, share }
    stacked_data = []
    for _, row in merged.iterrows():
        stacked_data.append({
            "period": row["Timestamp"].strftime("%Y-%m-%d"),
            "event": row["event"],
            "duration": row["duration_h"],
            "precip": row["rain_mm"],
            "share": row["share_pct"]
        })
        
    # Total Line Data: list of { period, total_mm }
    total_line = []
    for _, row in total_per_period.iterrows():
        total_line.append({
            "period": row["Timestamp"].strftime("%Y-%m-%d"),
            "total_mm": round(row["total_rain_mm"], 1)
        })
        
    # Table Data: Pivot
    # We want rows as periods, columns as Event_Metric
    # But frontend might prefer a list of objects where keys are dynamic.
    # Let's construct a list of dicts: { period: "2023-01-01", "Rain_dur": 10, "Rain_mm": 5, ... }
    
    # Get all unique events
    events = sorted(merged["event"].unique())
    
    table_rows = []
    for period, group in merged.groupby("Timestamp"):
        row_obj = {"period": period.strftime("%Y-%m-%d")}
        
        # Initialize all to 0
        for e in events:
            row_obj[f"{e}_dur"] = 0.0
            row_obj[f"{e}_mm"] = 0.0
            
        for _, r in group.iterrows():
            evt = r["event"]
            row_obj[f"{evt}_dur"] = r["duration_h"]
            row_obj[f"{evt}_mm"] = r["rain_mm"]
            
        table_rows.append(row_obj)
        
    return {
        "stacked_data": stacked_data,
        "total_line": total_line,
        "table_data": table_rows,
        "events": events
    }



def demo_summary() -> dict:
    """
    Build a small synthetic WS100 rain dataset, run it through the
    WS100 preprocessing pipeline, and return simple summary stats.

    This is only for testing the backend wiring. Later we will
    replace the synthetic data with real CSV loading.
    """
    # Create a simple 10-min synthetic time series for 24 hours
    timestamps = pd.date_range("2023-07-01 00:00:00", periods=24 * 6, freq="10min")

    # Synthetic rain: a dry period, then a few hours of rain, then dry again
    rain = np.zeros(len(timestamps))
    # Let it rain between 06:00–09:00 and 18:00–20:00
    rain[(timestamps.hour >= 6) & (timestamps.hour < 9)] = 0.8  # 0.8 mm / 10 min
    rain[(timestamps.hour >= 18) & (timestamps.hour < 20)] = 0.4

    raw_df = pd.DataFrame(
        {
            "Timestamp": timestamps,
            "Rain_mm_10min": rain,
        }
    )

    df_clean = clean_ws100_sensor(raw_df)
    hourly = aggregate_ws100_hourly(df_clean)

    total_rain = float(df_clean["Rain_mm"].sum())
    max_hourly = float(hourly["Rain_mm_hour"].max())
    rain_hours = int((hourly["Rain_mm_hour"] > 0).sum())

    return {
        "rows_raw": int(len(raw_df)),
        "rows_clean": int(len(df_clean)),
        "rows_hourly": int(len(hourly)),
        "rain_total_mm": total_rain,
        "rain_max_hour_mm": max_hourly,
        "rain_hours": rain_hours,
    }


def list_sensors() -> list[str]:
    """
    List all available WS100 sensor CSV files (without df_ prefix and .csv extension).
    
    Returns:
        List of sensor names, e.g. ['Kaakkovuorentie', 'Kotaniementie', 'Saaritie', ...]
    """
    if not WS100_DATA_DIR.exists():
        return []
    
    csv_files = sorted(WS100_DATA_DIR.glob("df_*.csv"))
    # Remove 'df_' prefix and '.csv' suffix
    sensor_names = [f.stem.replace("df_", "") for f in csv_files]
    
    return sensor_names


def sensor_summary(sensor_name: str) -> dict:
    """
    Load a real WS100 sensor CSV and compute summary statistics.
    
    Args:
        sensor_name: Name of the sensor (e.g., 'Saaritie', 'Kaakkovuorentie')
    
    Returns:
        Dictionary with summary statistics
    
    Raises:
        FileNotFoundError: If the sensor CSV file does not exist
    """
    csv_path = WS100_DATA_DIR / f"df_{sensor_name}.csv"
    
    if not csv_path.exists():
        available = list_sensors()
        raise FileNotFoundError(
            f"Sensor '{sensor_name}' not found. Available sensors: {available}"
        )
    
    # Load the CSV
    raw_df = pd.read_csv(csv_path)
    
    # The WS100 CSVs have columns: Timestamp, precipitationIntensity_mm_h, 
    # precipitationIntensity_mm_min, precipitationQuantityAbs_mm, 
    # precipitationQuantityDiff_mm, precipitationType
    # We'll use precipitationQuantityDiff_mm as the rain accumulation per interval
    
    # Prepare for cleaning pipeline
    df_for_cleaning = raw_df[["Timestamp", "precipitationQuantityDiff_mm"]].copy()
    df_for_cleaning = df_for_cleaning.rename(
        columns={"precipitationQuantityDiff_mm": "Rain_mm_10min"}
    )
    
    # Clean and aggregate
    df_clean = clean_ws100_sensor(df_for_cleaning)
    hourly = aggregate_ws100_hourly(df_clean)
    
    # Compute statistics
    total_rain = float(df_clean["Rain_mm"].sum())
    max_hourly = float(hourly["Rain_mm_hour"].max())
    rain_hours = int((hourly["Rain_mm_hour"] > 0).sum())
    
    # Additional statistics
    mean_hourly = float(hourly["Rain_mm_hour"].mean())
from pathlib import Path
import pandas as pd
import numpy as np

from backend.config import WS100_DATA_DIR
from backend.core.io_ws100 import clean_ws100_sensor, aggregate_ws100_hourly


def demo_summary() -> dict:
    """
    Build a small synthetic WS100 rain dataset, run it through the
    WS100 preprocessing pipeline, and return simple summary stats.

    This is only for testing the backend wiring. Later we will
    replace the synthetic data with real CSV loading.
    """
    # Create a simple 10-min synthetic time series for 24 hours
    timestamps = pd.date_range("2023-07-01 00:00:00", periods=24 * 6, freq="10min")

    # Synthetic rain: a dry period, then a few hours of rain, then dry again
    rain = np.zeros(len(timestamps))
    # Let it rain between 06:00–09:00 and 18:00–20:00
    rain[(timestamps.hour >= 6) & (timestamps.hour < 9)] = 0.8  # 0.8 mm / 10 min
    rain[(timestamps.hour >= 18) & (timestamps.hour < 20)] = 0.4

    raw_df = pd.DataFrame(
        {
            "Timestamp": timestamps,
            "Rain_mm_10min": rain,
        }
    )

    df_clean = clean_ws100_sensor(raw_df)
    hourly = aggregate_ws100_hourly(df_clean)

    total_rain = float(df_clean["Rain_mm"].sum())
    max_hourly = float(hourly["Rain_mm_hour"].max())
    rain_hours = int((hourly["Rain_mm_hour"] > 0).sum())

    return {
        "rows_raw": int(len(raw_df)),
        "rows_clean": int(len(df_clean)),
        "rows_hourly": int(len(hourly)),
        "rain_total_mm": total_rain,
        "rain_max_hour_mm": max_hourly,
        "rain_hours": rain_hours,
    }


def list_sensors() -> list[str]:
    """
    List all available WS100 sensor CSV files (without df_ prefix and .csv extension).
    
    Returns:
        List of sensor names, e.g. ['Kaakkovuorentie', 'Kotaniementie', 'Saaritie', ...]
    """
    if not WS100_DATA_DIR.exists():
        return []
    
    csv_files = sorted(WS100_DATA_DIR.glob("df_*.csv"))
    # Remove 'df_' prefix and '.csv' suffix
    sensor_names = [f.stem.replace("df_", "") for f in csv_files]
    
    return sensor_names


def sensor_summary(sensor_name: str) -> dict:
    """
    Load a real WS100 sensor CSV and compute summary statistics.
    
    Args:
        sensor_name: Name of the sensor (e.g., 'Saaritie', 'Kaakkovuorentie')
    
    Returns:
        Dictionary with summary statistics
    
    Raises:
        FileNotFoundError: If the sensor CSV file does not exist
    """
    csv_path = WS100_DATA_DIR / f"df_{sensor_name}.csv"
    
    if not csv_path.exists():
        available = list_sensors()
        raise FileNotFoundError(
            f"Sensor '{sensor_name}' not found. Available sensors: {available}"
        )
    
    # Load the CSV
    raw_df = pd.read_csv(csv_path)
    
    # The WS100 CSVs have columns: Timestamp, precipitationIntensity_mm_h, 
    # precipitationIntensity_mm_min, precipitationQuantityAbs_mm, 
    # precipitationQuantityDiff_mm, precipitationType
    # We'll use precipitationQuantityDiff_mm as the rain accumulation per interval
    
    # Prepare for cleaning pipeline
    df_for_cleaning = raw_df[["Timestamp", "precipitationQuantityDiff_mm"]].copy()
    df_for_cleaning = df_for_cleaning.rename(
        columns={"precipitationQuantityDiff_mm": "Rain_mm_10min"}
    )
    
    # Clean and aggregate
    df_clean = clean_ws100_sensor(df_for_cleaning)
    hourly = aggregate_ws100_hourly(df_clean)
    
    # Compute statistics
    total_rain = float(df_clean["Rain_mm"].sum())
    max_hourly = float(hourly["Rain_mm_hour"].max())
    rain_hours = int((hourly["Rain_mm_hour"] > 0).sum())
    
    # Additional statistics
    mean_hourly = float(hourly["Rain_mm_hour"].mean())
    std_hourly = float(hourly["Rain_mm_hour"].std())
    
    # Time period
    start_date = df_clean["Timestamp"].min()
    end_date = df_clean["Timestamp"].max()
    
    return {
        "sensor_name": sensor_name,
        "rows_raw": int(len(raw_df)),
        "rows_clean": int(len(df_clean)),
        "rows_hourly": int(len(hourly)),
        "rain_total_mm": round(total_rain, 2),
        "rain_max_hour_mm": round(max_hourly, 2),
        "rain_mean_hour_mm": round(mean_hourly, 2),
        "rain_std_hour_mm": round(std_hourly, 2),
        "rain_hours": rain_hours,
        "start_date": str(start_date),
        "end_date": str(end_date),
        "days_total": int((end_date - start_date).days + 1),
    }


def get_sensor_data(sensor_name: str) -> dict:
    """
    Get hourly rain data for a specific sensor.
    """
    csv_path = WS100_DATA_DIR / f"df_{sensor_name}.csv"
    
    if not csv_path.exists():
        raise FileNotFoundError(f"Sensor '{sensor_name}' not found")
    
    raw_df = pd.read_csv(csv_path)
    
    # Prepare for cleaning pipeline
    df_for_cleaning = raw_df[["Timestamp", "precipitationQuantityDiff_mm"]].copy()
    df_for_cleaning = df_for_cleaning.rename(
        columns={"precipitationQuantityDiff_mm": "Rain_mm_10min"}
    )
    
    # Clean and aggregate
    df_clean = clean_ws100_sensor(df_for_cleaning)
    hourly = aggregate_ws100_hourly(df_clean)
    
    # Format for frontend
    hourly["timestamp"] = hourly["Timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%S")
    
    return {
        "sensor_name": sensor_name,
        "data": hourly[["timestamp", "Rain_mm_hour"]].to_dict(orient="records")
    }