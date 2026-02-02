import React from 'react';

export function DistanceMatrixCard({ matrix = null, isLoading = false }) {
  // If a matrix prop is provided, expect an object like { columns: [{key,label}], rows: [{sensor, ...}] }
  const distanceColumns = matrix?.columns ?? [
    { key: 'saaritie', label: 'Saaritie' },
    { key: 'tuulimyllyntie', label: 'Tuulimyllyntie' },
    { key: 'tahtiniementie', label: 'Tähtiniementie' },
    { key: 'kaakkovuori', label: 'Kaakkovuori' },
    { key: 'kotaniementie', label: 'Kotaniementie' },
  ];

  const distanceRows = matrix?.rows ?? [
    { sensor: 'Keltimaentie-LHT65013', saaritie: 11.826313, tuulimyllyntie: 1.859318, tahtiniementie: 25.616581, kaakkovuori: 9.364522, kotaniementie: 12.738074 },
    { sensor: 'Hikipolku-LHT65010', saaritie: 14.238546, tuulimyllyntie: 4.336574, tahtiniementie: 28.712264, kaakkovuori: 6.64768, kotaniementie: 11.174419 },
    { sensor: 'Hameenpohjantie-LHT65009', saaritie: 9.830152, tuulimyllyntie: 5.636695, tahtiniementie: 26.953646, kaakkovuori: 7.941698, kotaniementie: 7.215954 },
    { sensor: 'Survontie-LHT65008', saaritie: 10.185412, tuulimyllyntie: 2.216866, tahtiniementie: 25.904758, kaakkovuori: 8.114836, kotaniementie: 9.894675 },
    { sensor: 'Ritopohjantie-LHT65007', saaritie: 16.690683, tuulimyllyntie: 7.655086, tahtiniementie: 32.23159, kaakkovuori: 2.962691, kotaniementie: 8.808829 },
    { sensor: 'Kaunisharjuntie-LHT65006', saaritie: 15.737448, tuulimyllyntie: 11.152671, tahtiniementie: 33.247794, kaakkovuori: 5.668335, kotaniementie: 1.008685 },
    { sensor: 'Keilonkankaantie-LHT65005', saaritie: 7.106079, tuulimyllyntie: 2.974396, tahtiniementie: 22.497645, kaakkovuori: 11.522442, kotaniementie: 12.379319 },
  ];

  const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : '—');

  return (
    <div className="distance-matrix-card">
      <header className="distance-matrix-header">
        <h2 className="distance-matrix-title">Distance Matrix (km)</h2>
        <p className="distance-matrix-subtitle">
          Distances from each LHT sensor to key reference locations near the map.
        </p>
      </header>

      {isLoading ? (
        <div className="p-6">Loading distance matrix…</div>
      ) : (
        <div className="distance-matrix-table-wrapper">
          <table className="distance-matrix-table">
            <thead>
              <tr>
                <th scope="col">Sensor</th>
                {distanceColumns.map(col => (
                  <th scope="col" key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {distanceRows.map((row, i) => (
                <tr key={row.sensor} className={i % 2 === 0 ? 'even' : 'odd'}>
                  <th scope="row">{row.sensor}</th>
                  {distanceColumns.map(col => {
                    const val = row[col.key];
                    const display = fmt(val);
                    return <td key={col.key}>{display}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DistanceMatrixCard;
