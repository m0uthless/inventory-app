/**
 * PhilipsAssignmentCopyDialog — modal "copia testo" per i case ServiceNow
 * Philips, con due punti di ingresso:
 * 1) alla creazione di un case Philips, al posto della notifica Teams,
 *    quando SERVICENOW_PHILIPS_NOTIFY_MODE="modal" (switch TEMPORANEO in
 *    prova — vedi GET /servicenow-cases/notification-settings/ e
 *    servicenow/notifications.py). Con la modalità di default ("teams")
 *    questo punto di ingresso non scatta mai.
 * 2) su richiesta, dalla voce "Messaggio" nel tasto destro di un case
 *    Philips già esistente, per rivedere/ricopiare il testo in qualsiasi
 *    momento — indipendente dallo switch sopra.
 */
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ContentPasteOutlinedIcon from '@mui/icons-material/ContentPasteOutlined'
import { useToast } from '@shared/ui/toast'

// ─── Testo da copiare ─────────────────────────────────────────────────────────

export type PhilipsAssignmentCopyData = {
  assignedToLabel: string | null
  number: string
  account: string
  shortDescription: string
  /** Nome del Type del case (es. "L1", "EBIT", "RIS"...), non l'Account. */
  caseTypeLabel: string
}

// Alcuni Type Philips (case_type — es. "EBIT") hanno un formato di messaggio
// dedicato, diverso dallo standard "@Persona - Numero - Account -
// Descrizione". Mappa normalizzata (nome Type in maiuscolo, trim) →
// builder del testo per quel caso specifico. Altre casistiche verranno
// aggiunte qui in futuro.
const TYPE_SPECIFIC_FORMATS: Record<string, (persona: string, number: string) => string> = {
  EBIT: (persona, number) => `@${persona} - ${number} - EBIT`,
}

/**
 * Compone il testo da copiare per un case Philips. Default:
 * "@PersonaAssegnata - Case number - Account - Descrizione".
 * Per i Type con formato dedicato (vedi TYPE_SPECIFIC_FORMATS) il testo è
 * invece quello specifico del Type.
 */
export function buildPhilipsAssignmentCopyText(data: PhilipsAssignmentCopyData): string {
  const persona = data.assignedToLabel?.trim() || 'Non assegnato'
  const account = data.account.trim()

  const specificFormat = TYPE_SPECIFIC_FORMATS[data.caseTypeLabel.trim().toUpperCase()]
  if (specificFormat) return specificFormat(persona, data.number)

  const descrizione = data.shortDescription.trim() || '(nessuna descrizione)'
  return `@${persona} - ${data.number} - ${account} - ${descrizione}`
}

// ─── Componente ───────────────────────────────────────────────────────────────

type Props = {
  open: boolean
  onClose: () => void
  text: string
}

export default function PhilipsAssignmentCopyDialog({ open, onClose, text }: Props) {
  const toast = useToast()

  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(() => toast.success('Copiato negli appunti'))
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        <Box
          sx={{
            width: 32, height: 32, borderRadius: 1.5,
            bgcolor: 'primary.50', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ContentPasteOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            Messaggio Philips
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Testo pronto da copiare per notificare l&apos;assegnazione
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ ml: 'auto' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2 }}>
        <Stack spacing={1.5}>
          <TextField
            value={text}
            multiline
            minRows={2}
            fullWidth
            size="small"
            InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
            onFocus={(e) => e.target.select()}
          />
          <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
            Incollando questo testo in Teams la persona <strong>non</strong> viene taggata
            davvero: Teams genera una notifica solo se il mention è scelto dal suo menu a
            comparsa "@", non da testo incollato. Dopo aver incollato, cancella "@NomePersona"
            e riscrivilo digitando "@" per selezionare la persona dal suggerimento di Teams.
          </Alert>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
        <Button size="small" onClick={onClose}>
          Chiudi
        </Button>
        <Button
          size="small"
          variant="contained"
          startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />}
          onClick={handleCopy}
        >
          Copia
        </Button>
      </DialogActions>
    </Dialog>
  )
}
