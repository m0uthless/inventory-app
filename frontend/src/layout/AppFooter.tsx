import { Box, Divider, Link, Stack, Typography } from '@mui/material'
import { DEV_STRIPES, isDevEnvironment } from '@shared/ui/DevEnvironmentBadge'

/** Pillola leggibile sopra le righe dell'ambiente di sviluppo. */
const devPill = { bgcolor: 'background.paper', borderRadius: '6px', px: 1, py: 0.25 } as const

export default function AppFooter() {
  const year = new Date().getFullYear()
  const version = import.meta.env.VITE_APP_VERSION ?? 'dev'
  const dev = isDevEnvironment

  return (
    <Box component="footer" sx={dev ? { backgroundImage: DEV_STRIPES } : undefined}>
      {dev ? null : <Divider />}
      <Box sx={{ py: dev ? 0.75 : 1.25, px: { xs: 2, md: 3 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 0.5, sm: 2 }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            {dev ? (
              <Typography variant="caption" sx={{ ...devPill, bgcolor: '#1e1b16', color: '#f59e0b', fontWeight: 800, letterSpacing: '0.08em', flex: 'none' }}>
                SVILUPPO
              </Typography>
            ) : null}
            <Typography variant="caption" color="text.secondary" sx={dev ? devPill : undefined}>
              © {year} · Biotron S.p.A. · All rights reserved · Created with ❤️ by Federico Mutuale
            </Typography>
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center" sx={dev ? { ...devPill, alignSelf: { xs: 'flex-start', sm: 'center' } } : undefined}>
            <Typography variant="caption" color="text.secondary">
              v{version}
            </Typography>

            {/* metti le tue URL reali quando vuoi */}
            <Link href="#" underline="hover" variant="caption" color="text.secondary">
              Privacy
            </Link>
            <Link href="#" underline="hover" variant="caption" color="text.secondary">
              Terms
            </Link>
          </Stack>
        </Stack>
      </Box>
    </Box>
  )
}
