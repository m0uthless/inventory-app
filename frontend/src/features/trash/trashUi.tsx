import * as React from 'react'
import { Box, Button, Checkbox, FormControlLabel, Tooltip, Typography } from '@mui/material'
import { CampoDialog, CampoIcon } from '../../ui/campo'
import { purgeBlockText, resourceOf, type TrashRow } from './trashModel'

/** Elemento: icona del tipo, titolo e contesto (cliente, sito…). */
export function TrashItemCell({ row }: { row: TrashRow }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, height: '100%' }}>
      <Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex', flex: 'none' }}><CampoIcon name={resourceOf(row.kind).icon} size={17} /></Box>
      <Box sx={{ display: 'grid', minWidth: 0, lineHeight: 1.3 }}>
        <Typography noWrap sx={{ fontSize: 13, fontWeight: 550 }}>{row.title}</Typography>
        {row.sub ? <Typography noWrap component="span" sx={{ fontSize: 11.5, color: 'text.secondary' }}>{row.sub}</Typography> : null}
      </Box>
    </Box>
  )
}

const chipSx = { display: 'inline-flex', alignItems: 'center', gap: 0.6, height: 22, px: 1, borderRadius: '5px', fontSize: 12, fontWeight: 550, whiteSpace: 'nowrap' } as const

/** Stato nel cestino: ripristinabile, da ripristinare dopo il padre, con collegati attivi. */
export function TrashState({ row }: { row: TrashRow }) {
  const purge = purgeBlockText(row.info?.purge_block)
  if (row.info?.restore_block) {
    return (
      <Tooltip title={row.info.restore_block}>
        <Box component="span" sx={{ ...chipSx, bgcolor: 'warning.light', color: 'warning.main' }}><CampoIcon name="lock" size={12} />Prima il padre</Box>
      </Tooltip>
    )
  }
  if (purge) {
    return (
      <Tooltip title={`Non si può eliminare definitivamente: ci sono ancora ${purge} attivi.`}>
        <Box component="span" sx={{ ...chipSx, bgcolor: 'info.light', color: 'info.main' }}><CampoIcon name="alert" size={12} />Ha collegati attivi</Box>
      </Tooltip>
    )
  }
  return <Box component="span" sx={{ ...chipSx, bgcolor: 'archie.neutralBg', color: 'text.secondary' }}>Ripristinabile</Box>
}

/** Quando e da chi. */
export function TrashWhen({ ago, by }: { ago: string; by?: string | null }) {
  return (
    <Box sx={{ display: 'grid', lineHeight: 1.3, minWidth: 0 }}>
      <Typography noWrap sx={{ fontSize: 13, fontWeight: 550 }}>{ago}</Typography>
      {by ? <Typography noWrap component="span" sx={{ fontSize: 11.5, color: 'text.secondary' }}>da {by}</Typography> : null}
    </Box>
  )
}

/** Conferma dell'eliminazione definitiva: cosa sparisce, cosa resta nel cestino e perché. */
export function PurgeDialog({ rows, busy, onClose, onConfirm }: {
  rows: TrashRow[] | null
  busy: boolean
  onClose: () => void
  onConfirm: (rows: TrashRow[]) => void
}) {
  const [ack, setAck] = React.useState(false)
  const open = rows !== null
  React.useEffect(() => { if (open) setAck(false) }, [open])
  const list = rows ?? []
  const ok = list.filter((r) => !purgeBlockText(r.info?.purge_block))
  const no = list.filter((r) => purgeBlockText(r.info?.purge_block))
  const title = ok.length === 1 && !no.length ? `Eliminare definitivamente «${ok[0].title}»?` : `Eliminare definitivamente ${ok.length} elementi?`
  return (
    <CampoDialog open={open} onClose={onClose} busy={busy} labelId="trash-purge-title"
      title={ok.length ? title : 'Niente da eliminare'}
      sub="Non si può annullare: i dati spariscono da Archie. Nel registro Audit resta la traccia dell'eliminazione."
      footer={<>
        <Box sx={{ flex: 1 }} />
        <Button variant="text" onClick={onClose} disabled={busy}>Annulla</Button>
        <Button variant="contained" color="error" disabled={!ack || !ok.length || busy} onClick={() => onConfirm(ok)}>
          Elimina definitivamente{ok.length > 1 ? ` ${ok.length}` : ''}
        </Button>
      </>}>
      {ok.length ? (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.75, maxHeight: 240, overflowY: 'auto' }}>
          {ok.map((r) => (
            <Box component="li" key={r.rid} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13, px: 1.25, py: 0.75, borderRadius: '6px', bgcolor: 'archie.surface2', minWidth: 0 }}>
              <Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex', flex: 'none' }}><CampoIcon name={resourceOf(r.kind).icon} size={15} /></Box>
              <Typography noWrap sx={{ fontSize: 13 }}><b style={{ fontWeight: 550 }}>{r.title}</b> · {resourceOf(r.kind).one.toLowerCase()}</Typography>
            </Box>
          ))}
        </Box>
      ) : null}
      {no.length ? (
        <Box sx={{ p: '10px 12px', borderRadius: '8px', bgcolor: 'warning.light', color: 'text.primary' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 650, color: 'warning.main' }}>{no.length === 1 ? 'Questo resta nel cestino' : `${no.length} restano nel cestino`}</Typography>
          {no.slice(0, 8).map((r) => (
            <Typography key={r.rid} sx={{ fontSize: 12.5, mt: 0.25 }}>{r.title}: ci sono ancora {purgeBlockText(r.info?.purge_block)} attivi.</Typography>
          ))}
          {no.length > 8 ? <Typography sx={{ fontSize: 12.5, mt: 0.25, color: 'text.secondary' }}>e altri {no.length - 8}.</Typography> : null}
        </Box>
      ) : null}
      {ok.length ? (
        <FormControlLabel sx={{ m: 0 }} control={<Checkbox size="small" checked={ack} onChange={(e) => setAck(e.target.checked)} />}
          label={<Typography sx={{ fontSize: 13 }}>Ho capito che non si possono recuperare</Typography>} />
      ) : null}
    </CampoDialog>
  )
}
