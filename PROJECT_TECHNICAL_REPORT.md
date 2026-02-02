# Marjetas Project - Comprehensive Technical Report

## 📋 Executive Summary

The **Marjetas Project** is a sophisticated environmental monitoring and road safety forecasting system for **Jyväskylä, Finland**. It processes data from multiple sensor types (LHT temperature/humidity sensors, WS100 precipitation sensors, and wind stations) to:

1. **Detect precipitation events** (rain, snow, mixed)
2. **Calculate drying times** after precipitation
3. **Predict road slipperiness** conditions
4. **Provide real-time forecasts** using Open-Meteo API data

---

## 🏗️ Project Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React + Vite)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  MapPage │ │ LhtPage  │ │Ws100Page │ │AnalyzePg│ │RoadForecast  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ HTTP API
┌─────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (FastAPI)                             │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                        ROUTES (API Endpoints)                   │     │
│  │  /api/lht/*  /api/ws100/*  /api/analyze/*  /api/road-forecast/* │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                      SERVICES LAYER                             │     │
│  │  lht_service │ ws100_service │ pair_service │ forecast_service  │     │
│  │              │               │ road_forecast_service            │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                        CORE MODULES                             │     │
│  │  physics.py │ thresholds.py │ event_core.py │ pair_core.py      │     │
│  │  road_risk.py │ forecast_adapter.py │ openmeteo_fetcher.py      │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                       I/O MODULES                               │     │
│  │        io_lht.py  │  io_ws100.py  │  io_wind.py                 │     │
│  └────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          DATA SOURCES                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │  LHT CSVs    │ │  WS100 CSVs  │ │  Wind CSVs   │ │ Open-Meteo   │   │
│  │ (7 sensors)  │ │ (5 sensors)  │ │ (1 station)  │ │  API (Live)  │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🌡️ Sensor Types & Data Sources

### 1. LHT Sensors (Temperature & Humidity)
**Location**: 7 sensors deployed across Jyväskylä
- Hameenpohjantie, Hikipolku, Kaunisharjuntie, Keilonkankaantie, Keltimaentie, Ritopohantie, Survontie

**Data Collected**:
- Temperature (°C) - measured via SHT sensor
- Relative Humidity (%)
- Timestamp

**Data Processing** (`io_lht.py`):
```python
def clean_lht_sensor(raw_data, temp_range=(-40.0, 38.0), hum_range=(0.0, 100.0)):
    # 1. Parse timestamps and sort
    # 2. Filter data from start_date (outdoor period begins 2021-01-08)
    # 3. Remove physically impossible values (outside temp/hum ranges)
    # 4. Interpolate short gaps (up to 3 time steps)
```

**Derived Features**:
- **Dew Point** (°C) - using Sonntag approximation
- **Absolute Humidity** (g/m³)
- **VPD** - Vapour Pressure Deficit (kPa)

### 2. WS100 Sensors (Precipitation)
**Location**: 5 sensors
- Kaakkovuorentie, Kotaniementie, Saaritie, Tahtiniementie, Tuulimyllyntie

**Data Collected**:
- Rain amount (mm per 10-minute interval)
- Precipitation type code (0=Dry, 60=Rain, 61-69=Mix, 70=Snow)

**Processing** (`io_ws100.py`):
```python
def bucket_precip_type(code):
    if code == 0: return "Dry"
    if code == 60: return "Rain"
    if 60 < code < 70: return "Mix"
    if code == 70: return "Snow"
    return "Other"

def aggregate_ws100_hourly(df):
    # Sum rain amounts per hour
    # Determine dominant precipitation type per hour (mode)
```

### 3. Wind Station Data
**Source**: Single station (likely Jyväskylä Airport)

**Data Collected**:
- Wind speed (km/h) at 10m height
- Wind direction (degrees)
- Wind gusts (km/h)
- Surface pressure (hPa)

### 4. Open-Meteo API (Live Forecasts)
**Coordinates**: Jyväskylä (62.2415°N, 25.7209°E)

**Variables Fetched**:
```python
hourly_vars = [
    "temperature_2m", "relativehumidity_2m", "dewpoint_2m",
    "precipitation", "rain", "snowfall", "weathercode",
    "windspeed_10m", "winddirection_10m", "surface_pressure"
]
```

---

## 🔬 Core Physics & Calculations

### `physics.py` - Meteorological Formulas

#### 1. Dew Point Calculation (Sonntag Approximation)
```python
def dewpoint_C(temperature, humidity):
    # Uses different coefficients for above/below freezing
    b = np.where(temperature >= 0, 17.625, 22.46)
    c = np.where(temperature >= 0, 243.04, 272.62)
    rh_frac = np.clip(humidity, 1e-6, 100) / 100.0
    gamma = np.log(rh_frac) + (b * temperature) / (c + temperature)
    return (c * gamma) / (b - gamma)
```

**Why it matters**: Dew point indicates when condensation occurs. When air temperature approaches dew point, surfaces become wet.

#### 2. Saturation Vapour Pressure (Piecewise)
```python
def svp_kpa_piecewise(Tc):
    # Different formulas for liquid water vs ice
    svp_liquid = 0.6108 * exp(17.27 * Tc / (Tc + 237.3))  # Over water
    svp_ice = 0.6108 * exp(21.87 * Tc / (Tc + 265.5))     # Over ice
    return np.where(Tc >= 0.0, svp_liquid, svp_ice)
```

#### 3. Vapour Pressure Deficit (VPD)
```python
def vpd_kpa(Tc, RH):
    svp = svp_kpa_piecewise(Tc)
    return svp * (1 - RH / 100.0)
```

**Why it matters**: VPD indicates the "drying power" of the air. Higher VPD = faster evaporation = faster road drying.

#### 4. Absolute Humidity
```python
def abs_humidity_gm3(Tc, RH):
    # Uses ideal gas law: AH = e / (R_v * T) * 1000
    # R_v = 461.5 J/(kg·K) for water vapor
    # Constant: 1000 / 461.5 ≈ 2.16679
    vapor_pressure_pa = (RH / 100) * svp_kpa * 1000
    T_kelvin = Tc + 273.15
    return 2.16679 * vapor_pressure_pa / T_kelvin
```

---

## ⚡ Environmental Thresholds System

### `thresholds.py` - Centralized Configuration

The system uses a **dataclass-based configuration** for all environmental thresholds:

```python
@dataclass(frozen=True)
class EnvironmentThresholds:
    # Rain detection
    rain_event_mm_h: float = 0.2  # mm/hour threshold for "rainy" hour
    
    # Leaf wetness conditions (surfaces wet from humidity alone)
    leaf_wet_rh_pct: float = 90.0              # RH >= 90%
    leaf_wet_dp_spread_max_C: float = 2.0      # Temp - Dewpoint <= 2°C
    
    # STRICT drying (rural/open areas)
    strict_rain_max_mm_h: float = 0.0          # No rain allowed
    strict_rh_max_pct: float = 75.0            # RH <= 75%
    strict_dp_spread_min_C: float = 2.0        # ΔT >= 2°C
    strict_vpd_min_kpa: float = 0.6            # VPD >= 0.6 kPa
    strict_wind_min_kmh: float = 2.0           # Wind >= 2 km/h
    
    # CITY drying (more lenient for urban heat island)
    city_rain_max_mm_h: float = 0.02           # Trace rain allowed
    city_rh_max_pct: float = 88.0              # RH <= 88%
    city_dp_spread_min_C: float = 1.0          # ΔT >= 1°C
    city_vpd_min_kpa: float = 0.3              # VPD >= 0.3 kPa
    city_wind_min_kmh: float = 1.0             # Wind >= 1 km/h
```

### Threshold Logic Explanation

| Condition | Strict (Rural) | City (Urban) | Purpose |
|-----------|----------------|--------------|---------|
| Max Rain | 0.0 mm/h | 0.02 mm/h | Any rain = wet |
| Max RH | 75% | 88% | High humidity delays drying |
| Min ΔT (Temp-DP) | 2.0°C | 1.0°C | Small spread = near saturation |
| Min VPD | 0.6 kPa | 0.3 kPa | Drying power of air |
| Min Wind | 2 km/h | 1 km/h | Wind aids evaporation |

**Urban vs Rural**: Cities are warmer (heat island effect) and have more shelter from wind, but surfaces dry faster due to heat retention.

---

## 🌧️ Event Detection System

### `event_core.py` - Precipitation Event Logic

#### Event Detection Algorithm

```python
def detect_events(pair_hourly, rain_threshold=0.2, max_gap_hours=4):
    # 1. Identify "rainy" hours:
    #    - rain_mm_hour >= threshold (0.2 mm/h)
    #    - OR precipitation type is Rain/Mix/Snow
    
    # 2. Group consecutive rainy hours into events
    #    - Gap <= 4 hours: same event (bridges short dry spells)
    #    - Gap > 4 hours: new event
    
    # 3. Enrich each event with:
    #    - Duration (hours)
    #    - Total precipitation (mm)
    #    - Dominant precipitation type (mode)
    #    - Intensity classification
```

#### Event Intensity Classification

```python
def classify_event_intensity(mm: float) -> str:
    if mm < 5.0:   return "light"     # < 5 mm total
    if mm < 20.0:  return "moderate"  # 5-20 mm
    if mm < 40.0:  return "heavy"     # 20-40 mm
    return "extreme"                   # > 40 mm
```

#### Event Windows for Analysis

```python
def build_event_windows(pair_hourly, events_df, pre_h=6, post_h=12):
    """
    For each event, extract a time window:
    - pre_h hours BEFORE event start (background conditions)
    - post_h hours AFTER event start (drying period)
    
    Creates COMPLETE hourly time series, filling gaps with NaN.
    rel_hour: -6 to +12 (0 = event start)
    """
```

### Drying Time Calculation

```python
def compute_event_drying_times(windows: pd.DataFrame):
    """
    For each event, find when conditions become 'dry_enough_city'.
    
    Returns:
    - drying_hours_from_start: Hours from event START to dry conditions
    - drying_hours_from_end: Hours from event END to dry conditions
    
    Critical for road safety: tells how long after rain stops
    before roads are safe again.
    """
```

---

## 🚗 Road Risk Assessment

### `road_risk.py` - Slippery Conditions Scoring

The system calculates a **slippery_score (0-100)** based on multiple risk factors:

```python
def add_slippery_risk(df: pd.DataFrame):
    # Risk factors and their weights:
    
    # 1. RECENT WET CONDITIONS (30 points)
    #    - Current hour wet OR either of previous 2 hours wet
    recent_wet = wet_or_rain | wet_or_rain.shift(1) | wet_or_rain.shift(2)
    score += recent_wet * 30.0
    
    # 2. FREEZING BAND (30 points)
    #    - Temperature between -4°C and +1°C (black ice risk zone)
    is_freezing_band = (temp_C >= -4.0) & (temp_C <= 1.0)
    score += is_freezing_band * 30.0
    
    # 3. BLACK ICE CANDIDATE (20 points)
    #    - Freezing band + recent wet + RH >= 95% + dew point spread <= 1°C
    black_ice_candidate = freezing_band & recent_wet & (rh >= 95) & (dp_spread <= 1)
    score += black_ice_candidate * 20.0
    
    # 4. SNOW/MIX PRECIPITATION (10 points)
    is_snow_or_mix = ptype_hour.isin(["Snow", "Mix"])
    score += is_snow_or_mix * 10.0
    
    # 5. COMMUTE HOURS BOOST (10 points)
    #    - Morning: 05-08, Evening: 16-19
    is_commute = hour.isin([5, 6, 7, 8, 16, 17, 18, 19])
    score += is_commute * 10.0
```

### Risk Level Classification

```python
# Score to Level mapping:
if score >= 70: level = "high"
elif score >= 40: level = "medium"
else: level = "low"
```

### Risk Components Breakdown

| Component | Max Points | Conditions |
|-----------|------------|------------|
| Recent Wet | 30 | Any wet flag in last 3 hours |
| Freezing Band | 30 | -4°C ≤ T ≤ +1°C |
| Black Ice | 20 | All conditions met |
| Snow/Mix | 10 | Precipitation type |
| Commute Hours | 10 | Peak traffic times |
| **Maximum** | **100** | All conditions |

---

## 🔄 Data Processing Pipeline

### `pair_core.py` - Data Merging & Flagging

#### Build Merged Hourly Dataset

```python
def build_pair_hourly(lht_hourly, ws_hourly, wind_hourly=None):
    """
    Merges data from three sources into single hourly dataset.
    
    From LHT:
      - temp_C, rh_pct, dewpoint_C, dp_spread_C, vpd_kpa
    
    From WS100:
      - rain_mm_hour, ptype_hour
    
    From Wind:
      - wind_speed_kmh, wind_direction_deg, wind_gusts_kmh, surface_pressure_hpa
    
    Additional:
      - year, month, day, date, hour (time decomposition)
    """
```

#### Environment Flag Calculation

```python
def add_environment_flags(hourly_pair, thresholds=DEFAULT_THRESHOLDS):
    """
    Adds boolean flags to each hourly row:
    
    is_raining: Active precipitation detected
      = (rain > 0.2 mm/h) AND (ptype in [Rain, Mix, Snow])
    
    leaf_wetness: Surface wet from humidity alone
      = (RH >= 90%) AND (temp - dewpoint <= 2°C)
    
    wet_or_rain: ANY wet condition
      = is_raining OR leaf_wetness
    
    dry_enough_strict: Rural drying threshold
      = ALL of: no rain, RH<=75%, ΔT>=2°C, VPD>=0.6, wind>=2
    
    dry_enough_city: Urban drying threshold (more lenient)
      = ALL of: rain<=0.02, RH<=88%, ΔT>=1°C, VPD>=0.3, wind>=1
    """
```

---

## 🌐 Forecast Integration

### `openmeteo_fetcher.py` - Live Data Retrieval

```python
def fetch_openmeteo_jyvaskyla(forecast_days=10):
    """
    Fetches hourly forecast from Open-Meteo API.
    
    URL: https://api.open-meteo.com/v1/forecast
    Coordinates: 62.2415°N, 25.7209°E (Jyväskylä)
    Timezone: Europe/Helsinki
    
    Returns DataFrame with columns:
    - time, temperature_2m, relativehumidity_2m, dewpoint_2m
    - precipitation, rain, snowfall, weathercode
    - windspeed_10m, winddirection_10m, surface_pressure
    """
```

### `forecast_adapter.py` - Forecast Processing

#### Forecast to Pair Hourly Format

```python
def forecast_to_pair_hourly(forecast_df):
    """
    Converts Open-Meteo format to internal pair_hourly schema.
    
    Key transformations:
    1. Timezone handling → Europe/Helsinki
    2. Column mapping → internal names
    3. Derive dp_spread_C = temp_C - dewpoint_C
    4. Derive VPD
    5. Classify ptype_hour from rain/snow/temp:
       - Snow: snowfall > 0 AND temp <= -0.5°C
       - Rain: rain > 0 AND temp >= 1.0°C
       - Mix: (rain AND snow) OR temp in [-2, 1]°C
       - NoData: otherwise
    """
```

#### Complete Forecast Pipeline

```python
def build_forecast_events_with_drying(forecast_df):
    """
    Full pipeline for forecast data:
    
    1. forecast_to_pair_hourly() - Convert format
    2. add_environment_flags() - Add wet/dry flags
    3. detect_events() - Find precipitation events
    4. build_event_windows() - Create analysis windows
    5. compute_event_drying_times() - Estimate drying
    
    Returns list of event dicts with drying estimates.
    """
```

---

## 🖥️ Backend API Endpoints

### FastAPI Application (`app.py`)

#### LHT Endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /api/lht/list` | List all LHT sensor names |
| `GET /api/lht/sensor-summary` | Summary stats for one sensor |
| `GET /api/lht/network-summary` | All sensors vs network mean |
| `GET /api/lht/sensor-timeseries` | Time series aggregations |
| `GET /api/lht/sensor-daily-detail` | Hourly data for specific date |

#### WS100 Endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /api/ws100/list` | List all WS100 sensor names |
| `GET /api/ws100/sensor-summary` | Summary stats for one sensor |
| `GET /api/ws100/data` | Hourly rain data |
| `GET /api/ws100/dynamic-analysis` | Date range analysis |

#### Analysis Endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /api/analyze/pair-hourly` | Merged LHT+WS100+Wind with flags |
| `GET /api/analyze/pair-daily` | Single day analysis |
| `GET /api/analyze/event-aggregates` | Event windows, fractions, heatmap |

#### Road Forecast Endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /api/road-forecast/city` | City-level road forecast |
| `GET /api/forecast/summary` | 10-day forecast summary |

---

## 🎨 Frontend Application

### React Application Structure

```
frontend/src/
├── App.jsx              # Router configuration
├── pages/
│   ├── MapPage.jsx      # Sensor map overview
│   ├── LhtPage.jsx      # LHT sensor analysis
│   ├── Ws100Page.jsx    # WS100 sensor analysis
│   ├── AnalyzePage.jsx  # Event-based analysis
│   ├── RoadForecastPage.jsx  # Road safety forecast
│   └── StormSignaturesPage.jsx  # Storm pattern analysis
└── components/
    ├── charts/          # Visualization components
    │   ├── EnvironmentMeansChart.jsx
    │   ├── WetDryFractionsChart.jsx
    │   └── RhHeatmapChart.jsx
    └── ui/              # Reusable UI components
```

### Key Features

#### AnalyzePage.jsx - Event Analysis Dashboard

**Parameters Panel**:
- Date selector
- LHT sensor dropdown
- WS100 sensor dropdown
- Pre-event hours (default: 6)
- Post-event hours (default: 12)

**Visualizations**:
1. **Environment Means Chart** - 7 meteorological variables over time
   - RH, ΔT, VPD, Wind, Gusts, Direction, Pressure
   - Zoom/pan support
   - Event start annotation

2. **Wet/Dry Fractions Chart** - Stacked bar showing:
   - Wet fraction per hour
   - Dry fraction per hour

3. **RH Heatmap** - Hour × Date matrix showing humidity

4. **Data Table** - Detailed hourly values

#### RoadForecastPage.jsx - Road Safety Dashboard

**Summary Card**:
- Overall risk level (Low/Medium/High)
- Max slippery score (0-100)
- High-risk hours count (24h/72h)
- High-risk time windows

**24-Hour Ribbon**:
- Hour-by-hour risk chips
- Color-coded by risk level
- Highlights high-risk periods

**Event List**:
- Grouped by date
- Shows time range, precipitation type
- Displays estimated drying time

---

## 📊 Key Algorithms Summary

### 1. Wetness Detection
```
WET = (rain > 0.2 mm/h AND ptype ∈ {Rain, Mix, Snow})
      OR (RH ≥ 90% AND (T - Td) ≤ 2°C)
```

### 2. Drying Detection (City)
```
DRY = rain ≤ 0.02 mm/h
      AND RH ≤ 88%
      AND (T - Td) ≥ 1°C
      AND VPD ≥ 0.3 kPa
      AND wind ≥ 1 km/h
```

### 3. Black Ice Risk
```
BLACK_ICE_RISK = -4°C ≤ T ≤ 1°C
                 AND wet_in_last_3_hours
                 AND RH ≥ 95%
                 AND (T - Td) ≤ 1°C
```

### 4. Event Grouping
```
if gap_between_rainy_hours ≤ 4:
    same_event
else:
    new_event
```

---

## 🔑 Important Configuration Values

| Parameter | Value | Location |
|-----------|-------|----------|
| Rain threshold | 0.2 mm/h | `thresholds.py` |
| Max gap for event | 4 hours | `event_core.py` |
| Freezing band | -4°C to +1°C | `road_risk.py` |
| Black ice RH | ≥ 95% | `road_risk.py` |
| Commute hours | 05-08, 16-19 | `road_risk.py` |
| Jyväskylä coordinates | 62.2415°N, 25.7209°E | `openmeteo_fetcher.py` |
| Timezone | Europe/Helsinki | Multiple files |

---

## 🚀 Running the Project

### Backend
```bash
cd backend
python app.py
# Runs on http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

### API Documentation
FastAPI auto-generates docs at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## 📁 Data Files Location

| Data Type | Path |
|-----------|------|
| LHT Sensors | `cleaned_datasets/LHT/*.csv` |
| WS100 Sensors | `cleaned_datasets/wes100/df_*.csv` |
| Wind Data | `cleaned_datasets/cleaned_wind_data.csv` |
| Forecast Cache | `cleaned_datasets/jyvaskyla_weather_forecast.csv` |
| Raw Data | `Marjetas_Data/` |

---

## 🧪 Test Coverage

Located in `backend/tests/`:
- `test_drying_medians.py` - Drying time calculations
- `test_environment_flags.py` - Flag logic validation
- `test_event_aggregates_events.py` - Event detection
- `test_pair_wind_fields.py` - Data merging
- `test_threshold_impact.py` - Threshold sensitivity

---

## 💡 Key Design Decisions

1. **Two-tier drying thresholds** (Strict vs City) - Accounts for urban heat island effect

2. **4-hour gap tolerance for events** - Bridges brief dry spells that are part of same weather system

3. **3-hour lookback for wetness** - Roads stay slippery after rain stops

4. **Commute hour boost** - Higher impact during peak traffic

5. **Centralized thresholds** - Easy calibration in one file

6. **Timezone-aware processing** - All timestamps in Europe/Helsinki

---

## 📈 Future Extensibility

From README.md:
> - Parameterize thresholds via environment variables
> - Add endpoints exposing current thresholds
> - Incorporate solar radiation and surface temperature when available

---

*Report generated: December 2, 2025*
*Project: Marjetas Weather Analysis System for Jyväskylä, Finland*
