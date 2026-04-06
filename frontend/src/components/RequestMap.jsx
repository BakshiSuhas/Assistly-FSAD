import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom "You Are Here" blue dot icon
const liveLocationIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      position: relative;
      width: 20px;
      height: 20px;
    ">
      <div style="
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: rgba(99, 102, 241, 0.25);
        animation: pulse-ring 1.8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
      "></div>
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #6366f1;
        border: 2px solid white;
        box-shadow: 0 0 8px rgba(99, 102, 241, 0.8);
      "></div>
    </div>
    <style>
      @keyframes pulse-ring {
        0%   { transform: scale(0.8); opacity: 1; }
        80%  { transform: scale(2.5); opacity: 0; }
        100% { transform: scale(2.5); opacity: 0; }
      }
    </style>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -12],
});

// Flyto helper — centers the map when liveCenter changes
const MapFlyTo = ({ center, zoom = 14 }) => {
  const map = useMap();
  const hasFlewRef = useRef(false);
  useEffect(() => {
    if (center && !hasFlewRef.current) {
      map.flyTo(center, zoom, { duration: 1.5 });
      hasFlewRef.current = true;
    }
  }, [center, map, zoom]);
  return null;
};

// Click handler for the "pin a location" mode
const LocationSelector = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      if (onLocationSelect) onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const FALLBACK_CENTER = [20.5937, 78.9629]; // Centre of India as a sensible default

const RequestMap = ({ requests = [], currentUserId, onAccept, onLocationSelect, selectedLocation }) => {
  const [livePos, setLivePos]       = useState(null);   // { lat, lng, accuracy }
  const [geoError, setGeoError]     = useState(null);
  const [locating, setLocating]     = useState(true);
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported by this browser.');
      setLocating(false);
      return;
    }

    // First, do a one-shot quick fix
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLivePos({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLocating(false);
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setGeoError(err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Then start watching for position updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLivePos({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLocating(false);
      },
      (err) => console.warn('Watch error:', err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Determine initial map center priority:
  // 1. selectedLocation (pin-mode)  2. live GPS  3. fallback
  const initialCenter = selectedLocation
    ? [selectedLocation.lat, selectedLocation.lng]
    : livePos
    ? [livePos.lat, livePos.lng]
    : FALLBACK_CENTER;

  const handleUseCurrentLocation = () => {
    if (!onLocationSelect) return;
    if (!navigator.geolocation) {
      alert('Geolocation is not supported in this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLocationSelect(position.coords.latitude, position.coords.longitude);
      },
      () => {
        alert('Unable to fetch your current location. Please allow location access.');
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
      }
    );
  };

  return (
    <div style={{ position: 'relative', height: '300px', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>

      {/* Locating overlay */}
      {locating && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1000,
          background: 'rgba(2, 6, 23, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px',
        }}>
          <div style={{
            width: 36, height: 36,
            borderRadius: '50%',
            border: '3px solid rgba(99, 102, 241, 0.3)',
            borderTopColor: '#6366f1',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ color: '#a5b4fc', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Acquiring Signal…
          </span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Geo-denied banner */}
      {geoError && !locating && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 900,
          background: 'rgba(239, 68, 68, 0.85)', backdropFilter: 'blur(6px)',
          color: '#fff', padding: '6px 14px', fontSize: '0.72rem', fontWeight: 600,
          textAlign: 'center', letterSpacing: '0.04em',
        }}>
          ⚠ Location access denied — enable it in browser settings to see your position
        </div>
      )}

      <MapContainer
        center={initialCenter}
        zoom={livePos ? 14 : 5}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        {/* Dark-themed tile layer for better contrast */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &amp; <a href="https://carto.com/">CARTO</a>'
          maxZoom={19}
        />

        {/* Fly to live location once it arrives */}
        {livePos && !selectedLocation && (
          <MapFlyTo center={[livePos.lat, livePos.lng]} zoom={14} />
        )}

        {/* Click-to-pin mode */}
        {onLocationSelect && <LocationSelector onLocationSelect={onLocationSelect} />}

        {/* Selected / pinned location marker */}
        {selectedLocation && (
          <Marker position={[selectedLocation.lat, selectedLocation.lng]}>
            <Popup>
              <div style={{ minWidth: 130 }}>
                <strong>📍 Target Location</strong>
                <div style={{ fontSize: '0.75rem', marginTop: 4, opacity: 0.8 }}>
                  {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* ── Live "You Are Here" marker ── */}
        {livePos && (
          <>
            {/* Accuracy radius ring */}
            <Circle
              center={[livePos.lat, livePos.lng]}
              radius={livePos.accuracy || 100}
              pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.08, weight: 1.5 }}
            />
            <Marker position={[livePos.lat, livePos.lng]} icon={liveLocationIcon} zIndexOffset={1000}>
              <Popup>
                <div style={{ minWidth: 130 }}>
                  <strong>🔵 You Are Here</strong>
                  <div style={{ fontSize: '0.75rem', marginTop: 4, opacity: 0.75 }}>
                    Accuracy: ±{Math.round(livePos.accuracy || 0)} m
                  </div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                    {livePos.lat.toFixed(5)}, {livePos.lng.toFixed(5)}
                  </div>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Request markers */}
        {requests.map(req =>
          req.latitude && req.longitude ? (
            <Marker key={req.id} position={[req.latitude, req.longitude]}>
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <h6 style={{ margin: '0 0 4px', fontWeight: 700 }}>{req.title}</h6>
                  <p style={{ margin: '0 0 8px', fontSize: '0.78rem', opacity: 0.75 }}>{req.description}</p>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    background: req.status === 'COMPLETED' ? '#d1fae5' : req.status === 'IN_PROGRESS' ? '#dbeafe' : '#fef3c7',
                    color:       req.status === 'COMPLETED' ? '#065f46' : req.status === 'IN_PROGRESS' ? '#1e40af' : '#78350f',
                  }}>
                    {req.status.replace('_', ' ')}
                  </span>

                  {req.status === 'OPEN' && req.author?.id !== currentUserId && onAccept && (
                    <div style={{ marginTop: 10 }}>
                      <button
                        onClick={() => onAccept(req.id)}
                        style={{ width: '100%', padding: '5px 0', borderRadius: 20, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem' }}
                      >
                        Volunteer
                      </button>
                    </div>
                  )}
                  {req.author?.id === currentUserId && (
                    <div style={{ marginTop: 6, fontSize: '0.72rem', opacity: 0.6, textAlign: 'center' }}>Your Request</div>
                  )}
                </div>
              </Popup>
            </Marker>
          ) : null
        )}
      </MapContainer>
    </div>
  );
};

export default RequestMap;
