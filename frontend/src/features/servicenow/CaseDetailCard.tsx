import * as React from 'react'
import { Avatar, Box, Button, IconButton, Link, ListItemIcon, Menu, MenuItem, Tooltip, Typography } from '@mui/material'
import { copyToClipboard } from '@shared/utils/clipboard'
import { useToast } from '@shared/ui/toast'
import {
  BandChip, CampoIcon, RecordGrid, RecordModal, RecordSection, RecordValue, bandButtonSx, bandSolidSx, recordMono as mono, type DetailMenuItem,
} from '../../ui/campo'
import { formatOpenedAt, initialsOf, type ServiceNowCaseRow } from './snModel'

/*
 * Finestra del caso ServiceNow (anteprima design-previews/rst-base.html › ServiceNow): è una registrazione, non
 * una gestione (niente stato da cambiare). «Apri in ServiceNow» come azione principale; al centro descrizione e
 * screenshot, a lato i dati. «Modifica» (⋯) apre il dialogo del caso, che conosce i type per categoria, i tecnici
 * assenti e lo screenshot.
 */
export default function CaseDetailCard({ c, busy, canChange, canDelete, menu, position, onPrev, onNext, onClose, onEdit, onDelete, onRestore }: {
  c: ServiceNowCaseRow; busy: boolean; canChange: boolean; canDelete: boolean; menu: DetailMenuItem[]
  position?: string; onPrev?: () => void; onNext?: () => void; onClose: () => void; onEdit: () => void; onDelete: () => void; onRestore: () => void
}) {
  const toast = useToast()
  const deleted = Boolean(c.deleted_at)
  const [el, setEl] = React.useState<HTMLElement | null>(null)
  React.useEffect(() => setEl(null), [c.id])
  const opened = formatOpenedAt(c)
  const chip = (txt: React.ReactNode, warn?: boolean) => (
    <Box component="span" sx={{ height: 20, px: 0.9, borderRadius: '5px', fontSize: 11.5, fontWeight: 550, display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap',
      bgcolor: warn ? 'rgb(224 164 58 / .28)' : 'rgb(255 255 255 / .12)', color: warn ? '#fde9c4' : '#e6f2ee', '& b': { color: '#fff', fontWeight: 700 } }}>{txt}</Box>
  )
  const item = (icon: React.ReactNode, label: string, onClick: () => void, opts: { disabled?: boolean; danger?: boolean } = {}) => (
    <MenuItem key={label} disabled={opts.disabled} onClick={() => { setEl(null); onClick() }} sx={opts.danger ? { color: 'error.main' } : undefined}>
      <ListItemIcon sx={opts.danger ? { color: 'error.main' } : undefined}>{icon}</ListItemIcon>{label}
    </MenuItem>
  )

  return (
    <RecordModal open onClose={onClose} ariaLabel={`Caso ${c.number}`} compact
      title={c.account}
      status={deleted ? <BandChip>Nel cestino</BandChip> : undefined}
      subtitle={<><Box component="span" sx={{ ...mono, fontSize: 12 }}>{c.number}</Box>{[c.case_type_label, c.category_label, opened ? `aperto il ${opened}` : null].filter(Boolean).map((x) => ` · ${x}`).join('')}</>}
      tags={<>
        {c.assigned_to_full_name ? chip(<>assegnato a <b>{c.assigned_to_full_name}</b></>) : chip(<b>da assegnare</b>, true)}
        {c.screenshot_url ? chip('con screenshot') : null}
      </>}
      position={position} onPrev={onPrev} onNext={onNext}
      actions={<>
        {deleted ? (canChange ? <Button variant="outlined" disabled={busy} onClick={onRestore} startIcon={<CampoIcon name="restore" size={15} />} sx={{ ...bandButtonSx, ...bandSolidSx }}>Ripristina</Button> : null)
          : c.external_url ? <Button variant="outlined" component="a" href={c.external_url} target="_blank" rel="noopener noreferrer" startIcon={<CampoIcon name="arrowR" size={15} />} sx={{ ...bandButtonSx, ...bandSolidSx }}>Apri in ServiceNow</Button> : null}
        {!deleted ? <Tooltip title="Altre azioni"><IconButton aria-label="Altre azioni" onClick={(e) => setEl(e.currentTarget)} sx={{ color: 'rgb(255 255 255 / .85)', '&:hover': { bgcolor: 'rgb(255 255 255 / .14)' } }}><CampoIcon name="more" /></IconButton></Tooltip> : null}
        <Menu anchorEl={el} open={Boolean(el)} onClose={() => setEl(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          {item(<CampoIcon name="columns" size={16} />, 'Modifica…', onEdit, { disabled: !canChange || busy })}
          {menu.map((m) => item(m.icon ?? <CampoIcon name="plus" size={16} />, m.label, m.onClick, { disabled: m.disabled, danger: m.danger }))}
          {item(<CampoIcon name="copy" size={16} />, 'Copia il numero', () => { void copyToClipboard(c.number).then(() => toast.success('Numero copiato')) })}
          {item(<CampoIcon name="trash" size={16} />, 'Elimina', onDelete, { disabled: !canDelete || busy, danger: true })}
        </Menu>
      </>}>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Descrizione">
            <Typography sx={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: c.short_description ? 'text.primary' : 'text.secondary' }}>{c.short_description || 'Nessuna descrizione.'}</Typography>
          </RecordSection>
          {c.screenshot_url ? (
            <RecordSection title="Screenshot" end={<Link href={c.screenshot_url} target="_blank" rel="noopener" underline="hover" sx={{ fontSize: 12.5, fontWeight: 550 }}>Apri a tutto schermo</Link>}>
              <Box component="a" href={c.screenshot_url} target="_blank" rel="noopener" aria-label="Apri lo screenshot a tutto schermo" sx={{ display: 'block', cursor: 'zoom-in' }}>
                <Box component="img" src={c.screenshot_url} alt={`Screenshot ${c.number}`} sx={{ display: 'block', width: '100%', maxHeight: 520, objectFit: 'contain', objectPosition: 'top left', borderRadius: '8px', border: '1px solid', borderColor: 'divider', bgcolor: 'archie.surface2' }} />
              </Box>
            </RecordSection>
          ) : null}
        </Box>

        <Box component="aside" aria-label="Dati del caso" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Dati">
            <RecordGrid>
              <RecordValue label="Numero" mono>{c.number}</RecordValue>
              <RecordValue label="Type">{c.case_type_label || null}</RecordValue>
              <RecordValue label="Account" wide>{c.account}</RecordValue>
              <RecordValue label="Categoria">{c.category_label}</RecordValue>
              <RecordValue label="Aperto il">{opened}</RecordValue>
              <RecordValue label="Assegnato a" wide>
                {c.assigned_to_full_name ? (
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.875 }}>
                    <Avatar src={c.assigned_to_avatar ?? undefined} sx={{ width: 20, height: 20, fontSize: 9, fontWeight: 700, bgcolor: (t) => t.palette.archie.tints.mint.bg, color: (t) => t.palette.archie.tints.mint.ink }}>{initialsOf(c.assigned_to_full_name)}</Avatar>
                    {c.assigned_to_full_name}
                  </Box>
                ) : <Box component="span" sx={{ color: 'warning.main', fontWeight: 600 }}>Da assegnare</Box>}
              </RecordValue>
            </RecordGrid>
          </RecordSection>
        </Box>
      </Box>
    </RecordModal>
  )
}
