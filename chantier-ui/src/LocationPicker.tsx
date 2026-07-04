import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { AutoComplete, Input, Spin } from "antd";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon (leaflet icons don't bundle correctly with webpack)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Default center: France
const DEFAULT_CENTER: [number, number] = [46.603354, 1.888334];
const DEFAULT_ZOOM = 6;
const MARKER_ZOOM = 13;

function parseGps(value?: string): [number, number] | null {
  if (!value) return null;
  const parts = value.split(",").map((s) => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0], parts[1]];
  }
  return null;
}

interface ClickHandlerProps {
  onLocationSelect: (lat: number, lng: number) => void;
}

function ClickHandler({ onLocationSelect }: ClickHandlerProps) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface AddressOption {
  value: string;
  coords: [number, number];
}

interface LocationPickerProps {
  value?: string;
  onChange?: (value: string) => void;
}

function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [position, setPosition] = useState<[number, number] | null>(
    parseGps(value)
  );
  const [options, setOptions] = useState<AddressOption[]>([]);
  const [searching, setSearching] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const parsed = parseGps(value);
    setPosition(parsed);
    if (parsed && mapRef.current) {
      mapRef.current.setView(parsed, MARKER_ZOOM);
    }
  }, [value]);

  // Nettoyage du timer de debounce au démontage
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const handleLocationSelect = (lat: number, lng: number) => {
    const coords: [number, number] = [
      Math.round(lat * 1000000) / 1000000,
      Math.round(lng * 1000000) / 1000000,
    ];
    setPosition(coords);
    if (onChange) {
      onChange(`${coords[0]},${coords[1]}`);
    }
    if (mapRef.current) {
      mapRef.current.setView(coords, Math.max(mapRef.current.getZoom(), MARKER_ZOOM));
    }
  };

  // Géocodage d'adresse via Nominatim (OpenStreetMap)
  const geocode = async (query: string) => {
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`,
        { headers: { "Accept-Language": "fr" } }
      );
      const data: NominatimResult[] = await res.json();
      setOptions(
        data
          .map((r) => ({
            value: r.display_name,
            coords: [parseFloat(r.lat), parseFloat(r.lon)] as [number, number],
          }))
          .filter((o) => !isNaN(o.coords[0]) && !isNaN(o.coords[1]))
      );
    } catch {
      setOptions([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = (query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 3) {
      setOptions([]);
      return;
    }
    debounceRef.current = setTimeout(() => geocode(query.trim()), 400);
  };

  const handleSelect = (_value: string, option: AddressOption) => {
    handleLocationSelect(option.coords[0], option.coords[1]);
    setOptions([]);
  };

  const center = position || DEFAULT_CENTER;
  const zoom = position ? MARKER_ZOOM : DEFAULT_ZOOM;

  return (
    <div>
      <AutoComplete
        options={options}
        onSearch={handleSearch}
        onSelect={handleSelect}
        filterOption={false}
        style={{ width: "100%", marginBottom: 8 }}
        notFoundContent={searching ? <Spin size="small" /> : null}
      >
        <Input.Search
          placeholder="Rechercher une adresse..."
          loading={searching}
          allowClear
        />
      </AutoComplete>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: 300, width: "100%", borderRadius: 8 }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onLocationSelect={handleLocationSelect} />
        {position && <Marker position={position} />}
      </MapContainer>
      <div style={{ marginTop: 4, color: "#888", fontSize: 12 }}>
        {position
          ? `Coordonnées : ${position[0]}, ${position[1]}`
          : "Recherchez une adresse ou cliquez sur la carte pour sélectionner une position"}
      </div>
    </div>
  );
}

export default LocationPicker;
