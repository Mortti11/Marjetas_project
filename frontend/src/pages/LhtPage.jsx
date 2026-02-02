import React, { useEffect, useState } from 'react';
import './Pages.css';
import '../styles/matrix-card.css';
import '../styles/lht-modern.css';
import { Thermometer, Droplets, Activity, Clock, Calendar, ChevronDown, Filter } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import FilterBar from '../components/ui/FilterBar';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../components/MetricCard.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const MetricCard = ({ icon: Icon, type, label, value, unit, subtext, period }) => (
  <div className="metric-card">
    <div className="metric-card-header">
      <div className={`metric-card-icon ${type}`}>
        <Icon size={24} strokeWidth={2.5} />
      </div>
    </div>
    <div className="metric-card-content">
      <div className="metric-card-label">{label}</div>
      <div className="metric-card-value">
        {value}<span className="metric-card-unit">{unit}</span>
      </div>
      <div className="metric-card-subtext">{subtext}</div>
      <div className="metric-card-period">Selected period: {period}</div>
    </div>
  </div>
);

export default function LhtPage() {
  const [sensors, setSensors] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Date selections
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedDay, setSelectedDay] = useState('all');

  // Derived view mode
  const [viewMode, setViewMode] = useState('year');

  // Data
  const [siteSummary, setSiteSummary] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [availableDays, setAvailableDays] = useState([]);

  // Network data
  const [networkData, setNetworkData] = useState(null);
  const [matrixTab, setMatrixTab] = useState('perLocation');

  // Fetch sensor list on mount
  useEffect(() => {
    async function fetchSensorList() {
      try {
        const res = await fetch('http://localhost:8000/api/lht/list');
        if (!res.ok) throw new Error('Failed to fetch sensor list');

        const data = await res.json();
        const sensorList = data.sensors || [];
        setSensors(sensorList);

        if (sensorList.length > 0) {
          const firstSensor = sensorList[0];
          setSelectedSensor(firstSensor);
          fetchInitialData(firstSensor);
        }
      } catch (err) {
        setError(err.message);
      }
    }

    async function fetchNetworkSummary() {
      try {
        const res = await fetch('http://localhost:8000/api/lht/network-summary');
        if (res.ok) {
          const data = await res.json();
          setNetworkData(data);
        }
      } catch (err) {
        console.error('Failed to fetch network summary:', err);
      }
    }

    fetchSensorList();
    fetchNetworkSummary();
  }, []);

  // Fetch initial data for sensor
  async function fetchInitialData(sensorName) {
    setLoading(true);
    try {
      const summaryRes = await fetch(
        `http://localhost:8000/api/lht/sensor-summary?sensor=${encodeURIComponent(sensorName)}`
      );
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSiteSummary(data);
      }

      const yearsRes = await fetch(
        `http://localhost:8000/api/lht/sensor-timeseries?sensor=${encodeURIComponent(sensorName)}&freq=M`
      );
      if (yearsRes.ok) {
        const data = await yearsRes.json();
        const years = [...new Set(data.data.map(d => d.timestamp.substring(0, 4)))].sort();
        setAvailableYears(years);
        if (years.length > 0) {
          const latestYear = parseInt(years[years.length - 1]);
          setSelectedYear(latestYear);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Derive view mode from selections
  useEffect(() => {
    if (selectedMonth === 'all') {
      setViewMode('year');
      setAvailableDays([]); // Clear days when in year view
    } else if (selectedDay === 'all') {
      setViewMode('month');
      // Days will be populated by fetchData()
    } else {
      setViewMode('day');
    }
  }, [selectedMonth, selectedDay]);

  // Fetch data when selections change
  useEffect(() => {
    if (selectedSensor && selectedYear) {
      fetchData();
    }
  }, [selectedSensor, selectedYear, selectedMonth, selectedDay, viewMode]);

  async function fetchData() {
    setChartLoading(true);
    try {
      // Fetch site_summary with current selections
      let summaryUrl = `http://localhost:8000/api/lht/sensor-summary?sensor=${encodeURIComponent(selectedSensor)}`;
      if (selectedYear) {
        summaryUrl += `&year=${selectedYear}`;
      }
      if (selectedMonth && selectedMonth !== 'all') {
        summaryUrl += `&month=${selectedMonth}`;
      }
      if (selectedDay && selectedDay !== 'all') {
        summaryUrl += `&day=${selectedDay}`;
      }

      const summaryRes = await fetch(summaryUrl);
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSiteSummary(summaryData);
      }

      // Fetch chart data based on view mode
      if (viewMode === 'year') {
        const res = await fetch(
          `http://localhost:8000/api/lht/sensor-timeseries?sensor=${encodeURIComponent(selectedSensor)}&year=${selectedYear}&freq=M`
        );
        if (res.ok) {
          const data = await res.json();
          setChartData({
            view: 'year',
            periodLabel: `${selectedYear} (all months)`,
            points: data.data.map(d => ({
              x: `${d.timestamp}-01`,
              label: new Date(d.timestamp + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
              tempMean: d.T_mean,
              vpdMean: d.VPD_mean,
              rh90Share: d.RH90_pct
            }))
          });
        }
      } else if (viewMode === 'month') {
        const url = `http://localhost:8000/api/lht/sensor-timeseries?sensor=${encodeURIComponent(selectedSensor)}&year=${selectedYear}&freq=D`;
        console.log('[LHT Debug] Month view - fetching URL:', url);
        console.log('[LHT Debug] Month view - viewMode:', viewMode, 'selectedMonth:', selectedMonth, 'type:', typeof selectedMonth);
        const res = await fetch(url);
        console.log('[LHT Debug] Month view - fetch response:', res.ok);
        if (res.ok) {
          const data = await res.json();
          console.log('[LHT Debug] Month view - total data points:', data.data?.length);
          const monthNum = parseInt(selectedMonth);
          console.log('[LHT Debug] Month view - filtering for month:', monthNum);
          const filtered = data.data.filter(d => {
            const month = parseInt(d.timestamp.split('-')[1]);
            return month === monthNum;
          });
          console.log('[LHT Debug] Month view - filtered data points:', filtered.length);

          const days = filtered.map(d => parseInt(d.timestamp.split('-')[2])).sort((a, b) => a - b);
          console.log('[LHT Debug] Month view - available days:', days);
          setAvailableDays(days);

          setChartData({
            view: 'month',
            periodLabel: `${MONTH_NAMES[monthNum - 1]} ${selectedYear}`,
            points: filtered.map(d => ({
              x: d.timestamp,
              label: d.timestamp,
              tempMean: d.T_mean,
              vpdMean: d.VPD_mean,
              rh90Share: d.RH90_pct
            }))
          });
        } else {
          console.log('[LHT Debug] Month view - fetch failed');
          setAvailableDays([]); // Clear days if fetch fails
        }
      } else if (viewMode === 'day') {
        const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
        const res = await fetch(
          `http://localhost:8000/api/lht/sensor-daily-detail?sensor=${encodeURIComponent(selectedSensor)}&date=${dateStr}`
        );
        if (res.ok) {
          const data = await res.json();
          setChartData({
            view: 'day',
            periodLabel: dateStr,
            points: data.hourly_data.map(d => ({
              x: d.hour,
              label: `${d.hour}:00`,
              tempMean: d.Temperature_C,
              vpdMean: d.VPD_kPa,
              rh90Share: d.Humidity >= 90 ? 100 : 0
            }))
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setChartLoading(false);
    }
  }

  function handleSensorChange(e) {
    const newSensor = e.target.value;
    setSelectedSensor(newSensor);
    setSelectedYear(null);
    setSelectedMonth('all');
    setSelectedDay('all');
    fetchInitialData(newSensor);
  }

  function handleYearChange(e) {
    const year = e.target.value ? parseInt(e.target.value) : null;
    setSelectedYear(year);
    setSelectedMonth('all');
    setSelectedDay('all');
    setAvailableDays([]); // Clear days when changing year
  }

  function handleMonthChange(e) {
    const month = e.target.value;
    setSelectedMonth(month);
    setSelectedDay('all');
    // Always clear days when month changes - they'll be repopulated by fetchData()
    setAvailableDays([]);
  }

  function handleDayChange(e) {
    setSelectedDay(e.target.value);
  }

  const num = (v, d = 2) => (v == null || isNaN(v) ? '—' : Number(v).toFixed(d));

  // Format delta with sign but keep original numeric formatting rules
  const formatDelta = (v, d = 1) => {
    if (v == null || isNaN(v)) return '—';
    const n = Number(v);
    return (n > 0 ? '+' : '') + Number(n).toFixed(d);
  };

  const getDeltaClass = (value) => {
    if (value === null || value === undefined) return '';
    const n = Number(value);
    if (Number.isNaN(n)) return '';
    if (n >= 2) return 'delta-strong-positive';
    if (n > 0) return 'delta-positive';
    if (n <= -2) return 'delta-strong-negative';
    if (n < 0) return 'delta-negative';
    return 'delta-neutral';
  };
  function getCardValue(metric) {
    if (!siteSummary) return '—';

    // Use T_mean and RH_mean for all views, as siteSummary is already filtered
    // by the backend to the correct period (year, month, or day).
    if (metric === 'temp') return num(siteSummary.T_mean, 1);
    if (metric === 'humidity') return num(siteSummary.RH_mean, 0);
    if (metric === 'vpd') return num(siteSummary.VPD_peak_smooth, 2);
    if (metric === 'rh90') return num(siteSummary['%RH>=90'], 1);

    return '—';
  }

  function getPeriodLabel() {
    if (viewMode === 'day') {
      return `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    }
    if (viewMode === 'month') {
      return `${MONTH_NAMES[parseInt(selectedMonth) - 1]} ${selectedYear}`;
    }
    return `${selectedYear}`;
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const displayLabel = chartData?.view === 'year'
        ? payload[0]?.payload?.label
        : label;

      return (
        <div className="lht-custom-tooltip">
          <p className="lht-tooltip-label">{displayLabel}</p>
          {payload.map((entry, index) => (
            <div key={index} className="lht-tooltip-item">
              <div className="lht-tooltip-color" style={{ backgroundColor: entry.color }}></div>
              <span className="lht-tooltip-name">{entry.name}:</span>
              <span className="lht-tooltip-value">{entry.value.toFixed(2)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="page lht-page">
      <PageHeader
        title="LHT Sensor Analysis"
        description="Advanced environmental monitoring with temperature, humidity, and VPD metrics"
        rightContent={
          <span className="status-pill" title="System status">Active</span>
        }
      />

      <FilterBar>
        <div className="filter-group">
          <label htmlFor="lht-sensor-select">Sensor</label>
          <select
            id="lht-sensor-select"
            value={selectedSensor}
            onChange={handleSensorChange}
            disabled={sensors.length === 0}
          >
            {sensors.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </FilterBar>

      {loading && <div className="page-loading">Loading summary...</div>}
      {error && !loading && <div className="page-error">Error: {error}</div>}

      {siteSummary && !loading && !error && (
        <>
          <div className="lht-kpi-grid">
            <MetricCard
              icon={Thermometer}
              type="temp"
              label="Temperature"
              value={getCardValue('temp')}
              unit="°C"
              subtext={
                <>
                  Min {num(siteSummary.T_min, 1)}°C • Max {num(siteSummary.T_max, 1)}°C
                  {viewMode === 'day' && <><br />DTR median: {num(siteSummary.DTR_median, 1)}°C</>}
                </>
              }
              period={getPeriodLabel()}
            />

            <MetricCard
              icon={Droplets}
              type="humidity"
              label="Humidity"
              value={getCardValue('humidity')}
              unit="%"
              subtext={
                <>
                  Min {num(siteSummary.RH_min, 0)}% • Max {num(siteSummary.RH_max, 0)}%
                  {viewMode === 'day' && (
                    <><br />%RH≥90: {num(siteSummary['%RH>=90'], 1)}% • %RH≤30: {num(siteSummary['%RH<=30'], 1)}%</>
                  )}
                </>
              }
              period={getPeriodLabel()}
            />

            <MetricCard
              icon={Activity}
              type="vpd"
              label="VPD Peak"
              value={getCardValue('vpd')}
              unit=" kPa"
              subtext={
                <>Mean peak: {num(siteSummary.VPD_peak_mean, 2)} kPa</>
              }
              period={getPeriodLabel()}
            />

            <MetricCard
              icon={Clock}
              type="rh90"
              label="Time with RH≥90%"
              value={getCardValue('rh90')}
              unit="%"
              subtext={
                <>
                  Data points: {siteSummary.rows?.toLocaleString() || '—'}
                  <br />Step: {siteSummary.step_min || '—'} min
                </>
              }
              period={getPeriodLabel()}
            />
          </div>

          <div className="lht-date-controls-container">
            <div className="lht-date-controls-label">
              <span>YEAR</span>
              <span>MONTH</span>
              <span>DAY</span>
            </div>
            <div className="lht-date-controls-row">
              <div className="lht-date-control">
                <select
                  className="lht-date-select"
                  value={selectedYear || ''}
                  onChange={handleYearChange}
                >
                  <option value="">Select year</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div className="lht-date-control">
                <select
                  className="lht-date-select"
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  disabled={!selectedYear}
                >
                  <option value="all">All months</option>
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="lht-date-control">
                <select
                  className="lht-date-select"
                  value={selectedDay}
                  onChange={handleDayChange}
                  disabled={selectedMonth === 'all'}
                >
                  <option value="all">All days</option>
                  {(() => {
                    console.log('[LHT Debug] Rendering day dropdown - availableDays:', availableDays, 'selectedMonth:', selectedMonth);
                    return availableDays.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ));
                  })()}
                </select>
              </div>
            </div>
          </div>

          {selectedYear && chartData && (
            <div className="lht-chart-container">
              <div className="lht-chart-header">
                <h3 className="lht-chart-title">
                  {viewMode === 'day' ? '24-Hour Profile' : 'Temperature, humidity and VPD'}
                </h3>
                <p className="lht-chart-subtitle">
                  {selectedSensor} — {chartData.periodLabel}
                </p>
              </div>

              <div className="lht-chart-wrapper">
                {chartLoading ? (
                  <div className="lht-chart-loading">Loading chart data...</div>
                ) : chartData.points.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData.points}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey={viewMode === 'year' ? 'label' : viewMode === 'day' ? 'label' : 'x'}
                        stroke="#64748b"
                        angle={viewMode !== 'day' ? -30 : 0}
                        textAnchor={viewMode !== 'day' ? 'end' : 'middle'}
                        height={viewMode !== 'day' ? 70 : 50}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis yAxisId="left" stroke="#ef4444" />
                      <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="tempMean"
                        stroke="#ef4444"
                        strokeWidth={2.5}
                        dot={{ r: 5 }}
                        name="Temp Mean (°C)"
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="vpdMean"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        dot={{ r: 5 }}
                        name="VPD Mean (kPa)"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="rh90Share"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        dot={{ r: 5 }}
                        name="%RH≥90"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="lht-chart-empty">
                    <div className="lht-chart-empty-icon">📊</div>
                    <div>No data available for selected period</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {networkData && networkData.per_location && networkData.per_location.length > 0 && (
            <div className="ws100-matrix-card" style={{ marginTop: '32px' }}>
              <div className="matrix-card-header">
                <h3>LHT Sensor Network Summary — Temperature & Humidity Matrix</h3>
                <p className="matrix-subtitle">
                  Compare all LHT sensors across the network
                </p>
              </div>

              <div className="matrix-tab-control" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={matrixTab === 'perLocation'}
                  onClick={() => setMatrixTab('perLocation')}
                  className={`matrix-tab-button ${matrixTab === 'perLocation' ? 'matrix-tab-button--active' : ''}`}
                >
                  Per location
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={matrixTab === 'vsMean'}
                  onClick={() => setMatrixTab('vsMean')}
                  className={`matrix-tab-button ${matrixTab === 'vsMean' ? 'matrix-tab-button--active' : ''}`}
                >
                  Vs network mean
                </button>
              </div>

              <div className="matrix-table-wrapper lht-summary-table-wrapper">
                {matrixTab === 'perLocation' && (
                  <table className="matrix-table lht-summary-table">
                    <thead>
                      <tr>
                        <th>Station</th>
                        <th className="text-right">T mean (°C)</th>
                        <th className="text-right">RH mean (%)</th>
                        <th className="text-right">VPD peak (kPa)</th>
                        <th className="text-right">DTR (°C)</th>
                        <th className="text-right">Temp last 24 h (°C)</th>
                        <th className="text-right">RH last 24 h (%)</th>
                        <th className="text-right">%RH ≥ 90</th>
                        <th className="text-right">%RH ≤ 30</th>
                      </tr>
                    </thead>
                    <tbody>
                      {networkData.per_location.map((row, i) => (
                        <tr key={row.station} className={i % 2 === 0 ? 'even' : 'odd'}>
                          <td className="station-name">{row.station}</td>
                          <td className="text-right">{num(row.T_mean, 1)}</td>
                          <td className="text-right">{num(row.RH_mean, 1)}</td>
                          <td className="text-right">{num(row.VPD_peak_mean ?? row.VPD_peak_smooth ?? row.VPD_peak, 2)}</td>
                          <td className="text-right">{num(row.DTR_median, 1)}</td>
                          <td className="text-right">{num(row.Temperature_24H ?? row.Temperature_24h ?? row.temperature_24h, 1)}</td>
                          <td className="text-right">{num(row.Humidity_24H ?? row.Humidity_24h ?? row.humidity_24h, 1)}</td>
                          <td className="text-right">{num(row.pct_RH90 ?? row['%RH>=90'] ?? row.RH90_pct, 1)}</td>
                          <td className="text-right">{num(row.pct_RH30 ?? row['%RH<=30'] ?? row.RH30_pct, 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {matrixTab === 'vsMean' && (
                  <>
                    <p className="matrix-note">Positive = sensor above network mean, negative = below network mean.</p>
                    <table className="matrix-table lht-summary-table">
                      <thead>
                        <tr>
                          <th>Station</th>
                          <th className="text-right">ΔT mean (°C)</th>
                          <th className="text-right">ΔRH mean (%)</th>
                          <th className="text-right">ΔVPD peak (kPa)</th>
                          <th className="text-right">ΔDTR (°C)</th>
                          <th className="text-right">ΔTemp last 24 h (°C)</th>
                          <th className="text-right">ΔRH last 24 h (%)</th>
                          <th className="text-right">Δ%RH ≥ 90</th>
                          <th className="text-right">Δ%RH ≤ 30</th>
                        </tr>
                      </thead>
                      <tbody>
                        {networkData.vs_network_mean
                          .sort((a, b) => (b.T_mean || 0) - (a.T_mean || 0))
                          .map((row, i) => {
                            const cols = [
                              { key: 'T_mean', isDelta: true, digits: 1 },
                              { key: 'RH_mean', isDelta: true, digits: 1 },
                              { key: 'VPD_peak_mean', isDelta: true, digits: 2, altKeys: ['VPD_peak_smooth', 'VPD_peak'] },
                              { key: 'DTR_median', isDelta: true, digits: 1 },
                              { key: 'Temperature_24H', isDelta: true, digits: 1, altKeys: ['Temperature_24h', 'temperature_24h'] },
                              { key: 'Humidity_24H', isDelta: true, digits: 1, altKeys: ['Humidity_24h', 'humidity_24h'] },
                              { key: 'pct_RH90', isDelta: true, digits: 1, altKeys: ['%RH>=90', 'RH90_pct'] },
                              { key: 'pct_RH30', isDelta: true, digits: 1, altKeys: ['%RH<=30', 'RH30_pct'] },
                            ];

                            return (
                              <tr key={row.station} className={i % 2 === 0 ? 'even' : 'odd'}>
                                <td className="lht-station-cell">{row.station}</td>
                                {cols.map((col) => {
                                  // resolve value with fallback keys
                                  let cellValue = row[col.key];
                                  if ((cellValue === undefined || cellValue === null) && col.altKeys) {
                                    for (const k of col.altKeys) {
                                      if (row[k] !== undefined) {
                                        cellValue = row[k];
                                        break;
                                      }
                                    }
                                  }

                                  return (
                                    <td
                                      key={col.key}
                                      className={`lht-delta-cell ${col.isDelta ? getDeltaClass(cellValue) : ''}`}
                                    >
                                      {col.isDelta ? formatDelta(cellValue, col.digits) : num(cellValue, col.digits)}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
