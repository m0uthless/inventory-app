import * as React from "react";
import { Chip, Tooltip } from "@mui/material";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import CloudIcon from "@mui/icons-material/Cloud";
import ThunderstormIcon from "@mui/icons-material/Thunderstorm";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import GrainIcon from "@mui/icons-material/Grain";
import FoggyIcon from "@mui/icons-material/Foggy";

type WeatherData = {
  tempC: number;
  code: number;
  windKmh: number;
  updatedAtIso: string;
};

type WeatherState =
  | { status: "idle" | "loading"; city: string }
  | { status: "ready"; city: string; data: WeatherData }
  | { status: "error"; city: string; message: string };

function codeToLabelIt(code: number) {
  if (code === 0) return "Sereno";
  if (code >= 1 && code <= 3) return "Poco/Parz. nuvoloso";
  if (code === 45 || code === 48) return "Nebbia";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "Pioggia";
  if (code >= 71 && code <= 77) return "Neve";
  if (code >= 95 && code <= 99) return "Temporale";
  return "Meteo";
}

function codeToIcon(code: number) {
  if (code === 0) return <WbSunnyIcon fontSize="small" />;
  if (code >= 1 && code <= 3) return <CloudIcon fontSize="small" />;
  if (code === 45 || code === 48) return <FoggyIcon fontSize="small" />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return <GrainIcon fontSize="small" />;
  if (code >= 71 && code <= 77) return <AcUnitIcon fontSize="small" />;
  if (code >= 95 && code <= 99) return <ThunderstormIcon fontSize="small" />;
  return <CloudIcon fontSize="small" />;
}

const TTL_MS = 10 * 60 * 1000; // cache 10 minuti

export default function WeatherWidget({ city }: { city: string }) {
  const [state, setState] = React.useState<WeatherState>({ status: "idle", city });

  const fetchWeather = React.useCallback(
    async (force = false, signal?: AbortSignal) => {
      const key = `weather:${city.toLowerCase()}`;
      const cached = localStorage.getItem(key);

      if (!force && cached) {
        try {
          const parsed = JSON.parse(cached) as { ts: number; data: WeatherData };
          if (Date.now() - parsed.ts < TTL_MS) {
            setState({ status: "ready", city, data: parsed.data });
            return;
          }
        } catch {
          // ignore cache errors
        }
      }

      setState({ status: "loading", city });

      try {
        // 1) Geocoding città -> lat/lon
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          city
        )}&count=1&language=it&format=json`;

        const geoRes = await fetch(geoUrl, { signal });
        if (!geoRes.ok) throw new Error("Geocoding non disponibile");
        const geoJson = await geoRes.json();
        const first = geoJson?.results?.[0];
        if (!first) throw new Error("Città non trovata");

        const { latitude, longitude } = first as { latitude: number; longitude: number };

        // 2) Meteo corrente
        const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`;
        const wRes = await fetch(wUrl, { signal });
        if (!wRes.ok) throw new Error("Meteo non disponibile");
        const wJson = await wRes.json();

        const cw = wJson?.current_weather;
        if (!cw) throw new Error("Dati meteo mancanti");

        const data: WeatherData = {
          tempC: Number(cw.temperature),
          code: Number(cw.weathercode),
          windKmh: Number(cw.windspeed),
          updatedAtIso: String(cw.time),
        };

        localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
        setState({ status: "ready", city, data });
      } catch (e: any) {
        // AbortError è atteso quando il componente viene smontato: non aggiornare lo stato
        if (e?.name === "AbortError") return;
        setState({
          status: "error",
          city,
          message: e?.message ?? "Errore meteo",
        });
      }
    },
    [city]
  );

  React.useEffect(() => {
    const controller = new AbortController();

    fetchWeather(false, controller.signal);

    // Aggiornamento periodico ogni 15 min, passando lo stesso signal
    const t = window.setInterval(() => fetchWeather(false, controller.signal), 15 * 60 * 1000);

    return () => {
      // Annulla fetch in corso e ferma il timer quando il componente viene smontato
      controller.abort();
      window.clearInterval(t);
    };
  }, [fetchWeather]);

const chipSx = {
  bgcolor: "background.paper",
  border: "none",
  height: 34,
  "& .MuiChip-label": { fontSize: 14, fontWeight: 700, px: 1 },
  "& .MuiChip-icon": { fontSize: 20, ml: 1 },
} as const;

  // Render tip-safe (switch sul discriminante)
  switch (state.status) {
    case "idle":
    case "loading":
      return (
<Chip
  size="medium"
  icon={<CloudIcon />}
  label="Meteo…"
  variant="filled"
  sx={chipSx}
/>

      );

    case "error":
      return (
        <Tooltip title={`${state.message} • click per riprovare`}>
<Chip
  size="medium"
  icon={<CloudIcon />}
  label={`${state.city}: N/D`}
  variant="filled"
  sx={{ ...chipSx, cursor: "pointer" }}
  onClick={() => fetchWeather(true)}
/>

        </Tooltip>
      );

    case "ready": {
      const { tempC, code, windKmh, updatedAtIso } = state.data;
      const desc = codeToLabelIt(code);

      return (
        <Tooltip title={`${desc} • vento ${Math.round(windKmh)} km/h • agg. ${updatedAtIso} (click refresh)`}>
<Chip
  size="medium"
  icon={codeToIcon(code)}
  label={`${state.city}: ${Math.round(tempC)}°`}
  variant="filled"
  sx={{ ...chipSx, cursor: "pointer" }}
  onClick={() => fetchWeather(true)}
/>

        </Tooltip>
      );
    }
  }
}
