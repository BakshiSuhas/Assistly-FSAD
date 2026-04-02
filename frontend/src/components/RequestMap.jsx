import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const RequestMap = ({ requests, currentUserId, onAccept }) => {
  // Default center point (e.g., center of a city)
  const defaultCenter = [40.7128, -74.0060];

  return (
    <div style={{ height: '300px', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
      <MapContainer center={defaultCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {requests && requests.map(req => (
          req.latitude && req.longitude ? (
            <Marker key={req.id} position={[req.latitude, req.longitude]}>
              <Popup>
                <div>
                  <h6 className="mb-1 fw-bold">{req.title}</h6>
                  <p className="mb-2 small">{req.description}</p>
                  <span className={`badge mb-3 ${
                    req.status === 'COMPLETED' ? 'bg-success' :
                    req.status === 'IN_PROGRESS' ? 'bg-info' : 'bg-warning'
                  }`}>
                    {req.status}
                  </span>
                  
                  {req.status === 'OPEN' && req.author?.id !== currentUserId && (
                    <div className="mt-2 w-100">
                      <button onClick={() => onAccept(req.id)} className="btn btn-sm btn-info text-white w-100 rounded-pill">
                        Volunteer
                      </button>
                    </div>
                  )}
                  {req.author?.id === currentUserId && (
                     <div className="mt-2 text-muted small fst-italic w-100 text-center">Your Request</div>
                  )}
                </div>
              </Popup>
            </Marker>
          ) : null
        ))}
      </MapContainer>
    </div>
  );
};

export default RequestMap;
