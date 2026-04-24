import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon issue with webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const artisanIcon = new L.DivIcon({
  html: `<div style="
    background:#059669;
    width:14px;height:14px;
    border-radius:50%;
    border:3px solid white;
    box-shadow:0 0 0 3px #05966980, 0 2px 8px rgba(0,0,0,0.3);
  "></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -10],
});

const clientIcon = new L.DivIcon({
  html: `<div style="
    background:#1c1917;
    width:16px;height:16px;
    border-radius:50%;
    border:3px solid white;
    box-shadow:0 2px 8px rgba(0,0,0,0.4);
  "></div>`,
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

interface Artisan {
  id: string;
  full_name: string;
  category_name: string;
  avg_rating: number;
  distance_km: string;
  is_verified: number;
  is_online: number;
  lat?: number;
  lng?: number;
}

interface ArtisanMapProps {
  artisans: Artisan[];
  userLocation: { lat: number; lng: number } | null;
  onArtisanClick: (artisan: Artisan) => void;
}

export function ArtisanMap({ artisans, userLocation, onArtisanClick }: ArtisanMapProps) {
  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [36.8065, 10.1815]; // Tunis default

  const artisansWithCoords = artisans.filter(a => a.lat && a.lng);

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden" style={{ minHeight: '400px' }}>
      <MapContainer
        center={center}
        zoom={12}
        style={{ width: '100%', height: '100%', minHeight: '400px' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* User location marker */}
        {userLocation && (
          <>
            <Marker position={[userLocation.lat, userLocation.lng]} icon={clientIcon}>
              <Popup>
                <div style={{ textAlign: 'center', fontWeight: 'bold' }}>موقعك الحالي</div>
              </Popup>
            </Marker>
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={5000}
              pathOptions={{ color: '#059669', fillColor: '#059669', fillOpacity: 0.05, weight: 1 }}
            />
          </>
        )}

        {/* Artisan markers */}
        {artisansWithCoords.map(artisan => (
          <Marker
            key={artisan.id}
            position={[artisan.lat!, artisan.lng!]}
            icon={artisanIcon}
            eventHandlers={{ click: () => onArtisanClick(artisan) }}
          >
            <Popup>
              <div style={{ minWidth: '160px', fontFamily: 'sans-serif' }}>
                <p style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                  {artisan.full_name}
                </p>
                <p style={{ color: '#059669', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {artisan.category_name}
                </p>
                <p style={{ fontSize: '11px', color: '#666' }}>
                  ⭐ {artisan.avg_rating?.toFixed(1)} — {artisan.distance_km} كم
                </p>
                <button
                  onClick={() => onArtisanClick(artisan)}
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    background: '#1c1917',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  عرض الملف الشخصي
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
