# Marjetas Project

A weather monitoring and road safety forecasting system for Jyväskylä, Finland.

## What It Does

This system helps predict slippery road conditions by:

- Collecting data from temperature, humidity, and precipitation sensors
- Detecting rain and snow events
- Calculating when roads will dry after precipitation
- Showing road risk levels on a dashboard

---

## Quick Start

### Requirements

- Python 3.9+
- Node.js 18+

### Run the Backend

```bash
cd backend
pip install fastapi uvicorn pandas numpy
python app.py
```

The API runs at `http://localhost:8000`

### Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

The dashboard runs at `http://localhost:5173`

---

## Project Structure

```
Marjetas_project/
├── backend/              # Python API server
│   ├── app.py            # Main application
│   ├── core/             # Physics and calculations
│   ├── services/         # Business logic
│   └── routes/           # API endpoints
├── frontend/             # React dashboard
│   └── src/
│       ├── pages/        # Main views
│       └── components/   # UI components
├── cleaned_datasets/     # Processed sensor data
│   ├── LHT/              # Temperature/humidity sensors
│   └── wes100/           # Precipitation sensors
└── Marjetas_Data/        # Raw sensor data
```

---

## Sensors

### LHT Sensors (7 locations)
Measure temperature and humidity. Located at:
- Hameenpohjantie, Hikipolku, Kaunisharjuntie, Keilonkankaantie
- Keltimaentie, Ritopohantie, Survontie

### WS100 Sensors (5 locations)
Measure rain and snow. Located at:
- Kaakkovuorentie, Kotaniementie, Saaritie
- Tahtiniementie, Tuulimyllyntie

### Wind Station
Provides wind speed and direction data.

### Weather Forecast
Live forecasts from Open-Meteo API.

---

## Main Features

### Road Risk Assessment
Calculates a slipperiness score (0-100) based on:
- Recent precipitation
- Freezing temperatures (-4°C to +1°C)
- Black ice conditions
- Time of day (higher risk during commute hours)

### Event Detection
Groups rainy/snowy hours into events and tracks:
- Event duration and total precipitation
- Time until roads dry

### Dashboard Pages

| Page | What It Shows |
|------|---------------|
| Map | Sensor locations on a map |
| LHT | Temperature and humidity data |
| WS100 | Precipitation data |
| Analyze | Weather event analysis |
| Road Forecast | Road risk predictions |
| Storm Signatures | Storm pattern analysis |

---

## API Endpoints

### Sensor Data
- `GET /api/lht/list` - List temperature sensors
- `GET /api/ws100/list` - List precipitation sensors
- `GET /api/lht/sensor-summary?sensor=NAME` - Get sensor stats
- `GET /api/ws100/sensor-summary?sensor=NAME` - Get sensor stats

### Analysis
- `GET /api/analyze/pair-hourly` - Merged sensor data with weather flags
- `GET /api/analyze/pair-daily?date=YYYY-MM-DD` - Daily analysis
- `GET /api/analyze/event-aggregates?date=YYYY-MM-DD` - Event details

### Forecasts
- `GET /api/forecast/summary` - 10-day weather forecast
- `GET /api/road-forecast/city` - Road risk forecast

### Docs
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## How It Works

### Wetness Detection
A surface is wet when:
- Rain > 0.2 mm/hour, OR
- Humidity ≥ 90% AND temperature is close to dew point

### Drying Detection
A surface is considered dry when ALL of these are true:
- No rain (or only trace amounts)
- Humidity below 88%
- Temperature is well above dew point
- Some wind present

### Black Ice Risk
High risk when:
- Temperature between -4°C and +1°C
- Surface was wet recently
- Humidity above 95%

---

## Data Files

| Type | Location |
|------|----------|
| Temperature/Humidity | `cleaned_datasets/LHT/*.csv` |
| Precipitation | `cleaned_datasets/wes100/df_*.csv` |
| Wind | `cleaned_datasets/cleaned_wind_data.csv` |
| Raw Data | `Marjetas_Data/` |

---

## Tech Stack

**Backend:**
- Python
- FastAPI
- Pandas, NumPy

**Frontend:**
- React 19
- Vite
- Chart.js, Recharts
- Leaflet (maps)
- Tailwind CSS

---

## Tests

Run backend tests:
```bash
cd backend
python -m pytest tests/
```

---

## License

Internal project - licensing to be determined.
