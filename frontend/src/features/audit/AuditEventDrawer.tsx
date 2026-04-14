/**
 * AuditEventDrawer — drawer di dettaglio per gli eventi di audit.
 * Estratto dall'inline di Audit.tsx.
 */
import * as React from 'react'
import { Box, CircularProgress, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import { useNavigate } from 'react-router-dom'
import { DrawerShell, HERO_ICON_BTN_SX } from '@shared/ui/DrawerShell'
import { DrawerEmptyState } from '@shared/ui/DrawerParts'
import { buildQuery } from '@shared/utils/nav'
import { isRecord } from '@shared/utils/guards'
import AuditActionChip, { type AuditAction } from '../../ui/AuditActionChip'
import AuditDiffTable from '../../ui/AuditDiffTable'

// ─── Tipo ─────────────────────────────────────────────────────────────────────

export type AuditEventDetail = {
  id: number
  created_at: string
  action: AuditAction
  actor: number | null
  actor_username?: string | null
  actor_email?: string | null
  content_type_app?: string
  content_type_model?: string
  object_id?: string
  object_repr?: string
  subject?: string
  changes?: unknown
  entity_path?: string | null
  path?: string | null
  method?: string | null
  ip_address?: string | null
  user_agent?: string | null
  metadata_summary?: Record<string, unknown> | null
}

// ─── Helper ───────────────────────────────────────────────────────────────────

const ENTITY_LABELS: Record<string, string> = {
  'crm.customer': 'Clienti', 'crm.site': 'Siti', 'crm.contact': 'Contatti',
  'crm.customervpnaccess': 'VPN cliente', 'inventory.inventory': 'Inventari',
  'issues.issue': 'Issue', 'maintenance.tech': 'Tecnici',
  'maintenance.maintenanceplan': 'Piani di manutenzione',
  'maintenance.maintenanceplaninventory': 'Piani di manutenzione',
  'maintenance.maintenancetemplate': 'Template di manutenzione',
  'maintenance.maintenanceevent': 'Eventi di manutenzione',
  'maintenance.maintenancenotification': 'Notifiche di manutenzione',
  'wiki.wikipage': 'Pagine wiki', 'wiki.wikicategory': 'Categorie wiki',
  'wiki.wikiattachment': 'Allegati wiki', 'wiki.wikilink': 'Link wiki',
  'wiki.wikiquery': 'Query', 'feedback.reportrequest': 'Feedback',
  'drive.drivefolder': 'Cartelle drive', 'drive.drivefile': 'File drive',
  'custom_fields.customfielddefinition': 'Definizioni campi custom', 'auth.user': 'Utenti',
}

function fmt(ts?: string | null) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString()
}

async function copyToClipboard(text: string) {
  if (!text) return
  await navigator.clipboard.writeText(text)
}

function entityKey(app?: string, model?: string) {
  return `${(app||'').toLowerCase()}.${(model||'').toLowerCase()}`
}

function entityLabelForEvent(ev: Pick<AuditEventDetail, 'content_type_app'|'content_type_model'|'action'>): string {
  const key = entityKey(ev.content_type_app, ev.content_type_model)
  if (ENTITY_LABELS[key]) return ENTITY_LABELS[key]
  const action = String(ev.action || '').toLowerCase()
  if (['login','login_failed','logout'].includes(action)) return 'Autenticazione'
  return 'Sistema'
}

function openEntityPath(ev: AuditEventDetail): string | null {
  if (ev.entity_path) return ev.entity_path
  const app = (ev.content_type_app || '').toLowerCase()
  const model = (ev.content_type_model || '').toLowerCase()
  const oid = ev.object_id ? Number(ev.object_id) : NaN
  if (!Number.isFinite(oid)) return null
  if (app === 'crm' && model === 'customer') return `/customers${buildQuery({ open: oid })}`
  if (app === 'crm' && model === 'site') return `/sites${buildQuery({ open: oid })}`
  if (app === 'crm' && model === 'contact') return `/contacts${buildQuery({ open: oid })}`
  if (app === 'inventory' && model === 'inventory') return `/inventory${buildQuery({ open: oid })}`
  if (app === 'maintenance' && model === 'maintenanceplan') return `/maintenance${buildQuery({ tab: 'plans', open: oid })}`
  if (app === 'maintenance' && model === 'maintenanceevent') return `/maintenance${buildQuery({ tab: 'events', open: oid })}`
  if (app === 'maintenance' && model === 'maintenancenotification') return `/maintenance${buildQuery({ tab: 'notifications', open: oid })}`
  if (app === 'maintenance' && model === 'tech') return `/maintenance${buildQuery({ tab: 'techs', open: oid })}`
  if (app === 'issues' && model === 'issue') return `/issues${buildQuery({ open: oid })}`
  if (app === 'wiki' && model === 'wikipage') return `/wiki/${oid}`
  if (app === 'drive' && (model === 'drivefolder' || model === 'drivefile')) return '/drive'
  return null
}

function isAuditChanges(v: unknown): v is Record<string, { from: unknown; to: unknown }> {
  if (!isRecord(v)) return false
  const entries = Object.entries(v)
  if (!entries.length) return false
  return entries.some(([, ch]) => isRecord(ch) && 'from' in ch && 'to' in ch)
}

function toComparableAuditValue(v: unknown): string {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (v === '') return ''
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return `${typeof v}:${String(v)}`
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    const hasId = typeof obj.id === 'number' || typeof obj.id === 'string'
    const hasRepr = typeof obj.repr === 'string'
    if (hasId || hasRepr) return `id:${hasId ? String(obj.id) : ''}|repr:${hasRepr ? String(obj.repr) : ''}`
    try { return `json:${JSON.stringify(v)}` } catch { return `obj:${String(v)}` }
  }
  return `other:${String(v)}`
}

