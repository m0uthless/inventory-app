import { Avatar, Box, Button, Link, Typography } from '@mui/material'
import { CampoIcon, DetailSection, FloatingDetail, type DetailMenuItem } from '../../ui/campo'
import { formatOpenedAt, initialsOf, type ServiceNowCaseRow } from './snModel'

const MONO = { fontFamily: '"Geist Mono", ui-monospace, monospace' } as const

/** Scheda del caso: registrazione, non gestione (niente stato da cambiare). */
export default function CaseDetailCard({ c, busy, canChange, canDelete, menu, position, onPrev, onNext, onClose, onEdit, onDelete, onRestore }: {
  c: ServiceNowCaseRow; busy: boolean; canChange: boolean; canDelete: boolean; menu: DetailMenuItem[]
  position?: string; onPrev?: () => void; onNext?: () => void; onClose: () => void; onEdit: () => void; onDelete: () => void; onRestore: () => void
}) {
  const deleted = Boolean(c.deleted_at)
  const row = (label: string, value: React.ReactNode) => (
    <>
      <Typography component="dt" sx={{ fontSize: 13, color: 'text.secondary' }}>{label}</Typography>
      <Box component="dd" sx={{ m: 0, fontSize: 13, minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.75 }}>{value}</Box>
    </>
  )
  return (
    <FloatingDetail open onClose={onClose} ariaLabel="Dettaglio caso ServiceNow"
      idLabel={<Box component="span" sx={{ ...MONO, fontSize: 12 }}>{c.number}</Box>}
      status={deleted ? <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 22, px: 1, borderRadius: '5px', fontSize: 12, fontWeight: 550, bgcolor: 'rgba(255,255,255,.14)', color: '#fff' }}>Nel cestino</Box> : undefined}
      title={c.account} subtitle={[c.case_type_label, c.category_label, formatOpenedAt(c)].filter(Boolean).join(' · ')}
      position={position} onPrev={onPrev} onNext={onNext} menu={deleted ? undefined : menu}
      footer={deleted ? (
        <><Box sx={{ flex: 1 }} />{canChange ? <Button variant="contained" disabled={busy} onClick={onRestore} startIcon={<CampoIcon name="restore" size={15} />}>Ripristina</Button> : null}</>
      ) : (
        <>
          {canDelete ? <Button variant="outlined" disabled={busy} onClick={onDelete} startIcon={<CampoIcon name="trash" size={15} />}>Elimina</Button> : null}
          <Box sx={{ flex: 1 }} />
          {canChange ? <Button variant="contained" disabled={busy} onClick={onEdit}>Modifica</Button> : null}
        </>
      )}>
      <Box sx={{ display: 'grid', gap: 2.25 }}>
        <DetailSection title="Descrizione" end={c.external_url ? (
          <Link href={c.external_url} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ fontSize: 12.5, fontWeight: 550, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>Apri in ServiceNow <CampoIcon name="arrowR" size={12} /></Link>
        ) : undefined}>
          <Typography sx={{ fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: c.short_description ? 'text.primary' : 'text.secondary' }}>{c.short_description || 'Nessuna descrizione.'}</Typography>
        </DetailSection>
        {c.screenshot_url ? (
          <DetailSection title="Screenshot" end={<Link href={c.screenshot_url} target="_blank" rel="noopener" underline="hover" sx={{ fontSize: 12.5, fontWeight: 550 }}>Apri a tutto schermo</Link>}>
            <Box component="img" src={c.screenshot_url} alt={`Screenshot ${c.number}`} sx={{ display: 'block', width: '100%', maxHeight: 320, objectFit: 'contain', objectPosition: 'top left', borderRadius: '6px', border: '1px solid', borderColor: 'divider', bgcolor: 'archie.surface2' }} />
          </DetailSection>
        ) : null}
        <DetailSection title="Dati">
          <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', gap: '8px 12px', m: 0 }}>
            {row('Numero', <Box component="span" sx={{ ...MONO, fontSize: 12.5 }}>{c.number}</Box>)}
            {row('Account', c.account)}
            {row('Categoria', c.category_label)}
            {row('Type', c.case_type_label || '—')}
            {row('Aperto il', formatOpenedAt(c) ?? '—')}
            {row('Assegnato a', c.assigned_to_full_name ? (
              <><Avatar src={c.assigned_to_avatar ?? undefined} sx={{ width: 22, height: 22, fontSize: 9.5, fontWeight: 700, bgcolor: (t) => t.palette.archie.tints.mint.bg, color: (t) => t.palette.archie.tints.mint.ink }}>{initialsOf(c.assigned_to_full_name)}</Avatar>{c.assigned_to_full_name}</>
            ) : <Box component="span" sx={{ color: 'warning.main', fontWeight: 600 }}>Da assegnare</Box>)}
          </Box>
        </DetailSection>
      </Box>
    </FloatingDetail>
  )
}
