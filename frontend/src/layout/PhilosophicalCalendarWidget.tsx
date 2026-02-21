import * as React from "react";
import { Box, Tooltip, Typography } from "@mui/material";

// Metti phrases.txt in: src/assets/phrases.txt
// Vite: import raw del file di testo (una frase per riga)
import phrasesRaw from "../assets/phrases.txt?raw";

function parsePhrases(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("#"));
}

const FALLBACK_PHRASES: string[] = [
  "Oggi scegli una cosa sola e falla bene.",
  "La disciplina crea libertà.",
  "Piccoli passi, ogni giorno.",
  "Meno rumore. Più intenzione.",
  "La chiarezza è gentilezza verso te stesso.",
];

const TZ = "Europe/Rome";

function getDayKey(timeZone = TZ): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function formatTodayLabel(timeZone = TZ): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function pickPhrase(dayKey: string, phrases: string[]): string {
  const list = phrases.length ? phrases : FALLBACK_PHRASES;
  // hash deterministico (stabile per il giorno)
  let h = 0;
  for (let i = 0; i < dayKey.length; i++) h = (h * 31 + dayKey.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

export default function PhilosophicalCalendarWidget() {
  const phrases = React.useMemo(() => {
    const parsed = parsePhrases(phrasesRaw);
    return parsed.length ? parsed : FALLBACK_PHRASES;
  }, []);

  const [dayKey, setDayKey] = React.useState(() => getDayKey(TZ));
  const [dateLabel, setDateLabel] = React.useState(() => formatTodayLabel(TZ));

  // Aggiorna automaticamente a mezzanotte (controllo ogni 30s: leggerissimo)
  React.useEffect(() => {
    const t = window.setInterval(() => {
      const dk = getDayKey(TZ);
      if (dk !== dayKey) {
        setDayKey(dk);
        setDateLabel(formatTodayLabel(TZ));
      }
    }, 30_000);

    return () => window.clearInterval(t);
  }, [dayKey]);

  const phrase = React.useMemo(() => pickPhrase(dayKey, phrases), [dayKey, phrases]);

  return (
    <Tooltip title={phrase}>
      <Box
        sx={{
          px: 1.75,
          py: 1,
          borderRadius: 2,
          bgcolor: "background.paper",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          maxWidth: { xs: 360, md: 720 },
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
          {dateLabel}
        </Typography>

        {/* niente ellipsis: la frase va a capo */}
        <Typography
          variant="body2"
          sx={{
            fontWeight: 900,
            whiteSpace: "normal",
            overflow: "visible",
            textOverflow: "clip",
            lineHeight: 1.25,
          }}
        >
          {phrase}
        </Typography>
      </Box>
    </Tooltip>
  );
}
