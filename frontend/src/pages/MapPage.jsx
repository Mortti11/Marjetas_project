import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SensorMap from '../components/SensorMap';
import { Thermometer, Droplets, CloudRain, RadioTower, AlertTriangle } from 'lucide-react';
import './Pages.css';

export default function MapPage() {
  const [sensors, setSensors] = useState([]);
  const [lhtData, setLhtData] = useState(null);
  const [ws100Data, setWs100Data] = useState(null); // raw WS100 summary
  const [windData, setWindData] = useState(null);
  const [forecastSummary, setForecastSummary] = useState(null);
  const [roadForecast, setRoadForecast] = useState(null);
  const [roadLoading, setRoadLoading] = useState(false);
  const [roadError, setRoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Independent visibility toggles for each layer
  const [visibleLayers, setVisibleLayers] = useState({
    LHT: true,
    WS100: true,
    AIRPORT: true,
  });

  const toggleLayer = (key) => {
    setVisibleLayers(v => ({ ...v, [key]: !v[key] }));
  };

  const navigate = useNavigate();

  const useForecast = forecastSummary && forecastSummary.has_data;

  useEffect(() => {
    // Fetch wind data from local CSV
    const fetchWindData = async () => {
      try {
        const response = await fetch('/cleaned_datasets/cleaned_wind_data.csv');
        const text = await response.text();
        const lines = text.split('\n');

        // Parse the most recent row (skip header, get second line)
        if (lines.length > 1) {
          const lastData = lines[1].split(',');
          return {
            wind_speed_10m: parseFloat(lastData[1]) || 0,
            wind_direction_10m: parseFloat(lastData[2]) || 0,
            wind_gusts_10m: parseFloat(lastData[3]) || 0,
          };
        }
      } catch (err) {
        console.warn('Could not load wind data:', err);
      }
      return { wind_speed_10m: 0, wind_direction_10m: 0, wind_gusts_10m: 0 };
    };

    Promise.all([
      fetch('http://localhost:8000/api/sensors').then(r => r.json()),
      fetch('http://localhost:8000/api/lht/demo-summary').then(r => r.json()),
      fetch('http://localhost:8000/api/ws100/demo-summary').then(r => r.json()),
      fetch('/api/forecast/summary').then(r => r.ok ? r.json() : null).catch(() => null),
      fetchWindData(),
    ])
      .then(([sensorsData, lht, ws100, forecast, wind]) => {
        setSensors(sensorsData);
        setLhtData(lht);
        setWs100Data(ws100);
        setForecastSummary(forecast);
        setWindData(wind);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });

    // Fetch road forecast
    setRoadLoading(true);
    setRoadError(null);

    fetch('/api/road-forecast/city?forecast_days=3')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Road forecast error'))))
      .then((data) => {
        setRoadForecast(data);
      })
      .catch((err) => {
        console.error('Road forecast fetch failed', err);
        setRoadError('Road forecast unavailable');
      })
      .finally(() => setRoadLoading(false));
  }, []);

  // Auto-refresh forecast every 30 minutes so current-hour values stay up-to-date
  useEffect(() => {
    const id = setInterval(() => {
      fetch('/api/forecast/summary')
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (data) setForecastSummary(data);
        })
        .catch(() => { });
    }, 30 * 60 * 1000);

    return () => clearInterval(id);
  }, []);

  // Dedicated fetch for forecast summary on mount (keeps logic explicit)
  useEffect(() => {
    fetch('/api/forecast/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setForecastSummary(data);
      })
      .catch(() => { });
  }, []);

  // Log forecast usage for debugging in browser console
  // useEffect(() => {
  //   console.log('Overview KPI', { forecastSummary, useForecast });
  // }, [forecastSummary, useForecast]);

  if (loading) return <div className="flex items-center justify-center min-h-[400px] text-slate-500">Loading overview...</div>;
  if (error) return <div className="flex items-center justify-center min-h-[400px] text-red-600">Error: {error}</div>;

  const activeSensorCount = sensors.length;
  const wsSummary = ws100Data ? {
    mm_total: ws100Data.rain_total_mm,
    rainy_hours: ws100Data.rain_hours,
  } : null;
  const lastUpdatedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const conditions = (lhtData?.['%RH>=90'] || 0) > 30 ? 'Wet & humid' : 'Normal conditions';

  // Derive metric aliases (do not recalc beyond existing data)
  const avgTemp = lhtData?.T_mean;
  const tempMin = lhtData?.T_min;
  const tempMax = lhtData?.T_max;
  const avgHumidity = lhtData?.RH_mean;
  const highHumidityPct = lhtData?.pct_RH90 ?? lhtData?.['%RH>=90'];
  const totalRainMm = wsSummary?.mm_total;
  const rainyHours = wsSummary?.rainy_hours;

  const safeFixed = (val, digits) => (typeof val === 'number' ? val.toFixed(digits) : '—');

  // prefer flat fields provided by the backend for current hour
  const current_temp = useForecast ? forecastSummary.current_temp : null;
  const current_rh = useForecast ? forecastSummary.current_rh : null;
  const summary10d = useForecast ? (forecastSummary.summary_10d ?? null) : null;

  const num = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : null);
  const fmt1 = (v) => (num(v) !== null ? num(v).toFixed(1) : '—');
  const fmt0 = (v) => (num(v) !== null ? num(v).toFixed(0) : '—');

  // Road forecast helpers
  const roadStats = roadForecast?.stats ?? null;

  const maxScore24h = roadStats?.max_slippery_score_24h ?? null;
  const highRisk24h = roadStats?.high_risk_hours_24h ?? 0;
  const highRisk72h = roadStats?.high_risk_hours_72h ?? 0;

  // derive overall risk level from max score
  let overallRiskLevel = 'low';
  if (maxScore24h >= 80) overallRiskLevel = 'high';
  else if (maxScore24h >= 40) overallRiskLevel = 'medium';

  // derive risk label
  const overallRiskLabel = overallRiskLevel === 'high' ? 'High risk' : overallRiskLevel === 'medium' ? 'Medium risk' : 'Low risk';

  return (
    <main className="overview-page">
      <header className="page-header">
        <div>
          <h1>Overview</h1>
          <p className="page-subtitle">Live conditions and 10-day forecast for Jyväskylä.</p>
        </div>
        <div className="page-header-chips">
          <span className="chip chip--neutral">Next 10 days</span>
        </div>
      </header>

      {/* KPI Section - primary 3 cards */}
      <section className="overview-kpis">
        <div className="kpi-card kpi-card--temp">
          <div className="kpi-card-header">
            <div className="kpi-icon-badge">
              <Thermometer size={18} strokeWidth={2} />
            </div>
            <div className="kpi-header-text">
              <div className="kpi-label">Current temperature</div>
            </div>
          </div>

          <div className="kpi-value-row">
            <span className="kpi-value">
              {useForecast ? `${fmt1(current_temp)}°C` : `${safeFixed(avgTemp, 1)}°C`}
            </span>
          </div>

          <div className="kpi-subtext">
            {useForecast && summary10d
              ? `Next 10 days: avg ${fmt1(summary10d.avg_temp)}°C, range ${fmt1(summary10d.min_temp)}–${fmt1(summary10d.max_temp)}°C`
              : `Range ${safeFixed(tempMin, 1)}–${safeFixed(tempMax, 1)}°C`}
          </div>
        </div>

        <div className="kpi-card kpi-card--humidity">
          <div className="kpi-card-header">
            <div className="kpi-icon-badge">
              <Droplets size={18} strokeWidth={2} />
            </div>
            <div className="kpi-header-text">
              <div className="kpi-label">Current humidity</div>
            </div>
          </div>

          <div className="kpi-value-row">
            <span className="kpi-value">{useForecast ? `${fmt0(current_rh)}%` : `${safeFixed(avgHumidity, 0)}%`}</span>
          </div>

          <div className="kpi-subtext">
            {useForecast && summary10d
              ? `High humidity (≥90%): ${fmt1(summary10d.high_rh_pct)}% of hours`
              : `High humidity: ${safeFixed(highHumidityPct, 1)}% of time`}
          </div>
        </div>

        <div className="kpi-card kpi-card--rain">
          <div className="kpi-card-header">
            <div className="kpi-icon-badge">
              <CloudRain size={18} strokeWidth={2} />
            </div>
            <div className="kpi-header-text">
              <div className="kpi-label">Total precipitation (next 10 days)</div>
            </div>
          </div>

          <div className="kpi-value-row">
            <span className="kpi-value">
              {useForecast && summary10d ? `${fmt1(summary10d.total_rain_mm)} mm` : `${safeFixed(totalRainMm, 1)} mm`}
            </span>
          </div>

          <div className="kpi-subtext">{useForecast && summary10d ? `Rainy hours: ${summary10d.rainy_hours ?? "—"}` : (typeof rainyHours === "number" ? `${rainyHours} rainy hours` : "—")}</div>
          {useForecast && summary10d && num(summary10d.total_snow_mm) !== null && num(summary10d.total_snow_mm) > 0.1 && (
            <div className="kpi-subtext">{`Snowfall: ${fmt1(summary10d.total_snow_mm)} mm`}</div>
          )}
        </div>

        {/* Road conditions block */}
        <section className="overview-road-block">
          <div className="overview-road-card-column">
            <div className="kpi-card kpi-card--road" onClick={() => navigate('/road-forecast')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/road-forecast')}>
              <div className="kpi-card-header">
                <div className="kpi-icon-badge">
                  <AlertTriangle size={18} strokeWidth={2} />
                </div>
                <div className="kpi-header-text">
                  <div className="kpi-label">Road slipperiness (next 24–72 h)</div>
                </div>
              </div>

              <div className="kpi-value-row">
                <span className={`road-risk-pill road-risk-pill--${overallRiskLevel}`}>
                  {overallRiskLabel}
                </span>
              </div>

              <div className="kpi-subtext">
                Max score (24 h): {maxScore24h}/100
              </div>
              <div className="kpi-subtext">
                {highRisk24h} high-risk hours in next 24 h · {highRisk72h} in 72 h
              </div>
            </div>
          </div>


        </section>
      </section>

      {/* Map Panel */}
      <section className="card card--map">
        <div className="card-header">
          <div>
            <h2>Sensor network map</h2>
            <p className="card-subtitle">Locations of LHT and WS100 sensors across Jyväskylä.</p>
          </div>
          <div className="map-toggle-chips">
            {['LHT', 'WS100', 'AIRPORT'].map(layer => (
              <button
                key={layer}
                type="button"
                onClick={() => toggleLayer(layer)}
                className={`chip ${visibleLayers[layer] ? 'chip--active' : 'chip--muted'}`}
                aria-pressed={visibleLayers[layer]}
              >
                {layer}
              </button>
            ))}
          </div>
        </div>

        <div className="card-body map-container">
          <SensorMap windData={windData} visibleLayers={visibleLayers} />
        </div>
      </section>

      {/* Distance Matrix has been moved to the Analyze page */}
    </main>
  );
}
