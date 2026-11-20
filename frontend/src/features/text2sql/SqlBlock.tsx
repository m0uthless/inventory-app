import { Box, Button, Typography } from '@mui/material'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'

import { copyToClipboard } from '@shared/utils/clipboard'
import { useToast } from '@shared/ui/toast'

import { highlightSql } from './sqlHighlight'

/** Query in un blocco di codice con «Copia». `tone`: scrittura (bordo ambra) o query corretta (verde). */
export default function SqlBlock({ sql, label = 'Query generata', tone, copyLabel = 'Copia la query' }: { sql: string; label?: string; tone?: 'write' | 'corrected'; copyLabel?: string }) {
  const toast = useToast()
  return (
    <Box sx={{
      minWidth: 0, border: '1px solid', borderRadius: '8px',
      borderColor: tone === 'write' ? 'warning.main' : tone === 'corrected' ? 'success.main' : 'divider',
      bgcolor: tone === 'corrected' ? 'success.light' : 'archie.surface2',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary', flex: 1 }}>{label}</Typography>
        <Button size="small" color="inherit" aria-label={copyLabel} startIcon={<ContentCopyRoundedIcon sx={{ fontSize: '15px !important' }} />}
          onClick={async () => { await copyToClipboard(sql); toast.success('Copiata') }} sx={{ color: 'text.secondary', fontWeight: 550 }}>
          Copia
        </Button>
      </Box>
      <Box component="pre" sx={{
        m: 0, p: '12px 14px', overflowX: 'auto', fontFamily: '"Geist Mono", monospace', fontSize: 12.5, lineHeight: 1.6, color: 'text.primary',
        '& .k': { color: 'primary.main', fontWeight: 600 }, '& .c': { color: 'text.secondary', fontStyle: 'italic' }, '& .s': { color: 'info.main' },
      }}>
        {highlightSql(sql).map((line, i) => (
          <span key={i}>{line.map((s, j) => (s.kind === 'plain' ? s.text : <span key={j} className={s.kind === 'keyword' ? 'k' : s.kind === 'comment' ? 'c' : 's'}>{s.text}</span>))}{'\n'}</span>
        ))}
      </Box>
    </Box>
  )
}
