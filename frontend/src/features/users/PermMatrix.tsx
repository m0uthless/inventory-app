import * as React from 'react'
import { Box, ButtonBase, Tooltip } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { PermissionModule, RwdLevel } from '../../types/adminUsers'
import { rwdLevelIndex } from '../../types/adminUsers'
import { LEVELS, LEVEL_LABEL } from './usersModel'

/**
 * Matrice dei permessi (anteprima ud-base): una riga per modulo, «Da dove» e quattro colonne
 * Nessuno · Lettura · Scrittura · Completo. Il pallino pieno segna fin dove arriva il livello,
 * quello cerchiato è la scelta; sotto il livello dato dai gruppi non si scende.
 * La seconda colonna è «Da dove» per l'utente; il gruppo la usa per le «Eccezioni» (`sourceLabel` + `renderSource`).
 * `changed` mette un puntino sui moduli modificati e non ancora salvati.
 */
export function PermMatrix({ modules, get, onChange, disabled, showSource = true, sourceLabel = 'Da dove', renderSource, changed }: {
  modules: PermissionModule[]
  get: (app: string) => { level: RwdLevel; floor?: RwdLevel; from?: string }
  onChange: (app: string, l: RwdLevel) => void
  disabled?: boolean
  showSource?: boolean
  sourceLabel?: string
  renderSource?: (app: string) => React.ReactNode
  changed?: (app: string) => boolean
}) {
  const cell = { height: 40, borderBottom: '1px solid', borderColor: 'divider' } as const
  return (
    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, '& tbody tr:last-of-type > *': { borderBottom: 0 }, '& tbody tr:hover > *': { bgcolor: 'archie.surface2' } }}>
      <Box component="thead">
        <Box component="tr">
          <Box component="th" scope="col" sx={{ textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: 'text.secondary', pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>Modulo</Box>
          {showSource ? <Box component="th" scope="col" sx={{ textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: 'text.secondary', pb: 1, borderBottom: '1px solid', borderColor: 'divider', display: { xs: 'none', sm: 'table-cell' } }}>{sourceLabel}</Box> : null}
          {LEVELS.map((l) => <Box key={l} component="th" scope="col" sx={{ width: { xs: 56, sm: 84 }, textAlign: 'center', fontSize: 11.5, fontWeight: 600, color: 'text.secondary', pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>{LEVEL_LABEL[l]}</Box>)}
        </Box>
      </Box>
      <Box component="tbody">
        {modules.map((m) => {
          const v = get(m.app_label)
          const manual = v.from === 'assegnato a mano'
          return (
            <Box component="tr" key={m.app_label}>
              <Box component="th" scope="row" sx={{ ...cell, textAlign: 'left', fontWeight: 550, color: v.level === 'none' ? 'text.secondary' : 'text.primary', pr: 1.5 }}>
                {m.label}
                {changed?.(m.app_label) ? <Box component="span" aria-label="modificato" sx={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.main', ml: 1, verticalAlign: 'middle' }} /> : null}
              </Box>
              {showSource ? <Box component="td" sx={{ ...cell, fontSize: 12, pr: 1.5, color: manual ? 'primary.main' : 'text.disabled', fontWeight: manual ? 550 : 400, display: { xs: 'none', sm: 'table-cell' } }}>{renderSource ? renderSource(m.app_label) : v.from || '—'}</Box> : null}
              {LEVELS.map((l) => {
                const on = l === v.level
                const fill = l !== 'none' && rwdLevelIndex(l) <= rwdLevelIndex(v.level)
                const below = rwdLevelIndex(l) < rwdLevelIndex(v.floor ?? 'none')
                return (
                  <Box component="td" key={l} sx={{ ...cell, textAlign: 'center' }}>
                    <Tooltip title={below ? 'Concesso dal gruppo: non si può togliere qui' : ''}>
                      <span>
                        <ButtonBase role="radio" aria-checked={on} aria-label={`${m.label}: ${LEVEL_LABEL[l]}`} disabled={disabled || below} onClick={() => { if (!on) onChange(m.app_label, l) }}
                          sx={{ width: 28, height: 28, borderRadius: '50%', '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing }, '&.Mui-disabled': { opacity: 0.45 } }}>
                          <Box component="span" sx={(t) => ({
                            display: 'block', borderRadius: '50%', transition: 'background .12s, box-shadow .12s',
                            ...(on && l === 'none'
                              ? { width: 14, height: 14, bgcolor: 'background.paper', boxShadow: `inset 0 0 0 4px ${t.palette.text.secondary}, 0 0 0 3px ${t.palette.archie.neutralBg}` }
                              : on
                                ? { width: 14, height: 14, bgcolor: 'primary.main', boxShadow: `0 0 0 3px ${alpha(t.palette.primary.main, 0.22)}` }
                                : fill
                                  ? { width: 12, height: 12, bgcolor: alpha(t.palette.primary.main, 0.38) }
                                  : { width: 12, height: 12, boxShadow: `inset 0 0 0 1.5px ${t.palette.archie.borderStrong}` }),
                          })} />
                        </ButtonBase>
                      </span>
                    </Tooltip>
                  </Box>
                )
              })}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
