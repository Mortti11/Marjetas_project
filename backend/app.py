from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.core import physics

import backend.services.lht_service as lht_service
import backend.services.ws100_service as ws100_service
import backend.services.sensor_meta as sensor_meta
import backend.services.pair_service as pair_service
import backend.services.forecast_service as forecast_service
from backend.routes import road_forecast

app = FastAPI(
    title="Jyväskylä Weather Analysis API",
    version="0.1.0",
    description="Backend for LHT, WS100 and merged weather analysis.",
)

# Allow CORS for local React development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(road_forecast.router)



@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/test-dewpoint")
def test_dewpoint(temp_c: float = 0.0, rh: float = 100.0):
    """
    Simple test endpoint to verify physics helpers and the API wiring.

    Example:
      /api/test-dewpoint?temp_c=5&rh=80
    """
    dp = float(physics.dewpoint_C(temp_c, rh))
    return {
        "input": {"temp_c": temp_c, "rh": rh},
        "dewpoint_C": dp,
    }


@app.get("/api/lht/demo-summary")
def lht_demo_summary():
    """
    Run the LHT pipeline on synthetic data and return the summary stats.
    """
    return lht_service.demo_summary()


@app.get("/api/lht/sensor-summary")
def lht_sensor_summary(
    sensor: str,
    year: int = None,
    month: int = None,
    day: int = None
):
    """
    Load and summarize a real LHT sensor dataset.
    
    Args:
        sensor: Sensor name
        year: Optional year filter
        month: Optional month filter
        day: Optional day filter
    
    Example:
      /api/lht/sensor-summary?sensor=Kaunisharjuntie&year=2023&month=7&day=15
    """
    try:
        return lht_service.sensor_summary(sensor, year, month, day)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/lht/list")
def get_lht_sensors():
    """
    Returns a list of available LHT sensor names.
    
    Example response:
      {"sensors": ["Kaunisharjuntie", "Keltimaentie", ...]}
    """
    return {"sensors": lht_service.list_sensors()}


@app.get("/api/lht/network-summary")
def get_lht_network_summary():
    """
    Returns summary statistics for ALL LHT sensors with network-wide comparisons.
    
    Provides:
    - per_location: Absolute values for each sensor
    - vs_network_mean: Differences from network average
    - network_mean: Network-wide mean values
    
    This enables matrix comparison views similar to WS100 network analysis.
    
    Example:
      /api/lht/network-summary
    """
    return lht_service.network_summary()


@app.get("/api/lht/sensor-timeseries")
def get_lht_sensor_timeseries(sensor: str, year: int = None, freq: str = 'M'):
    """
    Get time-series aggregations for an LHT sensor.
    
    Args:
        sensor: Sensor name
        year: Optional year filter
        freq: 'M' for monthly, 'D' for daily
    
    Example:
      /api/lht/sensor-timeseries?sensor=Kaunisharjuntie&year=2023&freq=M
    """
    try:
        return lht_service.sensor_timeseries(sensor, year, freq)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/lht/sensor-daily-detail")
def get_lht_sensor_daily_detail(sensor: str, date: str):
    """
    Get hourly detail for a specific date.
    
    Args:
        sensor: Sensor name
        date: Date in YYYY-MM-DD format
    
    Example:
      /api/lht/sensor-daily-detail?sensor=Kaunisharjuntie&date=2023-07-15
    """
    try:
        return lht_service.sensor_daily_detail(sensor, date)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/ws100/demo-summary")
def ws100_demo_summary():
    """
    Run the WS100 pipeline on synthetic data and return the summary stats.
    """
    return ws100_service.demo_summary()



@app.get("/api/forecast/summary")
def forecast_summary():
    """
    10-day hourly forecast summary for Jyväskylä.

    Used by the Overview KPI cards.
    """
    return forecast_service.summary_10d()


@app.get("/api/ws100/sensor-summary")
def ws100_sensor_summary(sensor: str):
    """
    Load and summarize a real WS100 sensor dataset.
    
    Example:
      /api/ws100/sensor-summary?sensor=Saaritie
    """
    try:
        return ws100_service.sensor_summary(sensor)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/ws100/list")
def ws100_list_sensors():
    """
    List all available WS100 sensor datasets.
    
    Returns:
      List of sensor names (without df_ prefix and .csv extension)
    """
    return {"sensors": ws100_service.list_sensors()}


@app.get("/api/ws100/data")
def ws100_sensor_data(sensor: str):
    """
    Get hourly rain data for a specific WS100 sensor.
    """
    try:
        return ws100_service.get_sensor_data(sensor)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/ws100/dynamic-analysis")
def ws100_dynamic_analysis(
    sensor: str,
    start_date: str,
    end_date: str,
    freq: str = "MS"
):
    """
    Get dynamic analysis data for WS100 dashboard.
    
    Args:
        sensor: Name of the sensor
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        freq: Pandas frequency string (D=Daily, W-MON=Weekly, MS=Monthly)
    
    Returns:
        Dynamic analysis data with stacked_data, total_line, table_data, and events
    """
    try:
        return ws100_service.analyze_dynamic(sensor, start_date, end_date, freq)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/api/sensors")
def list_sensors():
    """
    Return a list of all configured sensors (LHT and WS100).
    """
    return sensor_meta.list_sensors()


@app.get("/api/analyze/demo")
def analyze_demo():
    """
    Return a merged analysis of LHT and WS100 demo data.
    """
    return pair_service.demo_analysis()

@app.get("/api/analyze/pair-hourly")
def analyze_pair_hourly(
    lht_sensor: str = "Kaunisharjuntie",
    ws100_sensor: str = "Kotaniementie",
    max_hours: int = 168,
):
    """
    Backend building block for the Analyze Weather page.

    Returns merged hourly data for one LHT + WS100 pair with
    environment flags (is_raining, wet_or_rain, dry_enough_city, etc.).
    """
    return pair_service.pair_hourly_preview(lht_sensor, ws100_sensor, max_hours)


@app.get("/api/analyze/pair-daily")
def analyze_pair_daily(
    date: str,
    lht_sensor: str = "Kaunisharjuntie",
    ws100_sensor: str = "Kotaniementie",
):
    """
    Analyze one day for a sensor pair.
    
    Returns daily summary stats and hourly data for the specified date.
    
    Args:
        date: target date in YYYY-MM-DD format (e.g., "2025-09-18")
        lht_sensor: LHT sensor name
        ws100_sensor: WS100 sensor name
    
    Returns:
        {
            "date": str,
            "lht_sensor": str,
            "ws100_sensor": str,
            "summary": { daily stats including T_mean, rain_total_mm, wet_hours, etc. },
            "hourly": [ array of hourly records for the day ]
        }
    """
    return pair_service.pair_daily_analysis(lht_sensor, ws100_sensor, date)


@app.get("/api/analyze/event-aggregates")
def event_aggregates(
    date: str,
    lht_sensor: str = pair_service.DEFAULT_LHT,
    ws100_sensor: str = pair_service.DEFAULT_WS100,
    pre_h: int = 6,
    post_h: int = 12,):
    
    """Return event-aggregated environment and fraction metrics plus RH heatmap.

    Args mirror pair_event_aggregates in pair_service. No existing endpoints modified.
    """
    return pair_service.pair_event_aggregates(
        date_str=date,
        lht_sensor=lht_sensor,
        ws100_sensor=ws100_sensor,
        pre_h=pre_h,
        post_h=post_h,
    )
