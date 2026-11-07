import { Box } from '@mui/material'
import { CampoIcon } from '../../ui/campo'
import { Ava } from '../pianoferie/pfUi'
import { actionMeta, actorLabel, changeEntries, entityIcon, entityLabel, fieldLabel, fmtValue, isSecretField, objectTitle, type AuditEvent } from './auditModel'

const TONE = {
  success: { bgcolor: 'success.light', color: 'success.main' },
  info: { bgcolor: 'info.light', color: 'info.main' },
  error: { bgcolor: 'error.light', color: 'error.main' },
  neutral: { bgcolor: 'archie.neutralBg', color: 'text.secondary' },
} as const

export function AuditActionBadge({ action, onDark }: { action: string; onDark?: boolean }) {
  const m = actionMeta(action)
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 22, px: 1, borderRadius: '5px', fontSize: 12, fontWeight: 550, whiteSpace: 'nowrap', ...TONE[m.tone], ...(onDark && m.tone === 'neutral' ? { bgcolor: 'rgba(255,255,255,.14)', color: '#fff' } : {}) }}>
      {m.label}
    </Box>
  )
}

/** Avatar di chi ha agito: persona, sistema (⟳) o utente non riconosciuto (?). */
export function ActorAvatar({ ev, size = 24 }: { ev: AuditEvent; size?: number }) {
  const a = actorLabel(ev)
  if (a.kind === 'user') return <Ava name={a.name} size={size} sx={{ lineHeight: 1 }} />
  return (
    <Box component="span" aria-hidden sx={{
      display: 'inline-grid', placeItems: 'center', flex: 'none', width: size, height: size, lineHeight: 1, borderRadius: '50%', fontSize: Math.round(size * 0.45), fontWeight: 650,
      ...(a.kind === 'system' ? { bgcolor: 'archie.field', color: 'primary.main' } : { bgcolor: 'error.light', color: 'error.main' }),
    }}>{a.kind === 'system' ? '⟳' : '?'}</Box>
  )
}

export function ActorCell({ ev }: { ev: AuditEvent }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minWidth: 0, lineHeight: 1.3 }}>
      <ActorAvatar ev={ev} />
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{actorLabel(ev).name}</Box>
    </Box>
  )
}

export function ObjectCell({ ev }: { ev: AuditEvent }) {
  const failed = ev.action === 'login_failed'
  return (
    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1.1, minWidth: 0, color: failed ? 'error.main' : 'text.secondary' }}>
      <CampoIcon name={entityIcon(ev)} size={16} />
      <Box component="span" sx={{ display: 'grid', minWidth: 0, lineHeight: 1.3 }}>
        <Box component="b" sx={{ fontWeight: 550, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{objectTitle(ev)}</Box>
        <Box component="small" sx={{ fontSize: 11.5, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entityLabel(ev)}{failed && ev.ip_address ? ` · da ${ev.ip_address}` : ''}
        </Box>
      </Box>
    </Box>
  )
}

/** Primo campo cambiato su una riga: "Stato In lavorazione → Risolta +1". */
export function ChangeSummary({ ev }: { ev: AuditEvent }) {
  const ch = changeEntries(ev.changes)
  if (!ch.length) return <Box component="span" sx={{ color: 'archie.textFaint' }}>—</Box>
  const c = ch[0]
  const empty = <Box component="span" sx={{ color: 'archie.textFaint' }}>vuoto</Box>
  const v = (x: unknown) => fmtValue(x) ?? empty
  return (
    <Box component="span" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, color: 'text.secondary' }}>
      <Box component="b" sx={{ color: 'text.primary', fontWeight: 550, mr: 0.5 }}>{fieldLabel(c.field)}</Box>
      {isSecretField(c.field) ? <Box component="span" sx={{ color: 'archie.textFaint' }}>cambiata</Box>
        : ev.action === 'create' || !c.hasFrom ? v(c.to)
          : <>{v(c.from)} <Box component="span" sx={{ color: 'archie.textFaint' }}>→</Box> {v(c.to)}</>}
      {ch.length > 1 ? <Box component="span" sx={{ ml: 0.75, fontSize: 11, fontWeight: 600, bgcolor: 'archie.neutralBg', color: 'text.secondary', borderRadius: '4px', px: 0.6, lineHeight: '17px', display: 'inline-block' }}>+{ch.length - 1}</Box> : null}
    </Box>
  )
}
