import * as React from 'react'
import { Box, Button, ButtonBase, InputBase, Typography } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { CampoIcon, type CampoIconName } from '../ui/campo'
import { useOwnPageHeader } from '../layout/PageHeaderContext'
import { useModules } from '../modules/useModules'

const LINKS: { label: string; to: string; icon: CampoIconName }[] = [
  { label: 'Dashboard', to: '/', icon: 'dashboard' },
  { label: 'Issue', to: '/issues', icon: 'alert' },
  { label: 'Clienti', to: '/customers', icon: 'building' },
  { label: 'Inventari', to: '/inventory', icon: 'server' },
  { label: 'Wiki', to: '/wiki', icon: 'book' },
]

/** Pagina non trovata (anteprima mr-base, variante A · Sobria): dentro l'app, con ricerca e scorciatoie. */
export default function NotFound() {
  useOwnPageHeader()
  const nav = useNavigate()
  const loc = useLocation()
  const [q, setQ] = React.useState('')
  const { isPathHidden } = useModules()
  const search = () => { const t = q.trim(); nav(t ? `/search?search=${encodeURIComponent(t)}` : '/search') }
  const digit = (ch: string, tone: 'mint' | 'sky', rotate = 0) => (
    <Box component="span" sx={{
      display: 'inline-block', transform: rotate ? `rotate(${rotate}deg)` : undefined,
      color: (t) => t.palette.archie.tints[tone].bg, WebkitTextStroke: (t) => `2px ${t.palette.archie.tints[tone].mid}`,
    }}>{ch}</Box>
  )
  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', mt: { xs: 3, md: '6vh' }, px: 1, textAlign: 'center', display: 'grid', justifyItems: 'center', gap: 1.75 }}>
      <Box aria-hidden sx={{ display: 'flex', gap: 0.75, fontSize: { xs: 84, sm: 120 }, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em', userSelect: 'none', mb: 0.5 }}>
        {digit('4', 'mint')}{digit('0', 'sky', -8)}{digit('4', 'mint')}
      </Box>
      <Typography component="h1" sx={{ fontSize: 24, fontWeight: 700 }}>Questa pagina non esiste</Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.6, maxWidth: 460 }}>
        L'indirizzo{' '}
        <Box component="code" sx={{ fontFamily: '"Geist Mono", ui-monospace, monospace', fontSize: 12.5, bgcolor: 'archie.neutralBg', color: 'text.primary', px: 0.75, py: '1px', borderRadius: '4px', overflowWrap: 'anywhere' }}>{loc.pathname}</Box>{' '}
        non porta da nessuna parte: forse è stato scritto male o l'elemento è stato eliminato.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center', mt: 0.5 }}>
        <Button variant="outlined" onClick={() => nav(-1)} startIcon={<CampoIcon name="chevL" size={15} />}>Torna indietro</Button>
        <Button variant="contained" onClick={() => nav('/')} startIcon={<CampoIcon name="dashboard" size={15} />}>Vai alla Dashboard</Button>
      </Box>
      <Box component="form" role="search" onSubmit={(e: React.FormEvent) => { e.preventDefault(); search() }} sx={{
        display: 'flex', alignItems: 'center', gap: 1.25, width: '100%', maxWidth: 440, height: 42, px: 1.5, mt: 1.25,
        border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper', color: 'text.secondary',
        '&:focus-within': { borderColor: 'primary.main', boxShadow: (t) => t.palette.archie.focusRing },
      }}>
        <CampoIcon name="search" size={17} />
        <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca in Archie: clienti, siti, inventari, wiki…"
          inputProps={{ 'aria-label': 'Cerca in Archie' }} sx={{ flex: 1, fontSize: 13.5 }} />
        <Box component="kbd" sx={{ fontSize: 11, border: '1px solid', borderColor: 'divider', borderRadius: '4px', px: 0.6, fontFamily: 'inherit' }}>Invio</Box>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'center', alignItems: 'center', fontSize: 12.5, color: 'text.secondary' }}>
        <Box component="span" sx={{ mr: 0.5 }}>Oppure vai a</Box>
        {LINKS.filter((l) => !isPathHidden(l.to)).map((l) => (
          <ButtonBase key={l.to} onClick={() => nav(l.to)} sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.6, height: 28, px: 1.25, borderRadius: '14px', border: '1px solid', borderColor: 'divider',
            bgcolor: 'background.paper', color: 'text.primary', fontSize: 12.5, fontWeight: 550, '&:hover': { borderColor: 'text.disabled' },
            '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
          }}><Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex' }}><CampoIcon name={l.icon} size={14} /></Box>{l.label}</ButtonBase>
        ))}
      </Box>
    </Box>
  )
}
