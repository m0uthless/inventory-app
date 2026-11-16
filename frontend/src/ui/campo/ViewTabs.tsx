import type { ReactNode } from 'react'
import { Box, ButtonBase } from '@mui/material'

export type ViewTab = { key: string; label: string; count?: number | null; tone?: 'default' | 'alert'; onRemove?: () => void }

type Props = {
  tabs: ViewTab[]
  value: string
  onChange: (key: string) => void
  /** Elementi a destra (es. "Salva vista", cestino). */
  end?: ReactNode
}

/** Viste salvate come schede nell'intestazione del riquadro (DESIGN.md › Saved views). */
export function ViewTabs({ tabs, value, onChange, end }: Props) {
  return (
    <Box role="tablist" aria-label="Viste" sx={{
      display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, borderBottom: '1px solid', borderColor: 'divider',
      overflowX: 'auto', scrollbarWidth: 'none', minHeight: 44,
    }}>
      {tabs.map((t) => {
        const on = t.key === value
        return (
          <ButtonBase key={t.key} role="tab" aria-selected={on} onClick={() => onChange(t.key)} sx={{
            position: 'relative', height: 44, px: 1.25, gap: 0.75, fontSize: 13, fontWeight: 550, whiteSpace: 'nowrap',
            color: on ? 'text.primary' : 'text.secondary', '&:hover': { color: 'text.primary' },
            '&.Mui-focusVisible': { boxShadow: (th) => th.palette.archie.focusRing, borderRadius: '6px' },
            '&::after': on ? { content: '""', position: 'absolute', left: 8, right: 8, bottom: -1, height: 2, borderRadius: '2px 2px 0 0', bgcolor: 'primary.main' } : undefined,
          }}>
            {t.label}
            {t.count != null ? (
              <Box component="span" sx={{
                fontSize: 11, fontWeight: 600, lineHeight: '18px', px: 0.75, borderRadius: '5px', fontVariantNumeric: 'tabular-nums',
                bgcolor: t.tone === 'alert' && t.count ? 'error.light' : on ? 'archie.field' : 'archie.neutralBg',
                color: t.tone === 'alert' && t.count ? 'error.main' : on ? 'primary.main' : 'text.secondary',
              }}>{t.count}</Box>
            ) : null}
            {t.onRemove && on ? (
              <Box component="span" role="button" tabIndex={0} aria-label={`Elimina la vista ${t.label}`} title="Elimina vista"
                onClick={(e) => { e.stopPropagation(); t.onRemove?.() }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); t.onRemove?.() } }}
                sx={{ display: 'inline-grid', placeItems: 'center', width: 18, height: 18, borderRadius: '4px', color: 'text.secondary', fontSize: 14, lineHeight: 1, '&:hover': { bgcolor: 'archie.surface2', color: 'text.primary' } }}>×</Box>
            ) : null}
          </ButtonBase>
        )
      })}
      {end ? <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>{end}</Box> : null}
    </Box>
  )
}
