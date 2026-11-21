import * as React from 'react'
import { Box, Button, ButtonBase, CircularProgress, InputBase, Typography } from '@mui/material'

import { CampoDialog, CampoIcon } from '../../ui/campo'
import type { InventoryOption } from './types'

type Props = {
  open: boolean
  customerName?: string | null
  /** Sito della issue: i suoi inventari vengono per primi. */
  siteName?: string | null
  options: InventoryOption[]
  loading: boolean
  currentId: number | null
  saving: boolean
  onClose: () => void
  onLink: (inv: InventoryOption | null) => void
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const mono = { fontFamily: '"Geist Mono", monospace' }

/**
 * «Collega un inventario» della issue, con lo stesso schema del selettore inventario dell'inserimento rapido
 * (anteprima fm-base): elenco cercabile per nome, K-number, hostname o seriale, prima il sito della issue.
 */
export default function LinkInventoryDialog({ open, customerName, siteName, options, loading, currentId, saving, onClose, onLink }: Props) {
  const [q, setQ] = React.useState('')
  const [picked, setPicked] = React.useState<number | null>(currentId)
  React.useEffect(() => { if (open) { setQ(''); setPicked(currentId) } }, [open, currentId])

  const term = norm(q.trim())
  const visible = options.filter((o) => !term || [o.name, o.knumber, o.hostname, o.serial_number, o.type_label].some((x) => x && norm(x).includes(term)))
  const sameSite = siteName ? visible.filter((o) => o.site_name === siteName) : []
  const others = siteName ? visible.filter((o) => o.site_name !== siteName) : visible
  const groups: [string | null, InventoryOption[]][] = siteName ? [['Nel sito della issue', sameSite], ['Altri siti del cliente', others]] : [[null, others]]
  const pickedOpt = options.find((o) => o.id === picked) ?? null

  const row = (o: InventoryOption) => {
    const on = picked === o.id
    return (
      <ButtonBase key={o.id} role="option" aria-selected={on} onClick={() => setPicked(o.id)} onDoubleClick={() => { if (o.id !== currentId) onLink(o) }}
        sx={{ display: 'grid', gridTemplateColumns: '18px minmax(0,1fr) auto', gap: 1.25, alignItems: 'center', width: '100%', textAlign: 'left', px: 1.25, py: 0.875, borderRadius: '6px',
          bgcolor: on ? 'archie.field' : 'transparent', '&:hover': { bgcolor: on ? 'archie.field' : 'archie.surface2' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing } }}>
        <Box sx={{ color: on ? 'primary.main' : 'text.secondary', display: 'inline-flex' }}><CampoIcon name={on ? 'check' : 'server'} size={16} /></Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap component="b" sx={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{o.name}</Typography>
          <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>
            {[o.type_label, o.site_name].filter(Boolean).join(' · ')}
            {o.knumber ? <> · <Box component="span" sx={mono}>{o.knumber}</Box></> : null}
            {o.hostname ? <> · <Box component="span" sx={mono}>{o.hostname}</Box></> : null}
          </Typography>
        </Box>
        {o.id === currentId ? <Box component="span" sx={{ fontSize: 11.5, fontWeight: 600, color: 'primary.main', bgcolor: 'archie.field', px: 0.75, py: 0.25, borderRadius: '5px' }}>collegato</Box> : <span />}
      </ButtonBase>
    )
  }

  return (
    <CampoDialog open={open} onClose={onClose} busy={saving} width={560} labelId="link-inv-title" title="Collega un inventario"
      sub={customerName ? `Inventari di ${customerName}` : undefined}
      footer={<>
        <Button onClick={onClose} disabled={saving}>Annulla</Button>
        {currentId ? <Button color="warning" variant="outlined" onClick={() => onLink(null)} disabled={saving}>Scollega</Button> : null}
        <Button variant="contained" onClick={() => onLink(pickedOpt)} disabled={saving || !pickedOpt || picked === currentId}>
          {saving ? <CircularProgress size={15} sx={{ mr: 1, color: 'inherit' }} /> : null}Collega
        </Button>
      </>}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: 38, px: 1.25, mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: '8px', color: 'text.secondary',
        '&:focus-within': { borderColor: 'primary.main', boxShadow: (t) => t.palette.archie.focusRing } }}>
        <CampoIcon name="search" size={16} />
        <InputBase autoFocus fullWidth value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, K-number, hostname o seriale"
          inputProps={{ 'aria-label': 'Cerca inventario' }} sx={{ fontSize: 13.5, color: 'text.primary' }} />
      </Box>
      <Box role="listbox" aria-label="Inventari" sx={{ maxHeight: '46vh', overflowY: 'auto', mx: -0.5 }}>
        {loading ? <Box sx={{ py: 3, display: 'grid', placeItems: 'center' }}><CircularProgress size={20} /></Box>
          : !options.length ? <Typography sx={{ fontSize: 13, color: 'text.secondary', px: 1, py: 2 }}>Nessun inventario per questo cliente.</Typography>
          : !visible.length ? <Typography sx={{ fontSize: 13, color: 'text.secondary', px: 1, py: 2 }}>Nessun inventario corrisponde a «{q.trim()}».</Typography>
          : groups.filter(([, list]) => list.length).map(([label, list]) => (
            <Box key={label ?? 'all'} role="group" aria-label={label ?? 'Inventari'}>
              {label ? <Typography sx={{ fontSize: 12, fontWeight: 550, color: 'text.secondary', px: 1.25, pt: 1, pb: 0.5 }}>{label}</Typography> : null}
              {list.map(row)}
            </Box>
          ))}
      </Box>
    </CampoDialog>
  )
}