function hasVisibleAuditDiffs(v: unknown): boolean {
  if (!isAuditChanges(v)) return false
  return Object.values(v).some((ch) => toComparableAuditValue(ch?.from) !== toComparableAuditValue(ch?.to))
}

function fmtMetaValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  try { return JSON.stringify(v) } catch { return String(v) }
}

function isMetadataSummary(v: unknown): v is Record<string, unknown> {
  return isRecord(v) && Object.keys(v).length > 0
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }} spacing={2}>
      <Typography variant="caption" sx={{ color: 'text.disabled' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right', maxWidth: 300, wordBreak: 'break-word' }}>{value}</Typography>
    </Stack>
  )
}

function SectionBox({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ bgcolor: '#f8fafc', border: '1px solid', borderColor: 'grey.200', borderRadius: 1, p: 1.75 }}>
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        {icon}{title}
      </Typography>
      <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'grey.50' }} />}>
        {children}
      </Stack>
    </Box>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AuditEventDrawerProps {
  open: boolean
  onClose: () => void
  detail: AuditEventDetail | null
  detailLoading: boolean
  selectedId: number | null
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function AuditEventDrawer({ open, onClose, detail, detailLoading, selectedId }: AuditEventDrawerProps) {
  const nav = useNavigate()
  const entityPath = detail ? openEntityPath(detail) : null

  const statusSlot = detail ? (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <Tooltip title="Chiudi">
        <IconButton size="small" onClick={onClose} sx={HERO_ICON_BTN_SX}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <AuditActionChip action={detail.action} size="medium" />
    </Stack>
  ) : undefined

  const actions = (
    <>
      <Tooltip title="Copia ID">
        <span>
          <IconButton size="small" onClick={() => detail && void copyToClipboard(String(detail.id))} disabled={!detail} sx={HERO_ICON_BTN_SX}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      {entityPath ? (
        <Tooltip title="Apri oggetto">
          <IconButton size="small" onClick={() => nav(entityPath)} sx={HERO_ICON_BTN_SX}>
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null}
    </>
  )

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      width={460}
      gradient="teal"
      statusSlot={statusSlot}
      actions={actions}
      title={detail?.subject || detail?.object_repr || (selectedId ? `Evento #${selectedId}` : 'Evento')}
      subtitle={detail ? `${entityLabelForEvent(detail)}${detail.created_at ? ` • ${fmt(detail.created_at)}` : ''}` : undefined}
      loading={detailLoading}
    >
      {detailLoading ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" sx={{ opacity: 0.7 }}>Caricamento…</Typography>
        </Stack>
      ) : !detail ? <DrawerEmptyState label="—" /> : (
        <Stack spacing={1.5}>
          <SectionBox icon={<HistoryEduOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Evento">
            <FieldRow label="Tipo" value={entityLabelForEvent(detail)} />
            <FieldRow label="ID evento" value={detail.id} />
            <FieldRow label="Oggetto" value={detail.subject || detail.object_repr || '—'} />
            <FieldRow label="Quando" value={fmt(detail.created_at)} />
          </SectionBox>

          <SectionBox icon={<PersonOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Utente">
            <FieldRow label="Username" value={detail.actor_username || '—'} />
            <FieldRow label="Email" value={detail.actor_email || '—'} />
            <FieldRow label="IP" value={detail.ip_address || '—'} />
          </SectionBox>

          {isMetadataSummary(detail.metadata_summary) ? (
            <Box sx={{ bgcolor: '#fff', borderRadius: 1, border: '1px solid', borderColor: 'grey.200', overflow: 'hidden' }}>
              <Box sx={{ px: 1.75, pt: 1.5, pb: 1.0 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <HistoryEduOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />Metadati
                </Typography>
              </Box>
              <Box sx={{ borderTop: '1px solid', borderColor: 'grey.100', px: 1.75, py: 1.25 }}>
                <Stack spacing={1}>
                  {Object.entries(detail.metadata_summary).map(([key, value]) => (
                    <Stack key={key} direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>{key}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right', maxWidth: 320, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{fmtMetaValue(value)}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Box>
          ) : null}

          {detail.action === 'update' && hasVisibleAuditDiffs(detail.changes) ? (
            <Box sx={{ bgcolor: '#fff', borderRadius: 1, border: '1px solid', borderColor: 'grey.200', overflow: 'hidden' }}>
              <Box sx={{ px: 1.75, pt: 1.5, pb: 1.0 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <NotesOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />Modifiche
                </Typography>
              </Box>
              <Box sx={{ borderTop: '1px solid', borderColor: 'grey.100', px: 1.75, py: 1.25,
                '& .MuiTableCell-root': { fontSize: 13, borderColor: 'grey.100', verticalAlign: 'top', fontFamily: 'inherit' },
                '& .MuiTableHead-root .MuiTableCell-root': { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.disabled', bgcolor: '#f8fafc' },
                '& .MuiTableBody-root .MuiTableCell-root:first-of-type': { fontWeight: 700, color: 'text.primary' },
                '& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even)': { bgcolor: 'rgba(15,118,110,0.03)' },
              }}>
                <AuditDiffTable changes={detail.changes as Record<string, { from: unknown; to: unknown }>} emptyLabel="Nessuna differenza registrata." />
              </Box>
            </Box>
          ) : null}
        </Stack>
      )}
    </DrawerShell>
  )
}
