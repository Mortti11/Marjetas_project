// src/components/charts/EnvironmentMeansChart.jsx
// Multi-line chart for environment means (RH, dewpoint spread, VPD, wind)
import React, { useMemo } from "react";
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
import annotationPlugin from "chartjs-plugin-annotation";

/**
 * @typedef {Object} EnvPoint
 * @property {number} hour_rel      // hours relative to event start, e.g. -6..+12
 * @property {number} rh_mean       // %
 * @property {number} dp_spread_mean // °C
 * @property {number} vpd_mean      // kPa
 * @property {number} wind_mean     // km/h
 */
/** @typedef {{ data: EnvPoint[] }} EnvironmentMeansChartProps */

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

// tiny plugin to draw a thin vertical guideline under the tooltip
const HoverGuideline = {
  id: "hoverGuideline",
  afterDatasetsDraw(chart) {
    const { ctx, tooltip } = chart;
    const active = tooltip?.getActiveElements?.() || [];
    if (!active.length) return;
    const x = active[0].element.x;
    const chartArea = chart.chartArea;
    ctx.save();
    ctx.strokeStyle = "rgba(2,6,23,0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

ChartJS.register(HoverGuideline);

export default function EnvironmentMeansChart({ data }) {
  const labels = useMemo(() => data.map((d) => d.hour_rel), [data]);

  const datasets = useMemo(() => ([
    {
      label: "RH (%)",
      data: data.map((d) => d.rh_mean),
      borderColor: "#2563EB",
      backgroundColor: "#2563EB22",
      pointBackgroundColor: "#2563EB",
      pointRadius: 3,
      pointHoverRadius: 5,
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
      pointHoverRadius: 5,
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
      pointHoverRadius: 5,
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
      pointHoverRadius: 5,
      tension: 0.35,
      fill: false,
    },
  ]), [data]);

  const zeroLabel = useMemo(() => {
    // for category scale, annotation needs the label value that equals 0
    const hit = labels.find((l) => Number(l) === 0);
    return hit ?? "0";
  }, [labels]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: { font: { size: 13, weight: "600" }, color: "#0f172a" },
      },
      title: { display: false },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          title: (items) => `Hour ${items[0].label} (rel)`,
        },
      },
      annotation: {
        annotations: {
          rainStart: {
            type: "line",
            xMin: zeroLabel,
            xMax: zeroLabel,
            borderColor: "#64748b",
            borderDash: [6, 6],
            borderWidth: 2,
            label: {
              display: true,
              content: "Rain start",
              color: "#475569",
              backgroundColor: "rgba(255,255,255,0.9)",
              position: "start",
              yAdjust: -6,
              font: { size: 11, weight: "600" },
            },
          },
        },
      },
    },
    interaction: { mode: "nearest", axis: "x", intersect: false },
    scales: {
      x: {
        title: {
          display: true,
          text: "Hour relative to event start",
          font: { size: 12 },
          color: "#64748b",
        },
        grid: { color: "#E5E7EB" },
      },
      y: {
        title: { display: true, text: "Value", font: { size: 12 }, color: "#64748b" },
        grid: { color: "#E5E7EB" },
      },
    },
    animation: { duration: 400, easing: "easeOutQuart" },
  }), [zeroLabel]);

  return (
    <div style={{ height: 300, background: "#fff", borderRadius: 20, boxShadow: "0 18px 45px rgba(15,23,42,0.12)", border: "1px solid #E5E7EB", padding: 24 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: "1.1rem", color: "#0f172a" }}>Environment (means)</div>
        <div style={{ fontSize: "0.95rem", color: "#64748b" }}>Averaged conditions pre/post event (aligned to rain start)</div>
      </div>
      <Line data={{ labels, datasets }} options={options} />
    </div>
  );
}
