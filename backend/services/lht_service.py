from pathlib import Path
import pandas as pd
import numpy as np

from backend.config import LHT_DATA_DIR
from backend.core.io_lht import (
    clean_lht_sensor,
    prepare_and_features,
    summarize,
)


def demo_summary() -> dict:
    """
    Build a small synthetic LHT dataset, run it through the
    LHT preprocessing pipeline, and return the summary.

    This is only for testing the backend wiring. Later we will
    replace the synthetic data with real CSV loading.
    """
    # Create a simple 24-hour synthetic time series
    # Use lowercase 'h' for hourly frequency to avoid pandas FutureWarning
    timestamps = pd.date_range("2023-07-01 00:00:00", periods=24, freq="h")
    temp = np.linspace(10.0, 20.0, 24)   # from 10°C to 20°C
    hum = np.linspace(70.0, 95.0, 24)    # from 70% to 95%

    raw_df = pd.DataFrame(
        {
            "Timestamp": timestamps,
            "TempC_SHT": temp,
            "Hum_SHT": hum,
        }
    )

    # Run the LHT pipeline
    df_clean = clean_lht_sensor(raw_df)
    df_prep = prepare_and_features(df_clean)
    stats = summarize(df_prep)

    # Ensure plain dict with JSON-serializable values
    return stats


def list_sensors() -> list[str]:
    """
    List all available LHT sensor CSV files (without .csv extension).
    
    Returns:
        List of sensor names, e.g. ['Kaunisharjunti', 'Keltimaentie', ...]
    """
    if not LHT_DATA_DIR.exists():
        return []
    
    csv_files = LHT_DATA_DIR.glob("*.csv")
    return sorted([f.stem for f in csv_files])


def sensor_summary(
    sensor_name: str,
    year: int = None,
    month: int = None,
    day: int = None
) -> dict:
    """
    Load a real LHT sensor CSV, process it, and return summary stats.
    
    Args:
        sensor_name: Name of the sensor (without .csv), e.g. 'Kaunisharjuntie'
        year: Optional year to filter by
        month: Optional month to filter by
        day: Optional day to filter by
    
    Returns:
        Summary statistics dict from summarize()
    
    Raises:
        FileNotFoundError: If the sensor CSV does not exist
    """
    csv_path = LHT_DATA_DIR / f"{sensor_name}.csv"
    
    if not csv_path.exists():
        available = list_sensors()
        raise FileNotFoundError(
            f"Sensor '{sensor_name}' not found. "
            f"Available sensors: {', '.join(available) if available else 'none'}"
        )
    
    # Load the CSV
    raw_df = pd.read_csv(csv_path)
    
    # Run the LHT pipeline
    df_clean = clean_lht_sensor(raw_df)
    
    # Filter by date if requested
    if year or month or day:
        # Ensure timestamp is datetime
        if not pd.api.types.is_datetime64_any_dtype(df_clean['Timestamp']):
            df_clean['Timestamp'] = pd.to_datetime(df_clean['Timestamp'])
            
        mask = pd.Series(True, index=df_clean.index)
        
        if year:
            mask &= (df_clean['Timestamp'].dt.year == year)
        if month:
            mask &= (df_clean['Timestamp'].dt.month == month)
        if day:
            mask &= (df_clean['Timestamp'].dt.day == day)
            
        df_clean = df_clean[mask]
        
        if df_clean.empty:
            # Return empty stats structure if no data matches
            return {
                "rows": 0,
                "T_mean": None, "T_min": None, "T_max": None,
                "RH_mean": None, "RH_min": None, "RH_max": None,
                "VPD_peak_mean": None, "VPD_peak_smooth": None,
                "DTR_median": None,
                "Temperature_24H": None, "Humidity_24H": None,
                "%RH>=90": 0, "%RH<=30": 0
            }

    df_prep = prepare_and_features(df_clean)
    stats = summarize(df_prep)
    
    return stats


def network_summary() -> dict:
    """
    Load all LHT sensors, compute summaries, and return network-wide comparisons.
    
    Returns a dictionary with:
    - per_location: List of dicts with absolute values for each sensor
    - vs_network_mean: List of dicts with differences from network average
    - network_mean: Dict with network-wide mean values
    
    This enables comparison matrices similar to WS100 network analysis.
    """
    sensor_names = list_sensors()
    
    if not sensor_names:
        return {
            "per_location": [],
            "vs_network_mean": [],
            "network_mean": {}
        }
    
    # Collect summaries for all sensors
    summaries = {}
    for name in sensor_names:
        try:
            summaries[name] = sensor_summary(name)
        except FileNotFoundError:
            # Skip sensors that don't have data files
            continue
    
    if not summaries:
        return {
            "per_location": [],
            "vs_network_mean": [],
            "network_mean": {}
        }
    
    # Convert to DataFrame for easier manipulation
    df = pd.DataFrame(summaries).T
    
    # Columns to include in comparison (numeric metrics only)
    numeric_cols = [
        'T_mean', 'T_min', 'T_max',
        'RH_mean', 'RH_min', 'RH_max',
        'DewPoint_mean', 'AbsHum_mean',
        'VPD_peak_mean', 'VPD_peak_smooth',
        'DTR_median', 'Temperature_24H', 'Humidity_24H',
        '%RH>=90', '%RH<=30'
    ]
    
    # Filter to only columns that exist
    available_numeric_cols = [col for col in numeric_cols if col in df.columns]
    
    # Calculate network mean for comparison
    network_mean = df[available_numeric_cols].mean()
    
    # Calculate difference from network mean
    diff_vs_mean = df[available_numeric_cols] - network_mean
    
    # Prepare per-location data (absolute values)
    per_location = df.reset_index().rename(columns={'index': 'station'}).to_dict('records')
    
    # Prepare difference data
    diff_df = diff_vs_mean.reset_index().rename(columns={'index': 'station'})
    vs_network_mean = diff_df.to_dict('records')
    
    return {
        "per_location": per_location,
        "vs_network_mean": vs_network_mean,
        "network_mean": network_mean.to_dict()
    }


