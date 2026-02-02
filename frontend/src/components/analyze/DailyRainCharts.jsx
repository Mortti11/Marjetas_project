import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
  BarChart,
  LineChart
} from 'recharts';

/**
 * DailyRainCharts
 * Professional daily analysis visualization bundle (main multi-series chart + cumulative rain + wet/dry band).
 * Props:
 *  - hourlyData: array of hourly records (same shape as analysisData.hourly)
 *  - selectedDate: YYYY-MM-DD string
 *  - lhtName / ws100Name: sensor display names
 */
export default function DailyRainCharts({ hourlyData = [], selectedDate, lhtName, ws100Name }) {
  const safeHours = Array.isArray(hourlyData) ? hourlyData : [];

  // Utility: convert timestamp to HH:MM label
  function formatToHour(ts) {
    try {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(11,16); // HH:MM
      }
      // Fallback: attempt splitting 'YYYY-MM-DD HH:MM'
      if (typeof ts === 'string' && ts.includes(' ')) return ts.split(' ')[1].slice(0,5);
      return String(ts).slice(-5);
    } catch {
      return String(ts).slice(-5);
    }
  }

  const mainChartData = useMemo(() => safeHours.map(row => ({
    timeLabel: formatToHour(row.timestamp),
    temp: typeof row.temp_C === 'number' ? row.temp_C : null,
    humidity: typeof row.rh_pct === 'number' ? row.rh_pct : null,
    rain: typeof row.rain_mm_hour === 'number' ? row.rain_mm_hour : 0,
    wetCity: !!(row.wet_city ?? row.wet_or_rain),
    wetStrict: !!(row.wet_strict)
  })), [safeHours]);

  const cumulativeData = useMemo(() => {
    let running = 0;
    return safeHours.map(row => {
      running += (typeof row.rain_mm_hour === 'number' ? row.rain_mm_hour : 0);
      return {
        timeLabel: formatToHour(row.timestamp),
        cumulativeRain: running
      };
    });
  }, [safeHours]);

  const wetBandData = useMemo(() => safeHours.map(row => ({
    timeLabel: formatToHour(row.timestamp),
    wetCity: (row.wet_city ?? row.wet_or_rain) ? 1 : 0,
    wetStrict: row.wet_strict ? 1 : 0
  })), [safeHours]);

  const windData = useMemo(() => safeHours.map(row => ({
    timeLabel: formatToHour(row.timestamp),
    windSpeed: typeof row.wind_speed_kmh === 'number' ? row.wind_speed_kmh : null,
    windGusts: typeof row.wind_gusts_kmh === 'number' ? row.wind_gusts_kmh : null
  })), [safeHours]);

  const hasData = mainChartData.length > 0;
  const hasWind = windData.some(d => d.windSpeed != null || d.windGusts != null);

  return (
    <div className="daily-charts-grid" aria-label="Daily weather charts">
      {/* Main multi-series chart */}
      <div className="chart-card main-chart" role="group" aria-label="Temperature humidity and rain chart">
        <div className="chart-card-header">
          <h3 className="chart-card-title">Temperature, Humidity & Rain by Hour</h3>
          <p className="chart-card-subtitle">{selectedDate} · {lhtName} & {ws100Name}</p>
        </div>
        <div className="chart-card-body">
          {hasData ? (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={mainChartData} margin={{ top: 8, right: 24, bottom: 16, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="timeLabel" tick={{ fontSize: 12, fill: '#6B7280' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#6B7280' }} stroke="#9CA3AF" domain={['auto','auto']} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#6B7280' }} stroke="#9CA3AF" />
                <Tooltip contentStyle={{ backgroundColor:'#111827', color:'#F9FAFB', borderRadius:12 }} labelStyle={{ fontSize:12 }} />
                <Legend />
                <Bar yAxisId="right" dataKey="rain" name="Rain (mm/h)" barSize={14} radius={[4,4,0,0]} fill="#38BDF8" />
                <Line yAxisId="left" type="monotone" dataKey="temp" name="Temperature (°C)" stroke="#F97316" strokeWidth={2} dot={false} activeDot={{ r:5 }} />
                <Line yAxisId="left" type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#2563EB" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty" aria-label="No hourly data">No hourly data loaded.</div>
          )}
        </div>
      </div>

      {/* Wind & Gusts Chart */}
      <div className="chart-card" role="group" aria-label="Wind and gusts chart">
        <div className="chart-card-header">
          <h3 className="chart-card-title">Wind & Gusts</h3>
        </div>
        <div className="chart-card-body">
          {hasWind ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={windData} margin={{ top: 8, right: 24, bottom: 16, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="timeLabel" tick={{ fontSize: 12, fill: '#6B7280' }} />
                <YAxis unit=" km/h" tick={{ fontSize: 12, fill: '#6B7280' }} stroke="#9CA3AF" />
                <Tooltip contentStyle={{ backgroundColor:'#111827', color:'#F9FAFB', borderRadius:12 }} labelStyle={{ fontSize:12 }} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="windSpeed"
                  name="Wind Speed"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="windGusts"
                  name="Gusts"
                  stroke="#059669"
                  strokeWidth={1.6}
                  strokeDasharray="4 2"
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty" aria-label="No wind data">No wind data for this date.</div>
          )}
        </div>
      </div>

      {/* Cumulative Rain */}
      <div className="chart-card small-chart" role="group" aria-label="Cumulative rain chart">
        <div className="chart-card-header">
          <h3 className="chart-card-title">Cumulative Rain</h3>
        </div>
        <div className="chart-card-body">
          {hasData ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={cumulativeData} margin={{ top:8,right:24,bottom:0,left:0 }}>
                <XAxis dataKey="timeLabel" tick={{ fontSize:11, fill:'#6B7280' }} />
                <YAxis tick={{ fontSize:11, fill:'#6B7280' }} />
                <Tooltip contentStyle={{ backgroundColor:'#111827', color:'#F9FAFB', borderRadius:12 }} />
                <defs>
                  <linearGradient id="rainGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="cumulativeRain" name="Cumulative rain (mm)" stroke="#0EA5E9" strokeWidth={2} fill="url(#rainGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">No rain data.</div>
          )}
        </div>
      </div>

      {/* Wet/Dry band */}
      <div className="chart-card band-chart" role="group" aria-label="Wet dry band chart">
        <div className="chart-card-header">
          <h3 className="chart-card-title">Wet vs Dry Hours (City / Strict)</h3>
        </div>
        <div className="chart-card-body">
          {hasData ? (
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={wetBandData} margin={{ top:4,right:24,bottom:0,left:0 }}>
                <XAxis dataKey="timeLabel" tick={{ fontSize:10, fill:'#6B7280' }} interval={safeHours.length > 32 ? 2 : 0} />
                <Tooltip formatter={(v) => (v ? 'Wet' : 'Dry')} labelStyle={{ fontSize:11 }} contentStyle={{ backgroundColor:'#111827', color:'#F9FAFB', borderRadius:10 }} />
                <Bar dataKey="wetCity" name="City wet" stackId="a" fill="#22C55E" radius={[4,4,0,0]} />
                <Bar dataKey="wetStrict" name="Strict wet" stackId="a" fill="#16A34A" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">No wet/dry flag data.</div>
          )}
        </div>
      </div>
    </div>
  );
}
