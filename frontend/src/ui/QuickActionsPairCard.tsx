import { Box, alpha } from '@mui/material'
import BugReportRoundedIcon from '@mui/icons-material/BugReportRounded'
import AssignmentIndRoundedIcon from '@mui/icons-material/AssignmentIndRounded'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import { useKpiAccents } from '../theme/AppThemeProvider'
import QuickActionTile from './QuickActionTile'

// Widget dashboard 'quick-actions-pair' (1x1 fisso, unico widget con le
// scorciatoie di creazione rapida — sostituisce i vecchi widget standalone
// 'new-issue' e 'new-triage-case', rimossi dal catalogo). Le due tile sono
// affiancate e riempiono tutta la cella (fit="half": altezza piena, metà
// larghezza ciascuna), così il bordo esterno della coppia combacia con
// quello degli altri widget nella stessa colonna (es. Compleanni) invece
// di lasciare margini vuoti ai lati. Colore pieno (non gradiente).
// Colori delle tile: teal1/violet1 da KPI_ACCENTS (useKpiAccents(), theme-
// aware — variante "main", non più hex fissi), bordo/glow derivati con
// alpha() sullo stesso colore, hover-border su teal2/violet2 (variante
// "dark", più scura — coerente con la direzione "scurisci in hover" del
// resto dell'app).
export default function QuickActionsPairCard() {
  const navigate = useNavigate()
  const { hasPerm } = useAuth()
  const kpiAccents = useKpiAccents()

  return (
    <Box sx={{
      height: '100%', width: '100%',
      display: 'flex', gap: 1,
    }}>
      <QuickActionTile
        fit="half"
        watermarkIcon={<AssignmentIndRoundedIcon />}
        label="Triage"
        background={kpiAccents.teal1}
        borderColor={alpha(kpiAccents.teal1, 0.35)}
        hoverBorderColor={kpiAccents.teal2}
        glowColor={alpha(kpiAccents.teal1, 0.25)}
        disabled={!hasPerm(PERMS.servicenow.case.add)}
        onClick={() => navigate('/servicenow-cases', { state: { openCreate: true } })}
      />
      <QuickActionTile
        fit="half"
        watermarkIcon={<BugReportRoundedIcon />}
        label="Issue"
        background={kpiAccents.violet1}
        borderColor={alpha(kpiAccents.violet1, 0.35)}
        hoverBorderColor={kpiAccents.violet2}
        glowColor={alpha(kpiAccents.violet1, 0.25)}
        disabled={!hasPerm(PERMS.issues.issue.add)}
        onClick={() => navigate('/issues', { state: { openCreate: true } })}
      />
    </Box>
  )
}
