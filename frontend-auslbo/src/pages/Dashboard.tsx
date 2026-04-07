import * as React from 'react'
import { Box, Card, CardContent, Chip, CircularProgress, Grid, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { useAuth } from '../auth/AuthProvider'

type KpiData = {
  inventory_count: number
  sites_count: number
}

function KpiCard({
  label,
  value,
  sub,
  dotColor,
}: {
  label: string
  value: number | string
  sub: string
  dotColor: string
}) {
  return (
    <Card elevation={0} sx={{ border: '0.5px solid', borderColor: 'divider', borderRadius: 2 }}>
      <CardContent sx={{ p: '14px 16px !important' }}>
        <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.75 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: 26, fontWeight: 600, color: 'text.primary', lineHeight: 1 }}>
          {value}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75 }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0 }} />
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{sub}</Typography>
        </Box>
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const { me } = useAuth()
  const [kpi, setKpi] = React.useState<KpiData | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [invRes, sitesRes] = await Promise.all([
          api.get<{ count: number }>('/inventories/?page_size=1'),
          api.get<{ count: number }>('/sites/?page_size=1'),
        ])
        if (!cancelled) {
          setKpi({
            inventory_count: invRes.data.count,
            sites_count: sitesRes.data.count,
          })
        }
      } catch {
        if (!cancelled) setKpi({ inventory_count: 0, sites_count: 0 })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <Box>
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h6" fontWeight={600} sx={{ fontSize: 18, color: 'text.primary' }}>
          Dashboard
        </Typography>
        {me?.customer && (
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.25 }}>
            {me.customer.display_name || me.customer.name}
          </Typography>
        )}
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <>
          <Grid container spacing={1.5} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, md: 3 }}>
              <KpiCard
                label="Apparecchiature"
                value={kpi?.inventory_count ?? 0}
                sub="totali"
                dotColor="#1A6BB5"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <KpiCard
                label="Sedi"
                value={kpi?.sites_count ?? 0}
                sub="area Bologna"
                dotColor="#1A6BB5"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <KpiCard
                label="Scadenze entro 30gg"
                value="—"
                sub="in arrivo"
                dotColor="#BA7517"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <KpiCard
                label="Richieste aperte"
                value="—"
                sub="in lavorazione"
                dotColor="#639922"
              />
            </Grid>
          </Grid>

          <Card elevation={0} sx={{ border: '0.5px solid', borderColor: 'divider', borderRadius: 2 }}>
            <CardContent sx={{ p: '16px !important' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
                  Apparecchiature recenti
                </Typography>
                <Chip label="vai alla lista →" size="small" onClick={() => {}} sx={{ fontSize: 11, cursor: 'pointer' }} />
              </Box>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                Naviga la sezione <strong>Apparecchiature</strong> per visualizzare l'inventario completo del tuo ente.
              </Typography>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  )
}
