import * as React from 'react'
import { alpha } from '@mui/material/styles'
import { Box, ButtonBase, Typography } from '@mui/material'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'

import { useToast } from '@shared/ui/toast'
import { MAX_UPLOAD_MB, MAX_UPLOAD_BYTES } from './style'

// ─── Upload Zone ──────────────────────────────────────────────────────────────

export function UploadZone({ onFiles }: { onFiles: (files: FileList) => void }) {
  const [over, setOver] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const toast = useToast()

  const validate = (files: FileList): FileList | null => {
    const errors: string[] = []
    Array.from(files).forEach((f) => {
      if (f.size > MAX_UPLOAD_BYTES) {
        const mb = (f.size / 1024 / 1024).toFixed(1)
        errors.push(`"${f.name}" — troppo grande (${mb} MB, max ${MAX_UPLOAD_MB} MB)`)
      }
    })
    if (errors.length) {
      errors.forEach((e) => toast.error(e))
      return null
    }
    return files
  }

  return (
    <ButtonBase
      component="label"
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (e.dataTransfer.files.length) {
          const valid = validate(e.dataTransfer.files)
          if (valid) onFiles(valid)
        }
      }}
      aria-label={`Carica file, trascina qui o seleziona dal computer. Massimo ${MAX_UPLOAD_MB} MB per file, file eseguibili non consentiti.`}
      sx={{
        border: '2px dashed',
        borderColor: over ? 'primary.main' : 'grey.200',
        borderRadius: 1,
        py: 2,
        px: 3,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        width: '100%',
        justifyContent: 'flex-start',
        textAlign: 'left',
        background: (t) => over ? alpha(t.palette.primary.main, 0.04) : t.palette.grey[50],
        transition: 'all 0.15s',
        mb: 2.5,
        '&:hover': { borderColor: 'primary.main', background: (t) => alpha(t.palette.primary.main, 0.03) },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
      }}
    >
      <UploadFileOutlinedIcon sx={{ color: over ? 'primary.main' : 'grey.400', fontSize: 22 }} />
      <Box sx={{ flex: 1 }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: over ? 'primary.main' : 'text.secondary' }}
        >
          Trascina file qui
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          oppure{' '}
          <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
            seleziona dal computer
          </Box>
          {' · '}max {MAX_UPLOAD_MB} MB · no file eseguibili
        </Typography>
      </Box>
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          border: 0,
        }}
        onChange={(e) => {
          if (e.target.files?.length) {
            const valid = validate(e.target.files)
            if (valid) onFiles(valid)
          }
          e.target.value = '' // reset so same file can be re-selected
        }}
      />
    </ButtonBase>
  )
}
