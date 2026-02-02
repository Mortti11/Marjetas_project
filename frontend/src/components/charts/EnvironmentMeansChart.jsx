// EnvironmentMeansChart.jsx
// Multi-line chart for environment means (RH, dewpoint spread, VPD, wind)
import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

/**
 * @typedef {Object} EnvPoint
 * @property {number} hour_rel
 * @property {number} rh_mean
 * @property {number} dp_spread_mean
 * @property {number} vpd_mean
 * @property {number} wind_mean
 */

/**
 * @param {{ data: EnvPoint[] }} props
 */
export default function EnvironmentMeansChart({ data }) {
  // Prepare chart data
  const labels = data.map((d) => d.hour_rel);
  const datasets = [
    {
      label: "RH (%)",
      data: data.map((d) => d.rh_mean),
      borderColor: "#2563EB",
      backgroundColor: "#2563EB22",
      pointBackgroundColor: "#2563EB",
      pointRadius: 3,
      tension: 0.35,
      fill: false,
    },
    {
      label: "Dewpoint spread (°C)",
      data: data.map((d) => d.dp_spread_mean),
      borderColor: "#0EA5E9",
      backgroundColor: "#0EA5E922",
      pointBackgroundColor: "#0EA5E9",
      pointRadius: 3,
      tension: 0.35,
      fill: false,
    },
    {
      label: "VPD (kPa)",
      data: data.map((d) => d.vpd_mean),
      borderColor: "#F97316",
      backgroundColor: "#F9731622",
      pointBackgroundColor: "#F97316",
      pointRadius: 3,
      tension: 0.35,
      fill: false,
    },
    {
      label: "Wind (km/h)",
      data: data.map((d) => d.wind_mean),
      borderColor: "#4F46E5",
      backgroundColor: "#4F46E522",
      pointBackgroundColor: "#4F46E5",
      pointRadius: 3,
      tension: 0.35,
      fill: false,
    },
  ];

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          font: { size: 13, weight: "bold" },
          color: "#2563EB",
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          title: (items) => `Hour ${items[0].label}`,
        },
      },
    },
    interaction: {
      mode: "nearest",
      axis: "x",
      intersect: false,
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Hour relative to event start",
          font: { size: 12 },
        },
        grid: { color: "#E5E7EB" },
      },
      y: {
        title: {
          display: true,
          text: "Value",
          font: { size: 12 },
        },
        grid: { color: "#E5E7EB" },
      },
    },
    animation: {
      duration: 400,
      easing: "easeOutQuart",
    },
  };

  return (
    <div style={{ height: 280, background: "#fff", borderRadius: 18, boxShadow: "0 18px 45px rgba(15,23,42,0.12)", border: "1px solid #E5E7EB", padding: 24 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: "1.1rem", color: "#0f172a" }}>Environment (means)</div>
        <div style={{ fontSize: "0.95rem", color: "#64748b" }}>Averaged conditions pre/post event (aligned to rain start)</div>
      </div>
      <Line data={{ labels, datasets }} options={options} height={220} />
    </div>
  );
}
