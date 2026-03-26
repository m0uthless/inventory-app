import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, IconButton, InputAdornment, TextField } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import { SIDEBAR } from '../theme/tokens'

type Props = {
  /** Called when the easter-egg trigger word is typed, instead of navigating. */
  onEggTrigger: () => void
}

const EGG_TRIGGER = 'supertennis'

export default function GlobalSearch({ onEggTrigger }: Props) {
  const nav = useNavigate()
  const [q, setQ] = React.useState('')

  const go = React.useCallback(() => {
    const trimmed = q.trim()
    if (trimmed.toLowerCase() === EGG_TRIGGER) {
      onEggTrigger()
      setQ('')
      return
    }
    nav(trimmed ? `/search?search=${encodeURIComponent(trimmed)}` : '/search')
  }, [q, nav, onEggTrigger])

  return (
    <>
      {/* Desktop */}
      <Box sx={{ display: { xs: 'none', sm: 'flex' }, width: { sm: 216, md: 312 } }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Cerca…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              go()
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: q ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label="Cancella ricerca"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setQ('')}
                  edge="end"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 1,
              backgroundColor: SIDEBAR.chipBg,
              color: '#fff',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.6)' },
              '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.8)' },
              '& .MuiInputAdornment-root svg': { color: SIDEBAR.textDefault },
              '& input::placeholder': { color: SIDEBAR.textMuted, opacity: 1 },
            },
          }}
        />
      </Box>

      {/* Mobile */}
      <IconButton
        onClick={() => nav('/search')}
        sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
        aria-label="Ricerca"
      >
        <SearchIcon />
      </IconButton>
    </>
  )
}
