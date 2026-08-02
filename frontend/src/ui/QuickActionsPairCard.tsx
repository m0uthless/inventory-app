import { Box } from '@mui/material'
import BugReportRoundedIcon from '@mui/icons-material/BugReportRounded'
import AssignmentIndRoundedIcon from '@mui/icons-material/AssignmentIndRounded'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import QuickActionTile from './QuickActionTile'

// Widget dashboard 'quick-actions-pair' (1x1 fisso, unico widget con le
// scorciatoie di creazione rapida — sostituisce i vecchi widget standalone
// 'new-issue' e 'new-triage-case', rimossi dal catalogo). Le due tile sono
// affiancate e riempiono tutta la cella (fit="half": altezza piena, metà
// larghezza ciascuna), così il bordo esterno della coppia combacia con
// quello degli altri widget nella stessa colonna (es. Compleanni) invece
// di lasciare margini vuoti ai lati. Colore pieno (non gradiente).
export default function QuickActionsPairCard() {
  const navigate = useNavigate()
  const { hasPerm } = useAuth()

  return (
    <Box sx={{
      height: '100%', width: '100%',
      display: 'flex', gap: 1,
    }}>
      <QuickActionTile
        fit="half"
        watermarkIcon={<AssignmentIndRoundedIcon />}
        label="Triage"
        background="#1f6fb5"
        borderColor="rgba(63,140,197,0.35)"
        hoverBorderColor="#5fa3d9"
        glowColor="rgba(31,111,181,0.25)"
        disabled={!hasPerm(PERMS.servicenow.case.add)}
        onClick={() => navigate('/servicenow-cases', { state: { openCreate: true } })}
      />
      <QuickActionTile
        fit="half"
        watermarkIcon={<BugReportRoundedIcon />}
        label="Issue"
        background="#ea580c"
        borderColor="rgba(251,146,60,0.35)"
        hoverBorderColor="#fb923c"
        glowColor="rgba(234,88,12,0.25)"
        disabled={!hasPerm(PERMS.issues.issue.add)}
        onClick={() => navigate('/issues', { state: { openCreate: true } })}
      />
    </Box>
  )
}
