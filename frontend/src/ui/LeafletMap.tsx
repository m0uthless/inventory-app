/**
 * LeafletMap — mappa OpenStreetMap senza API key.
 *
 * Miglioramenti:
 *  - Cache in-memory geocoding (evita richieste duplicate e rate limiting)
 *  - Debounce 400ms (evita richieste su render rapidi)
 *  - Espansione abbreviazioni italiane (V.le, P.zza, ecc.)
 *  - countrycodes=it per risultati più precisi
 *  - Tile CartoDB Voyager (strade + etichette)
 */
import * as React from "react";
import { Box, CircularProgress, Typography } from "@mui/material";

interface Props {
  address: string;
  height?: number;
  zoom?: number;
}

declare global {
  interface Window { L: any; }
}

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS  = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

let leafletLoading: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (window.L) return Promise.resolve();
  if (leafletLoading) return leafletLoading;
  leafletLoading = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel  = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src     = LEAFLET_JS;
    script.onload  = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Leaflet"));
    document.head.appendChild(script);
  });
  return leafletLoading;
}

// In-memory cache: evita richieste duplicate a Nominatim
const geocodeCache = new Map<string, { lat: number; lon: number } | null>();

function normalizeAddress(addr: string): string {
  return addr
    .replace(/\bV\.le\b/gi,   "Viale")
    .replace(/\bVle\b/gi,     "Viale")
    .replace(/\bP\.zza\b/gi,  "Piazza")
    .replace(/\bPza\b/gi,     "Piazza")
    .replace(/\bP\.le\b/gi,   "Piazzale")
    .replace(/\bLgo\b/gi,     "Largo")
    .replace(/\bFraz\.\s*/gi, "Frazione ")
    .replace(/\bS\.S\.\s*/gi, "Strada Statale ")
    .replace(/\bS\.P\.\s*/gi, "Strada Provinciale ")
    .trim();
}

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  const key = normalizeAddress(address);
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(key)}&limit=1&countrycodes=it`;
  try {
    const res = await fetch(url, {
      headers: { "Accept-Language": "it", "User-Agent": "inventory-app/1.0" },
    });
    const data = await res.json();
    const result = data.length
      ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
      : null;
    geocodeCache.set(key, result);
    return result;
  } catch {
    return null;
  }
}

export default function LeafletMap({ address, height = 250, zoom = 15 }: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef       = React.useRef<any>(null);
  const [state, setState] = React.useState<"loading" | "ok" | "error">("loading");

  React.useEffect(() => {
    if (!address) return;
    let destroyed = false;

    // Debounce 400ms: se l'address cambia velocemente (es. apertura drawer rapida)
    // aspetta prima di fare la richiesta a Nominatim
    const timer = setTimeout(async () => {
      setState("loading");
      try {
        await loadLeaflet();
        const coords = await geocode(address);
        if (destroyed) return;
        if (!coords) { setState("error"); return; }

        if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

        const L = window.L;
        const map = L.map(containerRef.current!, {
          center: [coords.lat, coords.lon],
          zoom,
          zoomControl: true,
          scrollWheelZoom: false,
          attributionControl: false,
        });
        mapRef.current = map;

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          { subdomains: "abcd", maxZoom: 19 }
        ).addTo(map);

        const icon = L.divIcon({
          className: "",
          html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;
            background:#0f766e;transform:rotate(-45deg);
            border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25);"></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        });
        L.marker([coords.lat, coords.lon], { icon })
          .addTo(map)
          .bindPopup(`<b style="font-size:13px">${address}</b>`)
          .openPopup();

        setState("ok");
      } catch {
        if (!destroyed) setState("error");
      }
    }, 400);

    return () => { clearTimeout(timer); destroyed = true; };
  }, [address, zoom]);

  React.useEffect(() => {
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  return (
    <Box sx={{ position: "relative", height, width: "100%" }}>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      {state === "loading" && (
        <Box sx={{ position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center", bgcolor: "#f8fafc" }}>
          <CircularProgress size={24} sx={{ color: "#0f766e" }} />
        </Box>
      )}
      {state === "error" && (
        <Box sx={{ position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          bgcolor: "#f8fafc", flexDirection: "column", gap: 0.5 }}>
          <Typography variant="body2" sx={{ opacity: 0.5 }}>📍</Typography>
          <Typography variant="caption" sx={{ opacity: 0.5 }}>Indirizzo non trovato</Typography>
        </Box>
      )}
    </Box>
  );
}
