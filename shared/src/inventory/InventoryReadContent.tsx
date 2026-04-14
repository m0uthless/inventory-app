/**
 * InventoryReadContent — sezioni read-only del drawer Inventory.
 *
 * Renderizza: Identificazione / Rete / Hardware / Note / Tag / custom_fields.
 *
 * Slot opzionali per contenuto frontend-specifico:
 *  - header          → iniettato prima di Identificazione (bottoni nav, warning issue, K-Number)
 *  - credentialsSlot → iniettato tra Rete e Hardware (sezione credenziali frontend interno)
 *
 * Usato in:
 *  - frontend-auslbo (AuslBoInventoryDrawer) — senza slot
 *  - frontend (InventoryDrawer) — con header + credentialsSlot
 */

import * as React from 'react'
import { Chip, Stack, Typography } from '@mui/material'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import WifiOutlinedIcon from '@mui/icons-material/WifiOutlined'
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import { DrawerSection, DrawerFieldList } from '../ui/DrawerParts'
import { isRecord } from '../utils/guards'
import type { InventoryReadDetail } from './inventoryTypes'

// ─── Helper ───────────────────────────────────────────────────────────────────

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // noop
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface InventoryReadContentProps {
  detail: InventoryReadDetail
  /** Callback opzionale per notifica "copiato" (es. toast). Default: copia silente. */
  onCopied?: (value: string) => void
  /**
   * Slot iniettato prima di Identificazione.
   * Usato nel frontend principale per bottoni nav, alert issue attiva, K-Number plate.
   */
  header?: React.ReactNode
  /**
   * Slot iniettato tra Rete e Hardware.
   * Usato nel frontend principale per la sezione Credenziali (SecretRow).
   */
  credentialsSlot?: React.ReactNode
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function InventoryReadContent({
  detail,
  onCopied,
  header,
  credentialsSlot,
}: InventoryReadContentProps) {
  const handleCopy = async (v: string) => {
    await copyToClipboard(v)
    onCopied?.(v)
  }

  return (
    <>
      {/* ── Header slot (nav buttons, issue warning, K-Number) ──────────── */}
      {header ?? null}

      {/* ── Identificazione ─────────────────────────────────────────────── */}
      {[detail.name, detail.knumber, detail.serial_number, detail.site_display_name || detail.site_name].some(Boolean) ? (
        <DrawerSection
          icon={<FingerprintIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
          title="Identificazione"
        >
          <DrawerFieldList
            rows={[
              { label: 'Nome', value: detail.name },
              { label: 'Sede', value: detail.site_display_name || detail.site_name },
              { label: 'K-number', value: detail.knumber, mono: true, copy: true },
              { label: 'Seriale', value: detail.serial_number, mono: true, copy: true },
            ]}
            onCopy={(v) => void handleCopy(v)}
          />
        </DrawerSection>
      ) : null}

      {/* ── Rete ────────────────────────────────────────────────────────── */}
      {[detail.hostname, detail.local_ip, detail.srsa_ip].some(Boolean) ? (
        <DrawerSection
          icon={<WifiOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
          title="Rete"
        >
          <DrawerFieldList
            rows={[
              { label: 'Hostname', value: detail.hostname, mono: true, copy: true },
              { label: 'IP locale', value: detail.local_ip, mono: true, copy: true },
              { label: 'IP SRSA', value: detail.srsa_ip, mono: true, copy: true },
            ]}
            onCopy={(v) => void handleCopy(v)}
          />
        </DrawerSection>
      ) : null}

      {/* ── Credenziali slot (solo frontend interno) ─────────────────────── */}
      {credentialsSlot ?? null}

      {/* ── Hardware ────────────────────────────────────────────────────── */}
      {[
        detail.manufacturer,
        detail.model,
        detail.warranty_end_date,
        ...Object.values(detail.custom_fields ?? {}),
      ].some((v) => v != null && v !== '') ? (
        <DrawerSection
          icon={<MemoryOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
          title="Hardware"
        >
          <DrawerFieldList
            rows={[
              { label: 'Produttore', value: detail.manufacturer, labelMinWidth: 100 },
              { label: 'Modello', value: detail.model, labelMinWidth: 100 },
              { label: 'Fine garanzia', value: detail.warranty_end_date, mono: true, labelMinWidth: 100 },
              ...(detail.custom_fields && isRecord(detail.custom_fields)
                ? Object.entries(detail.custom_fields)
                    .filter(([, v]) => v != null && v !== '')
                    .map(([k, v]) => ({ label: k, value: String(v), labelMinWidth: 100 }))
                : []),
            ]}
          />
        </DrawerSection>
      ) : null}

      {/* ── Note ────────────────────────────────────────────────────────── */}
      {detail.notes ? (
        <DrawerSection
          icon={<NotesOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
          title="Note"
          variant="muted"
        >
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}
          >
            {detail.notes}
          </Typography>
        </DrawerSection>
      ) : null}

      {/* ── Tag ─────────────────────────────────────────────────────────── */}
      {detail.tags && detail.tags.length > 0 ? (
        <DrawerSection title="Tag" variant="muted">
          <Stack direction="row" flexWrap="wrap" spacing={0.5}>
            {detail.tags.map((t) => (
              <Chip key={t} label={t} size="small" variant="outlined" />
            ))}
          </Stack>
        </DrawerSection>
      ) : null}
    </>
  )
}
