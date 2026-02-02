// src/components/charts/RhHeatmapChart.jsx
// Horizontal heatmap bar for hourly RH
import React, { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

/**
 * @typedef {Object} RhTile
 * @property {number} hour_local // 0..23
 * @property {number} rh_pct     // 0..100
 */
/** @typedef {{ data: RhTile[] }} RhHeatmapChartProps */

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function rhColor(rh) {
  if (rh == null) return "#E0F2FE";
  const t = Math.max(0, Math.min(1, (rh - 40) / 60)); // 40..100 → 0..1
  const low = [224, 242, 254], high = [29, 78, 216];
  const rgb = low.map((c, i) => Math.round(c + (high[i] - c) * t));
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

export default function RhHeatmapChart({ data }) {
  const labels = useMemo(() => data.map((d) => `${d.hour_local}:00`), [data]);
  const values = useMemo(() => data.map((d) => d.rh_pct ?? 0), [data]);
  const colors  = useMemo(() => values.map((v) => rhColor(v)), [values]);

  const datasets = [{
    label: "RH (%)",
    data: values,
    backgroundColor: colors,
    borderRadius: 6,
    barPercentage: 1.0,
    categoryPercentage: 1.0,
    hoverBackgroundColor: "#38BDF8",
  }];

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.label} – RH ${ctx.parsed.y.toFixed(0)}%`,
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: "Hour of day", font: { size: 12 }, color: "#64748b" },
        grid: { color: "#E5E7EB" },
        ticks: { callback: (v, i) => (i % 3 === 0 ? labels[i] : "") },
      },
      y: { display: false, min: 0, max: 100 },
    },
    animation: { duration: 400, easing: "easeOutQuart" },
  };

  return (
    <div style={{ height: 140, background: "#fff", borderRadius: 20, boxShadow: "0 18px 45px rgba(15,23,42,0.12)", border: "1px solid #E5E7EB", padding: 24 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: "1.1rem", color: "#0f172a" }}>RH Heatmap</div>
        <div style={{ fontSize: "0.95rem", color: "#64748b" }}>Hourly relative humidity on the event day</div>
      </div>
      <Bar data={{ labels, datasets }} options={options} />
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 150, height: 10, background: "linear-gradient(90deg,#E0F2FE,#38BDF8,#1D4ED8)", borderRadius: 5 }} />
        <span style={{ fontSize: 12, color: "#64748b" }}>drier</span>
        <span style={{ fontSize: 12, color: "#64748b", marginLeft: "auto" }}>more humid</span>
      </div>
    </div>
  );
}
