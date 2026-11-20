import * as React from 'react'
import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import { api } from '@shared/api/client'
import { copyToClipboard } from '@shared/utils/clipboard'
import { useToast } from '@shared/ui/toast'

import { useAuth } from '../../auth/AuthProvider'
import { CampoIcon } from '../../ui/campo'

type Secrets = { os_user?: string | null; os_pwd?: string | null; app_usr?: string | null; app_pwd?: string | null; vnc_pwd?: string | null }
type Row = { key: keyof Secrets; group: string; label: string; secret: boolean }

const ROWS: Row[] = [
  { key: 'os_user', group: 'Sistema operativo', label: 'Utente', secret: false },
  { key: 'os_pwd', group: 'Sistema operativo', label: 'Password', secret: true },
  { key: 'app_usr', group: 'Applicazione', label: 'Utente', secret: false },
  { key: 'app_pwd', group: 'Applicazione', label: 'Password', secret: true },
  { key: 'vnc_pwd', group: 'Accesso remoto VNC', label: 'Password', secret: true },
]
const SHOW_MS = 30_000
const countdown = keyframes`from { width: 100% } to { width: 0 }`
const mono = { fontFamily: '"Geist Mono", monospace' }

/**
 * Credenziali dell'inventario in sola lettura (per «Dove intervenire» della issue), con lo stesso
 * comportamento della finestra dell'inventario: password mascherate, «Mostra» per 30 secondi, copia.
 * Senza il permesso Credenziali (`inventory.view_secrets`) non si chiedono e non si mostrano.
 */
export default function InventoryCredentials({ inventoryId }: { inventoryId: number }) {
  const { hasPerm } = useAuth()
  const toast = useToast()
  const allowed = hasPerm('inventory.view_secrets')
  const [data, setData] = React.useState<Secrets | null>(null)
  const [shown, setShown] = React.useState<Partial<Record<keyof Secrets, boolean>>>({})

  React.useEffect(() => {
    if (!allowed) return
    let alive = true
    setData(null); setShown({})
    api.get<Secrets>(`/inventories/${inventoryId}/`).then((r) => { if (alive) setData(r.data) }).catch(() => { if (alive) setData({}) })
    return () => { alive = false }
  }, [inventoryId, allowed])

  React.useEffect(() => {
    if (!Object.values(shown).some(Boolean)) return
    const t = window.setTimeout(() => setShown({}), SHOW_MS)
    return () => window.clearTimeout(t)
  }, [shown])

  const head = (text: React.ReactNode) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1 }}>
      <Box sx={{ color: 'text.secondary', display: 'inline-flex', width: 20, justifyContent: 'center' }}><CampoIcon name="key" size={18} /></Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Credenziali</Typography>
        <Typography component="div" sx={{ fontSize: 12, color: 'text.secondary' }}>{text}</Typography>
      </Box>
    </Box>
  )
  if (!allowed) return head(<Box component="span" sx={{ display: 'inline-flex', gap: 0.5, alignItems: 'center' }}><CampoIcon name="lock" size={12} />Serve il permesso Credenziali</Box>)
  if (data === null) return null
  const rows = ROWS.filter((r) => data[r.key])
  if (!rows.length) return head('Nessuna credenziale registrata')

  const copy = (value: string, what: string) => { void copyToClipboard(value).then(() => toast.success(`${what} copiata`)) }
  return (
    <Box>
      {head('Le password si nascondono da sole dopo 30 secondi')}
      <Box sx={{ display: 'grid', gap: 1, ml: 4 }}>
        {[...new Set(rows.map((r) => r.group))].map((group) => (
          <Box key={group}>
            <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>{group}</Typography>
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden' }}>
              {rows.filter((r) => r.group === group).map((r) => {
                const value = String(data[r.key] ?? '')
                const isShown = Boolean(shown[r.key])
                return (
                  <Box key={r.key} sx={{ position: 'relative', display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) auto', alignItems: 'center', gap: 1, minHeight: 36, pl: 1.25, pr: 0.5,
                    '& + &': { borderTop: '1px solid', borderColor: 'divider' }, ...(isShown ? { bgcolor: 'warning.light' } : {}) }}>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{r.label}</Typography>
                    <Box title={r.secret && !isShown ? undefined : value} sx={{ ...mono, fontSize: 12.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.secret && !isShown ? <Box component="span" aria-label="Password nascosta" sx={{ letterSpacing: '.12em', color: 'text.secondary' }}>••••••••</Box> : value}
                    </Box>
                    <Box sx={{ display: 'inline-flex' }}>
                      {r.secret ? (
                        <Tooltip title={isShown ? 'Nascondi' : 'Mostra · si nasconde dopo 30 secondi'}>
                          <IconButton size="small" aria-pressed={isShown} aria-label={`${isShown ? 'Nascondi' : 'Mostra'} la password`} onClick={() => setShown((st) => ({ ...st, [r.key]: !st[r.key] }))}
                            sx={{ width: 28, height: 28, color: isShown ? 'warning.main' : undefined }}><CampoIcon name={isShown ? 'eyeOff' : 'eye'} size={14} /></IconButton>
                        </Tooltip>
                      ) : null}
                      <Tooltip title="Copia"><IconButton size="small" aria-label={r.secret ? 'Copia la password' : "Copia l'utente"} onClick={() => copy(value, r.secret ? 'Password' : 'Utenza')} sx={{ width: 28, height: 28 }}><CampoIcon name="copy" size={14} /></IconButton></Tooltip>
                    </Box>
                    {isShown ? <Box aria-hidden sx={{ position: 'absolute', left: 0, bottom: 0, height: 2, bgcolor: 'warning.main', animation: `${countdown} 30s linear forwards`, '@media (prefers-reduced-motion: reduce)': { animation: 'none', width: '100%' } }} /> : null}
                  </Box>
                )
              })}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
