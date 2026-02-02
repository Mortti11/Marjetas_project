import pandas as pd


def load_wind_hourly(csv_path: str) -> pd.DataFrame:
    """
    Load the cleaned wind data from the airport station.
    
    Expected columns:
      - Timestamp
      - wind_speed_10m (km/h)
      - wind_direction_10m (°)
      - wind_gusts_10m (km/h)
    
    Returns hourly DataFrame with standardized column names.
    """
    df = pd.read_csv(csv_path)
    df["Timestamp"] = pd.to_datetime(df["Timestamp"])
    df = df.sort_values("Timestamp")
    
    # Rename to standardized names
    df = df.rename(columns={
        "wind_speed_10m (km/h)": "wind_speed_kmh",
        "wind_direction_10m (°)": "wind_direction_deg",
        "wind_gusts_10m (km/h)": "wind_gusts_kmh",
        "surface_pressure (hPa)": "surface_pressure_hpa",
    })
    
    # Keep only relevant columns
    possible_cols = [
        "Timestamp",
        "wind_speed_kmh",
        "wind_direction_deg",
        "wind_gusts_kmh",
        "surface_pressure_hpa"
    ]
    cols_to_keep = [c for c in possible_cols if c in df.columns]
    
    return df[cols_to_keep].reset_index(drop=True)
