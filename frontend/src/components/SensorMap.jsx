import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import './SensorMap.css';

// Fix for default marker icons in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Sensor coordinates
const LHT_SENSORS = [
  { id: "LHT65013", name: "LHT65013", lat: 62.234563, lon: 25.672774 },
  { id: "LHT65010", name: "LHT65010", lat: 62.260777, lon: 25.693876 },
  { id: "LHT65009", name: "LHT65009", lat: 62.222971, lon: 25.804673 },
  { id: "LHT65008", name: "LHT65008", lat: 62.227604, lon: 25.736853 },
  { id: "LHT65007", name: "LHT65007", lat: 62.286678, lon: 25.745330 },
  { id: "LHT65006", name: "LHT65006", lat: 62.265198, lon: 25.890080 },
  { id: "LHT65005", name: "LHT65005", lat: 62.197614, lon: 25.720489 },
];

const WS100_SENSORS = [
  { id: "Saaritie", name: "Saaritie", lat: 62.136788, lon: 25.762473 },
  { id: "Tuulimyllyntie", name: "Tuulimyllyntie", lat: 62.221789, lon: 25.695931 },
  { id: "Tähtiniementie", name: "Tähtiniementie", lat: 62.011127, lon: 25.552755 },
  { id: "Kaakkovuori", name: "Kaakkovuori", lat: 62.294362, lon: 25.800196 },
  { id: "Kotaniementie", name: "Kotaniementie", lat: 62.265705, lon: 25.909542 },
];

const AIRPORT = { lat: 62.3995, lon: 25.6783, name: "Jyväskylä Airport" };

// Custom marker icons
const lhtIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const ws100Icon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Create a custom wind arrow icon
const createWindIcon = (direction = 0) => {
  const html = `
    <div style="
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
      border: 3px solid #f59e0b;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transform: rotate(${direction}deg);
    ">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5">
        <path d="M12 2 L12 22 M12 2 L8 6 M12 2 L16 6"/>
      </svg>
    </div>
  `;
  
  return L.divIcon({
    html,
    className: 'wind-marker-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
};

// Component to fit bounds
function FitBounds() {
  const map = useMap();
  
  useEffect(() => {
    const allPoints = [
      ...LHT_SENSORS.map(s => [s.lat, s.lon]),
      ...WS100_SENSORS.map(s => [s.lat, s.lon]),
      [AIRPORT.lat, AIRPORT.lon]
    ];
    
    const bounds = L.latLngBounds(allPoints);
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [map]);
  
  return null;
}

export default function SensorMap({ windData = null, visibleLayers = { LHT:true, WS100:true, AIRPORT:true } }) {
  // Independent layer visibility
  const showLht = !!visibleLayers.LHT;
  const showWs100 = !!visibleLayers.WS100;
  const showAirport = !!visibleLayers.AIRPORT;

  const windSpeed = windData?.wind_speed_10m || 0;
  const windDirection = windData?.wind_direction_10m || 0;
  const windGusts = windData?.wind_gusts_10m || 0;

  return (
    <div className="sensor-map-container">
      <MapContainer
        center={[62.2188, 25.7487]}
        zoom={11}
        scrollWheelZoom={true}
        className="leaflet-map-full"
        style={{ height: '100%', minHeight: '420px', background: '#f8fafc' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds />

        {/* LHT Sensors */}
          {showLht && LHT_SENSORS.map((sensor) => (
            <Marker
              key={sensor.id}
              position={[sensor.lat, sensor.lon]}
              icon={lhtIcon}
            >
              <Popup>
                <div className="sensor-popup">
                  <strong>{sensor.name}</strong>
                  <div className="popup-type">Type: LHT (Temperature & Humidity)</div>
                  <div className="popup-coords">
                    {sensor.lat.toFixed(6)}, {sensor.lon.toFixed(6)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* WS100 Sensors */}
          {showWs100 && WS100_SENSORS.map((sensor) => (
            <Marker
              key={sensor.id}
              position={[sensor.lat, sensor.lon]}
              icon={ws100Icon}
            >
              <Popup>
                <div className="sensor-popup">
                  <strong>{sensor.name}</strong>
                  <div className="popup-type">Type: WS100 (Precipitation)</div>
                  <div className="popup-coords">
                    {sensor.lat.toFixed(6)}, {sensor.lon.toFixed(6)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Airport Wind Marker */}
          {showAirport && (
            <Marker
              position={[AIRPORT.lat, AIRPORT.lon]}
              icon={createWindIcon(windDirection)}
            >
              <Popup>
                <div className="sensor-popup">
                  <strong>{AIRPORT.name} – Wind</strong>
                  <div className="popup-type">Wind Measurement Station</div>
                  <div className="popup-coords">
                    {AIRPORT.lat.toFixed(6)}, {AIRPORT.lon.toFixed(6)}
                  </div>
                  <div className="wind-data">
                    <div className="wind-stat">
                      <span className="wind-label">Speed:</span>
                      <span className="wind-value">{windSpeed.toFixed(1)} km/h</span>
                    </div>
                    <div className="wind-stat">
                      <span className="wind-label">Direction:</span>
                      <span className="wind-value">{windDirection.toFixed(0)}°</span>
                    </div>
                    <div className="wind-stat">
                      <span className="wind-label">Gusts:</span>
                      <span className="wind-value">{windGusts.toFixed(1)} km/h</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
        {!showLht && !showWs100 && !showAirport && (
          <div style={{
            position:'absolute',
            inset:0,
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            pointerEvents:'none'
          }}>
            <div style={{
              background:'rgba(2,6,23,0.75)',
              color:'#E5E7EB',
              padding:'10px 16px',
              borderRadius:12,
              fontSize:'0.875rem',
              border:'1px solid #1F2937'
            }}>No layers selected</div>
          </div>
        )}
    </div>
  );
}
