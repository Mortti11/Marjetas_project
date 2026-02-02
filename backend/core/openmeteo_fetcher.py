import requests
import pandas as pd

# Jyväskylä coordinates
JYV_LAT = 62.2415
JYV_LON = 25.7209

def fetch_openmeteo_jyvaskyla(forecast_days=10):
    url = "https://api.open-meteo.com/v1/forecast"

    hourly_vars = [
        "temperature_2m",
        "relativehumidity_2m",
        "dewpoint_2m",
        "precipitation",
        "rain",
        "snowfall",
        "weathercode",
        "windspeed_10m",
        "winddirection_10m",
        "surface_pressure",]

    params = {
        "latitude": JYV_LAT,
        "longitude": JYV_LON,
        "hourly": ",".join(hourly_vars),
        "forecast_days": forecast_days,
        "timezone": "Europe/Helsinki",}

    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()

    data = resp.json()
    hourly = data["hourly"]

    df = pd.DataFrame({"time": hourly["time"]})
    for var in hourly_vars:
        df[var] = hourly[var]

    df["time"] = pd.to_datetime(df["time"])
    return df
