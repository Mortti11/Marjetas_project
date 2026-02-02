# backend/config.py


from pathlib import Path

# Project root (assuming this file lives in <root>/backend/config.py)
PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Cleaned datasets base directory
CLEANED_DATA_ROOT = PROJECT_ROOT / "cleaned_datasets"

# LHT cleaned datasets directory
LHT_DATA_DIR = CLEANED_DATA_ROOT / "LHT"

# WS100 cleaned datasets directory
WS100_DATA_DIR = CLEANED_DATA_ROOT / "wes100"

# Wind data from airport station
WIND_DATA_PATH = CLEANED_DATA_ROOT / "cleaned_wind_data.csv"

# 10-day forecast CSV (hourly)
FORECAST_DATA_PATH = CLEANED_DATA_ROOT / "forecast" / "jyvaskyla_10d_hourly.csv"

__all__ = [
	"PROJECT_ROOT",
	"CLEANED_DATA_ROOT",
	"LHT_DATA_DIR",
	"WS100_DATA_DIR",
	"WIND_DATA_PATH",
	"FORECAST_DATA_PATH",
]
