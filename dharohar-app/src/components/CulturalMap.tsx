import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowRight, Compass, ZoomIn, ZoomOut, RotateCcw,
  AlertTriangle, BookOpen, Volume2, Layers, ExternalLink, MapPin, Navigation, ShieldCheck, Search
} from 'lucide-react';
import { INDIA_STATES_GEO, ZONE_CENTROIDS, INDIA_MAP_BOUNDS } from '../data/indiaMapData';
import { useCulturalRecords } from '../data/culturalStore';
import { CATEGORY_CONFIG, VERIFICATION_CONFIG, type CulturalRecord, type RecordCategory } from '../data/types';
import './styles/CulturalMap.css';

interface CulturalMapProps {
  onViewRecord: (record: CulturalRecord) => void;
}

interface NearbyRecordItem {
  record: CulturalRecord;
  distanceKm: number;
}

/**
 * Haversine formula to compute great-circle distance in kilometers (client-side only)
 */
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function CulturalMap({ onViewRecord }: CulturalMapProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCategory = (searchParams.get('category') as RecordCategory | 'all') || 'all';

  const culturalRecords = useCulturalRecords();
  const [selectedStateId, setSelectedStateId] = useState<string>('MH');
  const [activeZone, setActiveZone] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<RecordCategory | 'all'>(initialCategory);
  const [datasetFilter, setDatasetFilter] = useState<'all' | 'ignca' | 'unesco' | 'community'>('all');
  const [onlyEndangered, setOnlyEndangered] = useState<boolean>(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Geolocation & Explore Near Me state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'prompting' | 'granted' | 'denied' | 'unsupported'>('prompting');
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [dossierMode, setDossierMode] = useState<'near-me' | 'regional'>('regional');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());

  // Automatic browser Geolocation detection on mount
  const requestUserLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('unsupported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(coords);
        setGeoStatus('granted');
        setDossierMode('near-me');

        // Focus map smoothly to user location
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([coords.lat, coords.lng], 9, {
            duration: 1.2,
          });
        }
      },
      (err) => {
        console.info('Geolocation access not granted:', err.message);
        setGeoStatus('denied');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }, []);

  useEffect(() => {
    requestUserLocation();
  }, [requestUserLocation]);

  // Calculate nearby records based on genuine lat/lng
  const nearbyRecords: NearbyRecordItem[] = useMemo(() => {
    if (!userLocation) return [];

    const list: NearbyRecordItem[] = [];
    culturalRecords.forEach((rec) => {
      // Publication rule: only published records appear on map
      if (rec.lifecycleStatus && rec.lifecycleStatus !== 'published') return;

      if (
        rec.coordinates &&
        typeof rec.coordinates.lat === 'number' &&
        typeof rec.coordinates.lng === 'number' &&
        Number.isFinite(rec.coordinates.lat) &&
        Number.isFinite(rec.coordinates.lng)
      ) {
        // Category / dataset / endangered filters check
        if (datasetFilter === 'ignca' && !rec.id.startsWith('ICH0')) return;
        if (datasetFilter === 'unesco' && !rec.id.startsWith('ICH-')) return;
        if (datasetFilter === 'community' && (rec.id.startsWith('ICH0') || rec.id.startsWith('ICH-'))) return;
        if (categoryFilter !== 'all' && rec.category !== categoryFilter) return;
        if (onlyEndangered && !rec.isEndangered) return;

        const distance = getDistanceFromLatLonInKm(
          userLocation.lat,
          userLocation.lng,
          rec.coordinates.lat,
          rec.coordinates.lng
        );

        if (distance <= radiusKm) {
          list.push({ record: rec, distanceKm: distance });
        }
      }
    });

    // Sort by nearest distance
    list.sort((a, b) => a.distanceKm - b.distanceKm);
    return list;
  }, [userLocation, radiusKm, datasetFilter, categoryFilter, onlyEndangered]);

  // Map records to all associated states
  const statesWithRecordsMap = useMemo(() => {
    const map = new Map<string, CulturalRecord[]>();
    culturalRecords.forEach(r => {
      // Only published records appear in public dossiers
      if (r.lifecycleStatus && r.lifecycleStatus !== 'published') return;

      INDIA_STATES_GEO.forEach(geo => {
        const matchesPrimary = geo.name.toLowerCase() === r.state.toLowerCase();
        const matchesInTitle = r.nativeTitle?.toLowerCase().includes(geo.name.toLowerCase()) || r.title.toLowerCase().includes(geo.name.toLowerCase());
        const matchesContext = r.fullDescription?.toLowerCase().includes(geo.name.toLowerCase());

        if (matchesPrimary || (r.id.startsWith('ICH0') && (matchesInTitle || matchesContext))) {
          const list = map.get(geo.id) || [];
          if (!list.some(existing => existing.id === r.id)) {
            list.push(r);
            map.set(geo.id, list);
          }
        }
      });
    });
    return map;
  }, []);

  const selectedGeo = INDIA_STATES_GEO.find(s => s.id === selectedStateId) || INDIA_STATES_GEO[0];

  // Filter selected state records by category and dataset
  const selectedStateRecords = useMemo(() => {
    let list = statesWithRecordsMap.get(selectedStateId) || [];
    if (datasetFilter === 'ignca') list = list.filter(r => r.id.startsWith('ICH0'));
    if (datasetFilter === 'unesco') list = list.filter(r => r.id.startsWith('ICH-'));
    if (datasetFilter === 'community') list = list.filter(r => !r.id.startsWith('ICH0') && !r.id.startsWith('ICH-'));
    if (categoryFilter !== 'all') list = list.filter(r => r.category === categoryFilter);
    if (onlyEndangered) list = list.filter(r => r.isEndangered);
    return list;
  }, [selectedStateId, statesWithRecordsMap, datasetFilter, categoryFilter, onlyEndangered]);

  // Filtered records visible on the map
  const visibleHeritageRecords = useMemo(() => {
    return culturalRecords.filter(r => {
      // Publication rule: only published records appear on the map
      if (r.lifecycleStatus && r.lifecycleStatus !== 'published') return false;

      if (datasetFilter === 'ignca' && !r.id.startsWith('ICH0')) return false;
      if (datasetFilter === 'unesco' && !r.id.startsWith('ICH-')) return false;
      if (datasetFilter === 'community' && (r.id.startsWith('ICH0') || r.id.startsWith('ICH-'))) return false;
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (onlyEndangered && !r.isEndangered) return false;

      // Zone filter check
      if (activeZone !== 'All') {
        const stateObj = INDIA_STATES_GEO.find(s => s.name.toLowerCase() === r.state.toLowerCase());
        if (stateObj && stateObj.zone !== activeZone) return false;
      }

      return true;
    });
  }, [categoryFilter, datasetFilter, onlyEndangered, activeZone]);

  // Initialize Leaflet Map centered properly on India
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [21.8, 80.0],
      zoom: 4.8,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: false,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors | Dharohar Setu',
    }).addTo(map);

    map.fitBounds(INDIA_MAP_BOUNDS, { padding: [15, 15] });

    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;
    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
      if (!userLocation) {
        map.fitBounds(INDIA_MAP_BOUNDS, { padding: [15, 15] });
      }
    }, 250);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Render "You Are Here" user location marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const userIcon = L.divIcon({
        className: 'leaflet-user-marker-wrapper',
        html: `
          <div class="user-location-marker">
            <div class="user-pulse-halo"></div>
            <div class="user-dot-inner">📍</div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18],
      });

      const userMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
        zIndexOffset: 1000,
      }).addTo(map);

      userMarker.bindPopup(`
        <div style="font-family:var(--font-body);padding:6px 8px;min-width:180px;">
          <div style="font-weight:700;color:var(--indigo);font-size:0.9rem;display:flex;align-items:center;gap:4px;">
            <span>🔵</span> You Are Here
          </div>
          <p style="font-size:0.75rem;color:var(--text-muted);margin:4px 0 0;">
            Local radius: <strong>${radiusKm} km</strong>. Your precise location is kept strictly private on this device.
          </p>
        </div>
      `);

      userMarkerRef.current = userMarker;
    }
  }, [userLocation, radiusKm]);

  // Update Markers when visible records change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();
    markersMapRef.current.clear();

    visibleHeritageRecords.forEach(record => {
      let lat = record.coordinates?.lat;
      let lng = record.coordinates?.lng;

      if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        const stateObj = INDIA_STATES_GEO.find(s =>
          s.name.toLowerCase() === record.state.toLowerCase() ||
          record.state.toLowerCase().includes(s.name.toLowerCase()) ||
          s.name.toLowerCase().includes(record.state.toLowerCase())
        );
        if (stateObj && Number.isFinite(stateObj.geoCentroid.lat) && Number.isFinite(stateObj.geoCentroid.lng)) {
          lat = stateObj.geoCentroid.lat;
          lng = stateObj.geoCentroid.lng;
        } else {
          lat = 22.5937;
          lng = 78.9629;
        }
      }

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const isIgnca = record.id.startsWith('ICH0');
      const isIch = record.id.startsWith('ICH-');
      const isEndangered = record.isEndangered;

      const pinTypeClass = isEndangered
        ? 'leaflet-pin-endangered'
        : isIgnca
        ? 'leaflet-pin-ignca'
        : isIch
        ? 'leaflet-pin-unesco'
        : 'leaflet-pin-community';

      const iconEmoji = isEndangered ? '⚠' : isIgnca ? '🏛️' : isIch ? '🌐' : CATEGORY_CONFIG[record.category].emoji;

      const customIcon = L.divIcon({
        className: 'leaflet-marker-wrapper',
        html: `
          <div class="leaflet-custom-marker ${pinTypeClass} ${selectedRecordId === record.id ? 'selected-pin' : ''}">
            <div class="pin-pulse"></div>
            <div class="pin-icon-inner">${iconEmoji}</div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      const sourceBadge = isIgnca
        ? '<span class="badge" style="background:#B4552C;color:white;font-weight:700;">🏛️ Source: IGNCA</span>'
        : isIch
        ? '<span class="badge" style="background:rgba(217,164,65,0.9);color:#1F2B3E;font-weight:700;">🌐 UNESCO ICH</span>'
        : '<span class="badge badge-terracotta">👥 Community Lore</span>';

      const statusBadge = `<span class="badge ${VERIFICATION_CONFIG[record.verificationStatus].badgeClass}">${VERIFICATION_CONFIG[record.verificationStatus].label}</span>`;

      // Distance tag if user location is available
      let distanceSnippet = '';
      if (userLocation && record.coordinates) {
        const d = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lng, record.coordinates.lat, record.coordinates.lng);
        distanceSnippet = `<div style="font-size:0.75rem;color:var(--terracotta);font-weight:600;margin-bottom:4px;">📍 ${d < 1 ? `${Math.round(d * 1000)} meters` : `${d.toFixed(1)} km`} away from you</div>`;
      }

      const popupHtml = `
        <div class="leaflet-record-popup" id="popup-${record.id}">
          <div class="popup-badges">${sourceBadge} ${statusBadge}</div>
          <h4 class="popup-title">${record.title}</h4>
          ${record.nativeTitle ? `<div class="popup-native">${record.nativeTitle}</div>` : ''}
          ${distanceSnippet}
          <div class="popup-location">📍 ${record.state}${record.district ? `, ${record.district}` : ''}</div>
          <p class="popup-desc">${record.shortDescription}</p>
          <div class="popup-actions">
            <button class="btn btn-sm btn-primary popup-view-btn" data-record-id="${record.id}">
              Explore Cultural Record ↗
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        className: 'dharohar-leaflet-popup',
        maxWidth: 320,
      });

      marker.on('click', () => {
        setSelectedRecordId(record.id);
        const stateObj = INDIA_STATES_GEO.find(s => s.name.toLowerCase() === record.state.toLowerCase());
        if (stateObj) {
          setSelectedStateId(stateObj.id);
        }
      });

      markersGroup.addLayer(marker);
      markersMapRef.current.set(record.id, marker);
    });
  }, [visibleHeritageRecords, selectedRecordId, userLocation]);

  // Delegate popup click button to open full Cultural Record modal
  useEffect(() => {
    const handlePopupClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.classList.contains('popup-view-btn')) {
        const recordId = target.getAttribute('data-record-id');
        if (recordId) {
          const rec = culturalRecords.find(r => r.id === recordId);
          if (rec) onViewRecord(rec);
        }
      }
    };

    document.addEventListener('click', handlePopupClick);
    return () => {
      document.removeEventListener('click', handlePopupClick);
    };
  }, [onViewRecord]);

  // Fly to location when a record is clicked from the dossier
  const handleDossierRecordClick = (record: CulturalRecord) => {
    setSelectedRecordId(record.id);
    let lat = record.coordinates?.lat;
    let lng = record.coordinates?.lng;

    if (lat === undefined || lng === undefined) {
      const stateObj = INDIA_STATES_GEO.find(s => s.name.toLowerCase() === record.state.toLowerCase());
      if (stateObj) {
        lat = stateObj.geoCentroid.lat;
        lng = stateObj.geoCentroid.lng;
      }
    }

    if (lat !== undefined && lng !== undefined && mapInstanceRef.current && Number.isFinite(lat) && Number.isFinite(lng)) {
      mapInstanceRef.current.flyTo([lat, lng], 8, {
        duration: 1.2,
      });

      const marker = markersMapRef.current.get(record.id);
      if (marker) {
        setTimeout(() => {
          marker.openPopup();
        }, 1250);
      }
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !mapInstanceRef.current) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ', India')}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        mapInstanceRef.current.flyTo([parseFloat(lat), parseFloat(lon)], 10, { duration: 1.5 });
      }
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle Zone filter click with smooth flyTo
  const handleZoneClick = (z: string) => {
    setActiveZone(z);
    if (!mapInstanceRef.current) return;

    if (z === 'All') {
      mapInstanceRef.current.fitBounds(INDIA_MAP_BOUNDS, { padding: [15, 15] });
    } else {
      const center = ZONE_CENTROIDS[z];
      if (center) {
        mapInstanceRef.current.flyTo([center.lat, center.lng], center.zoom, {
          duration: 1.0,
        });
      }
    }
  };

  // Handle State Selector click
  const handleStateSelect = (stateId: string) => {
    setSelectedStateId(stateId);
    setDossierMode('regional');
    const stateObj = INDIA_STATES_GEO.find(s => s.id === stateId);
    if (stateObj && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(
        [stateObj.geoCentroid.lat, stateObj.geoCentroid.lng],
        stateObj.defaultZoom || 7,
        { duration: 1.2 }
      );
    }
  };

  const zones = ['All', 'North', 'West', 'Central', 'East', 'NorthEast', 'South'];
  const radiusOptions = [2, 5, 10, 25, 50, 100];

  return (
    <div className="heritage-map-page page-enter" id="heritage-map-page">
      <div className="heritage-map-container">
        {/* Header Banner */}
        <div className="heritage-map-header">
          <div className="heritage-badge-pill">
            <Compass size={16} />
            <span>Interactive Living Cultural Atlas of India</span>
          </div>
          <h2>Heritage Map of India</h2>
          <p className="heritage-map-subtitle text-devanagari">
            भारत का वास्तविक सांस्कृतिक एवं धरोहर मानचित्र — Automatic Near-Me Geolocation & Living Cultural Atlas
          </p>
        </div>

        {/* Location Status Bar */}
        <div className="location-status-bar">
          {geoStatus === 'granted' && userLocation ? (
            <div className="location-indicator active">
              <span className="live-dot" />
              <span>📍 Location detected · Exploring living heritage near you</span>
              <button
                className="btn btn-sm btn-ghost"
                style={{ fontSize: '0.74rem', padding: '2px 8px', color: 'var(--terracotta)' }}
                onClick={() => {
                  if (mapInstanceRef.current && userLocation) {
                    mapInstanceRef.current.flyTo([userLocation.lat, userLocation.lng], 10, { duration: 1.0 });
                  }
                  setDossierMode('near-me');
                }}
              >
                Focus My Location
              </button>
            </div>
          ) : geoStatus === 'denied' ? (
            <div className="location-indicator warning">
              <span>Location access is unavailable. Explore heritage using the map & filters.</span>
              <button
                className="btn btn-sm btn-secondary"
                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                onClick={requestUserLocation}
              >
                <Navigation size={12} /> Use My Location
              </button>
            </div>
          ) : (
            <div className="location-indicator neutral">
              <span>Checking device location for nearby heritage...</span>
            </div>
          )}

          <div className="privacy-badge">
            <ShieldCheck size={14} />
            <span>Calculated locally on device</span>
          </div>
        </div>

        {/* Map Control Bar */}
        <div className="map-toolbar">
          <div className="zone-filters">
            <span className="filter-label"><Layers size={14} /> Zones:</span>
            {zones.map(z => (
              <button
                key={z}
                className={`zone-chip ${activeZone === z ? 'active' : ''}`}
                onClick={() => handleZoneClick(z)}
              >
                {z === 'All' ? 'All India' : z}
              </button>
            ))}
          </div>

          <div className="layer-toggles">
            {/* State Quick Jump Dropdown */}
            <select
              className="map-category-select"
              value={selectedStateId}
              onChange={e => handleStateSelect(e.target.value)}
              style={{ fontWeight: 600 }}
            >
              <option value="" disabled>📍 Focus State / Region</option>
              {INDIA_STATES_GEO.map(st => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.zone})
                </option>
              ))}
            </select>

            {/* Dataset Filter */}
            <select
              className="map-category-select"
              value={datasetFilter}
              onChange={e => setDatasetFilter(e.target.value as 'all' | 'ignca' | 'unesco' | 'community')}
              style={{ fontWeight: 600, borderColor: 'var(--terracotta-light)' }}
            >
              <option value="all">🏛️ All Datasets (IGNCA + UNESCO + Field)</option>
              <option value="ignca">🏛️ IGNCA National Inventory Only (10)</option>
              <option value="unesco">🌐 UNESCO Inscriptions Only (24)</option>
              <option value="community">👥 Community Field Lores Only (8)</option>
            </select>

            <button
              className={`layer-btn ${onlyEndangered ? 'active' : ''}`}
              onClick={() => setOnlyEndangered(!onlyEndangered)}
            >
              <AlertTriangle size={14} /> Endangered Only
            </button>

            <select
              className="map-category-select"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value as RecordCategory | 'all')}
            >
              <option value="all">✦ All Cultural Categories</option>
              {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.emoji} {cfg.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Map & Dossier Layout */}
        <div className="heritage-map-layout">
          {/* Real Leaflet OpenStreetMap Container */}
          <div className="heritage-map-canvas-card" style={{ padding: 0 }}>
            
            {/* Search Overlay */}
            <form onSubmit={handleSearch} className="map-search-overlay premium-glass">
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Search city, district or state..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button type="submit" disabled={isSearching} className="btn-sm btn-primary">Go</button>
            </form>
            
            {/* Legend Overlay */}
            <div className="map-legend-overlay premium-glass">
              <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>🗺️ Map Legend</span>
              </h4>
              <div className="legend-section">
                <strong>Dataset</strong>
                <div className="legend-item"><span className="legend-pin leaflet-pin-ignca">🏛️</span> IGNCA</div>
                <div className="legend-item"><span className="legend-pin leaflet-pin-unesco">🌐</span> UNESCO</div>
                <div className="legend-item"><span className="legend-pin leaflet-pin-community">👥</span> Community</div>
              </div>
              <div className="legend-section">
                <strong>Risk</strong>
                <div className="legend-item"><span className="legend-pin leaflet-pin-endangered">⚠</span> Endangered</div>
              </div>
            </div>

            <div id="india-heritage-map" style={{ width: '100%', height: '100%' }}></div>

            {/* Custom Themed Map View Controls */}
            <div className="map-view-controls">
              <button
                className="map-zoom-btn"
                onClick={() => mapInstanceRef.current?.zoomIn()}
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              <button
                className="map-zoom-btn"
                onClick={() => mapInstanceRef.current?.zoomOut()}
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              {userLocation && (
                <button
                  className="map-zoom-btn user-loc-btn"
                  onClick={() => {
                    mapInstanceRef.current?.flyTo([userLocation.lat, userLocation.lng], 10, { duration: 1.0 });
                    setDossierMode('near-me');
                  }}
                  title="Center on My Location"
                >
                  <Navigation size={16} style={{ color: 'var(--indigo)' }} />
                </button>
              )}
              <button
                className="map-zoom-btn"
                onClick={() => {
                  setActiveZone('All');
                  setDatasetFilter('all');
                  setCategoryFilter('all');
                  setOnlyEndangered(false);
                  mapInstanceRef.current?.fitBounds(INDIA_MAP_BOUNDS, { padding: [15, 15] });
                }}
                title="Reset All India View"
              >
                <RotateCcw size={16} />
              </button>
            </div>

            {/* Leaflet Mount DOM Node */}
            <div ref={mapContainerRef} className="leaflet-map-wrapper" />

            {/* Map Legend */}
            <div className="map-legend-overlay">
              {userLocation && (
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: '#2B3A55' }} />
                  <span>🔵 You Are Here</span>
                </div>
              )}
              <div className="legend-item">
                <span className="legend-dot" style={{ background: '#B4552C' }} />
                <span>🏛️ IGNCA Inventory (10)</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: '#D9A441' }} />
                <span>🌐 UNESCO Inscriptions (24)</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: '#6B8E6F' }} />
                <span>👥 Community Field Lore (8)</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot red pulse" />
                <span>⚠ Endangered Living Tradition</span>
              </div>
            </div>
          </div>

          {/* Right Heritage Dossier Panel */}
          <div className="heritage-dossier-panel" id="heritage-dossier">
            {/* Dossier View Tabs */}
            <div className="dossier-tab-bar">
              {userLocation && (
                <button
                  className={`dossier-tab-btn ${dossierMode === 'near-me' ? 'active' : ''}`}
                  onClick={() => setDossierMode('near-me')}
                >
                  📍 Near Me ({nearbyRecords.length})
                </button>
              )}
              <button
                className={`dossier-tab-btn ${dossierMode === 'regional' ? 'active' : ''}`}
                onClick={() => setDossierMode('regional')}
              >
                🏛️ {selectedGeo.name} Dossier ({selectedStateRecords.length})
              </button>
            </div>

            {/* NEAR ME MODE */}
            {dossierMode === 'near-me' && userLocation ? (
              <>
                <div className="dossier-header" style={{
                  background: `linear-gradient(135deg, var(--indigo-deep), #1F2B3E)`
                }}>
                  <div className="dossier-tag">HERITAGE NEAR YOU</div>
                  <div className="dossier-title-row">
                    <h3>Living Lore Nearby</h3>
                  </div>
                  <div className="dossier-quick-stats">
                    <span>📍 Within {radiusKm} km radius</span>
                    <span>📜 {nearbyRecords.length} Documented Traditions</span>
                  </div>

                  {/* Radius Selector Options */}
                  <div className="radius-selector-row">
                    <span style={{ fontSize: '0.74rem', opacity: 0.8 }}>Radius:</span>
                    {radiusOptions.map(r => (
                      <button
                        key={r}
                        className={`radius-pill ${radiusKm === r ? 'active' : ''}`}
                        onClick={() => setRadiusKm(r)}
                      >
                        {r} km
                      </button>
                    ))}
                  </div>
                </div>

                <div className="dossier-body">
                  <div className="dossier-records-section">
                    {nearbyRecords.length === 0 ? (
                      <div className="empty-dossier-state premium-glass" style={{ textAlign: 'center', padding: '2rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🏛️</div>
                        <h4 style={{ color: 'var(--text-light)', marginBottom: '0.5rem' }}>Your area is still waiting to be documented</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                          No documented heritage was found within {radiusKm} km of this location. Help preserve the traditions, places and stories of your community.
                        </p>
                        <button className="btn btn-primary" style={{ width: '100%', marginBottom: '0.75rem' }} onClick={() => navigate('/contribute')}>
                          + Add Heritage from this Area
                        </button>
                        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setRadiusKm(radiusKm === 10 ? 50 : 100)}>
                          Expand Search Radius
                        </button>
                      </div>
                    ) : (
                      <div className="dossier-record-cards">
                        {nearbyRecords.map(({ record, distanceKm }) => {
                          const isIgnca = record.id.startsWith('ICH0');
                          const isIch = record.id.startsWith('ICH-');

                          return (
                            <div
                              key={record.id}
                              className={`dossier-record-card ${selectedRecordId === record.id ? 'active-dossier-card' : ''}`}
                              onClick={() => handleDossierRecordClick(record)}
                            >
                              <div className="record-card-top">
                                <span className="record-emoji">{CATEGORY_CONFIG[record.category].emoji}</span>
                                <div style={{ flex: 1 }}>
                                  <h5 className="record-title">{record.title}</h5>
                                  {record.nativeTitle && (
                                    <span className="record-native">{record.nativeTitle}</span>
                                  )}
                                </div>
                                <span className="distance-badge">
                                  🚗 {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}
                                </span>
                              </div>

                              <p className="record-snippet">{record.shortDescription}</p>

                              <div className="record-meta-row">
                                <span className="meta-lang">
                                  <MapPin size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {record.state}{record.district ? ` · ${record.district}` : ''}
                                </span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {isIgnca ? (
                                    <span className="badge" style={{ background: 'rgba(180, 85, 44, 0.15)', color: 'var(--terracotta)', fontSize: '0.62rem', fontWeight: 700 }}>
                                      🏛️ IGNCA
                                    </span>
                                  ) : isIch ? (
                                    <span className="badge" style={{ background: 'rgba(217, 164, 65, 0.15)', color: 'var(--turmeric-dark)', fontSize: '0.62rem', fontWeight: 700 }}>
                                      🌐 UNESCO
                                    </span>
                                  ) : (
                                    <span className="badge badge-terracotta" style={{ fontSize: '0.62rem' }}>
                                      👥 Community
                                    </span>
                                  )}
                                  <span className={`badge ${VERIFICATION_CONFIG[record.verificationStatus].badgeClass}`} style={{ fontSize: '0.62rem' }}>
                                    {VERIFICATION_CONFIG[record.verificationStatus].label}
                                  </span>
                                </div>
                              </div>

                              <div className="dossier-action-row">
                                {isIgnca ? (
                                  <a
                                    href="https://ignca.gov.in/divisionss/janapada-sampada/loka-parampara/intangible-cultural-heritage/inventory-on-the-intangible-cultural-heritage/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="audio-available-tag"
                                    style={{ color: 'var(--terracotta)', fontSize: '0.74rem' }}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <ExternalLink size={12} /> Official Source
                                  </a>
                                ) : record.audioScript ? (
                                  <span className="audio-available-tag">
                                    <Volume2 size={12} /> Audio Preserved
                                  </span>
                                ) : <div />}

                                <button
                                  className="open-story-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onViewRecord(record);
                                  }}
                                >
                                  Explore Record <ArrowRight size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* REGIONAL STATE DOSSIER MODE */
              <>
                <div className="dossier-header" style={{
                  background: `linear-gradient(135deg, var(--indigo-deep), var(--terracotta-dark))`
                }}>
                  <div className="dossier-tag">REGIONAL HERITAGE DOSSIER</div>
                  <div className="dossier-title-row">
                    <h3>{selectedGeo.name}</h3>
                    <span className="dossier-hindi text-devanagari">{selectedGeo.hindiName}</span>
                  </div>
                  <div className="dossier-quick-stats">
                    <span>📍 {selectedGeo.zone} India</span>
                    <span>🏛️ {selectedGeo.unescoCount} UNESCO Inscriptions</span>
                    <span>📜 {selectedStateRecords.length} Documented Records</span>
                  </div>
                </div>

                <div className="dossier-body">
                  <div className="dossier-summary-box">
                    <h4>Cultural Landscape</h4>
                    <p>{selectedGeo.culturalSnippet}</p>
                  </div>

                  {/* Living Traditions List */}
                  <div className="dossier-records-section">
                    <div className="dossier-records-header">
                      <h4>Heritage Records in {selectedGeo.name}</h4>
                      <span className="records-count-badge">{selectedStateRecords.length}</span>
                    </div>

                    {selectedStateRecords.length === 0 ? (
                      <div className="empty-dossier-state premium-glass" style={{ textAlign: 'center', padding: '2rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🏛️</div>
                        <h4 style={{ color: 'var(--text-light)', marginBottom: '0.5rem' }}>This region is still waiting to be documented</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                          No documented heritage was found in {selectedGeo.name} matching these filters. Help preserve the traditions, places and stories of your community.
                        </p>
                        <button className="btn btn-primary" style={{ width: '100%', marginBottom: '0.75rem' }} onClick={() => navigate('/contribute')}>
                          + Add Heritage from {selectedGeo.name}
                        </button>
                      </div>
                    ) : (
                      <div className="dossier-record-cards">
                        {selectedStateRecords.map(record => {
                          const isIgnca = record.id.startsWith('ICH0');
                          const isIch = record.id.startsWith('ICH-');

                          return (
                            <div
                              key={record.id}
                              className={`dossier-record-card ${selectedRecordId === record.id ? 'active-dossier-card' : ''}`}
                              onClick={() => handleDossierRecordClick(record)}
                            >
                              <div className="record-card-top">
                                <span className="record-emoji">{CATEGORY_CONFIG[record.category].emoji}</span>
                                <div style={{ flex: 1 }}>
                                  <h5 className="record-title">{record.title}</h5>
                                  {record.nativeTitle && (
                                    <span className="record-native">{record.nativeTitle}</span>
                                  )}
                                </div>
                                {record.isEndangered && (
                                  <span className="badge badge-endangered" style={{ fontSize: '0.6rem' }}>
                                    <AlertTriangle size={10} /> Endangered
                                  </span>
                                )}
                              </div>

                              <p className="record-snippet">{record.shortDescription}</p>

                              <div className="record-meta-row">
                                <span className="meta-lang">
                                  <MapPin size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {record.state}{record.district ? ` · ${record.district}` : ''}
                                </span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {isIgnca ? (
                                    <span className="badge" style={{ background: 'rgba(180, 85, 44, 0.15)', color: 'var(--terracotta)', fontSize: '0.62rem', fontWeight: 700 }}>
                                      🏛️ IGNCA
                                    </span>
                                  ) : isIch ? (
                                    <span className="badge" style={{ background: 'rgba(217, 164, 65, 0.15)', color: 'var(--turmeric-dark)', fontSize: '0.62rem', fontWeight: 700 }}>
                                      🌐 UNESCO
                                    </span>
                                  ) : (
                                    <span className="badge badge-terracotta" style={{ fontSize: '0.62rem' }}>
                                      👥 Community
                                    </span>
                                  )}
                                  <span className={`badge ${VERIFICATION_CONFIG[record.verificationStatus].badgeClass}`} style={{ fontSize: '0.62rem' }}>
                                    {VERIFICATION_CONFIG[record.verificationStatus].label}
                                  </span>
                                </div>
                              </div>

                              <div className="dossier-action-row">
                                {isIgnca ? (
                                  <a
                                    href="https://ignca.gov.in/divisionss/janapada-sampada/loka-parampara/intangible-cultural-heritage/inventory-on-the-intangible-cultural-heritage/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="audio-available-tag"
                                    style={{ color: 'var(--terracotta)', fontSize: '0.74rem' }}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <ExternalLink size={12} /> Official Source
                                  </a>
                                ) : record.audioScript ? (
                                  <span className="audio-available-tag">
                                    <Volume2 size={12} /> Audio Preserved
                                  </span>
                                ) : <div />}

                                <button
                                  className="open-story-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onViewRecord(record);
                                  }}
                                >
                                  Explore Record <ArrowRight size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
