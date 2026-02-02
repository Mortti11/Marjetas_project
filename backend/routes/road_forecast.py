from fastapi import APIRouter, Query
from backend.services.road_forecast_service import build_city_road_forecast

router = APIRouter(prefix="/api/road-forecast", tags=["road-forecast"])

@router.get("/city")
def get_city_road_forecast(
    forecast_days: int = Query(10, ge=1, le=10)
):
    """
    Return city-level road forecast summary for Jyväskylä:
    - hourly: timestamp, temp_C, slippery_score, slippery_level
    - events: forecast events with intensity + drying info
    - stats: high-risk hours, etc.
    """
    summary = build_city_road_forecast(forecast_days=forecast_days)
    return summary