def sensor_timeseries(sensor_name: str, year: int = None, freq: str = 'M') -> dict:
    """
    Get time-series aggregations for a sensor (monthly or daily).
    
    Args:
        sensor_name: Name of the sensor
        year: Optional year filter (None = all years)
        freq: 'M' for monthly, 'D' for daily
    
    Returns:
        {
            "sensor": str,
            "freq": str,
            "year": int or None,
            "data": [{"timestamp": "2023-01", "T_mean": 5.2, "VPD_mean": 0.4, "RH90_pct": 65.0}, ...]
        }
    """
    csv_path = LHT_DATA_DIR / f"{sensor_name}.csv"
    
    if not csv_path.exists():
        available = list_sensors()
        raise FileNotFoundError(
            f"Sensor '{sensor_name}' not found. "
            f"Available sensors: {', '.join(available) if available else 'none'}"
        )
    
    # Load and prepare data
    raw_df = pd.read_csv(csv_path)
    df_clean = clean_lht_sensor(raw_df)
    df = prepare_and_features(df_clean)
    
    # Add year/month/day columns
    df['year'] = df['Timestamp'].dt.year
    df['month'] = df['Timestamp'].dt.month
    df['day'] = df['Timestamp'].dt.day
    
    # Filter by year if specified
    if year is not None:
        df = df[df['year'] == year]
    
    if df.empty:
        return {
            "sensor": sensor_name,
            "freq": freq,
            "year": year,
            "data": []
        }
    
    # Aggregate by frequency
    if freq == 'M':
        # Monthly aggregation
        df['period'] = df['Timestamp'].dt.to_period('M')
        grouped = df.groupby('period').agg(
            T_mean=('Temperature_C', 'mean'),
            VPD_mean=('VPD_kPa', 'mean'),
            RH90_pct=('Humidity', lambda x: (x >= 90).mean() * 100)
        ).reset_index()
        grouped['timestamp'] = grouped['period'].astype(str)
        
    elif freq == 'D':
        # Daily aggregation
        df['period'] = df['Timestamp'].dt.date
        grouped = df.groupby('period').agg(
            T_mean=('Temperature_C', 'mean'),
            VPD_mean=('VPD_kPa', 'mean'),
            RH90_pct=('Humidity', lambda x: (x >= 90).mean() * 100)
        ).reset_index()
        grouped['timestamp'] = grouped['period'].astype(str)
    else:
        raise ValueError(f"Invalid freq '{freq}'. Use 'M' or 'D'.")
    
    # Convert to list of dicts
    data = grouped[['timestamp', 'T_mean', 'VPD_mean', 'RH90_pct']].to_dict('records')
    
    # Round values
    for record in data:
        record['T_mean'] = round(record['T_mean'], 2)
        record['VPD_mean'] = round(record['VPD_mean'], 2)
        record['RH90_pct'] = round(record['RH90_pct'], 1)
    
    return {
        "sensor": sensor_name,
        "freq": freq,
        "year": year,
        "data": data
    }


def sensor_daily_detail(sensor_name: str, date: str) -> dict:
    """
    Get hourly detail for a specific date.
    
    Args:
        sensor_name: Name of the sensor
        date: Date string in YYYY-MM-DD format
    
    Returns:
        {
            "sensor": str,
            "date": str,
            "hourly_data": [{"hour": 0, "Temperature_C": 15.2, "Humidity": 85.0, "VPD_kPa": 0.25, "AbsHum_gm3": 10.5}, ...]
        }
    """
    csv_path = LHT_DATA_DIR / f"{sensor_name}.csv"
    
    if not csv_path.exists():
        available = list_sensors()
        raise FileNotFoundError(
            f"Sensor '{sensor_name}' not found. "
            f"Available sensors: {', '.join(available) if available else 'none'}"
        )
    
    # Load and prepare data
    raw_df = pd.read_csv(csv_path)
    df_clean = clean_lht_sensor(raw_df)
    df = prepare_and_features(df_clean)
    
    # Filter by date
    df['date_only'] = df['Timestamp'].dt.date
    target_date = pd.to_datetime(date).date()
    df_day = df[df['date_only'] == target_date].copy()
    
    if df_day.empty:
        return {
            "sensor": sensor_name,
            "date": date,
            "hourly_data": []
        }
    
    # Sort by timestamp
    df_day = df_day.sort_values('Timestamp')
    df_day['hour'] = df_day['Timestamp'].dt.hour
    
    # Select columns and convert to records
    hourly_data = df_day[['hour', 'Temperature_C', 'Humidity', 'VPD_kPa', 'AbsHum_gm3']].to_dict('records')
    
    # Round values
    for record in hourly_data:
        record['Temperature_C'] = round(record['Temperature_C'], 2)
        record['Humidity'] = round(record['Humidity'], 1)
        record['VPD_kPa'] = round(record['VPD_kPa'], 3)
        record['AbsHum_gm3'] = round(record['AbsHum_gm3'], 2)
    
    return {
        "sensor": sensor_name,
        "date": date,
        "hourly_data": hourly_data
    }