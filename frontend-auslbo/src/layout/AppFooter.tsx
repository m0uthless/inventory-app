import { Box, Divider, Link, Stack, Typography } from '@mui/material'

export default function AppFooter() {
  const year = new Date().getFullYear()
  const version = import.meta.env.VITE_APP_VERSION ?? 'dev'

  return (
    <Box component="footer">
      <Divider />
      <Box sx={{ py: 1.25, px: { xs: 2, md: 3 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 0.5, sm: 2 }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
        >
          <Typography variant="caption" color="text.secondary">
            © {year} · Biotron S.p.A. · All rights reserved · Created with ❤️ by Federico Mutuale
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              v{version}
            </Typography>
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
