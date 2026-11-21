import { Box, Typography } from '@mui/material'
import { useUrlStringParam } from '@shared/hooks/useUrlParam'

import { PageHead } from '../ui/campo'
import ContractsNav from '../features/contracts/ContractsNav'
import ContractValueView, { ScopeSwitch, type ValueScope } from '../features/contracts/ContractValueView'

/** Contratti › Valore: quali clienti pesano di più, anche per regione. Rotta protetta dal permesso sui valori. */
export default function ContractsValue() {
  const [scopeParam, setScopeParam] = useUrlStringParam('scope')
  const scope: ValueScope = scopeParam === 'all' ? 'all' : 'active'
  return (
    <Box>
      <PageHead title="Contratti" inline={<ContractsNav current="value" />} actions={<ScopeSwitch value={scope} onChange={(v) => setScopeParam(v === 'all' ? 'all' : '')} />} />
      <ContractValueView scope={scope} />
      <Typography sx={{ mt: 2, fontSize: 12, color: 'text.secondary' }}>Il valore è il totale dei contratti, non diviso per anno.</Typography>
    </Box>
  )
}
