import * as React from 'react'
import {
  Box,
  Card,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import VisibilityIcon from '@mui/icons-material/Visibility'
import SentimentSatisfiedAltRoundedIcon from '@mui/icons-material/SentimentSatisfiedAltRounded'
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useToast } from '../ui/toast'
import { apiErrorToMessage } from '../api/error'

type Totals = {
  total: number
  published: number
  drafts: number
  total_views: number
  rated_pages: number
  unrated_pages: number
  total_votes: number
  average_rating: number
}
type CategoryStat = { name: string; color: string; emoji: string; count: number }
type RatingDistributionRow = { stars: number; count: number }
type PageStat = {
  id: number
  kb_code: string
  title: string
  updated_at: string | null
  updated_by?: string | null
  view_count: number
  is_published: boolean
  avg_rating?: number | null
  rating_count?: number
}
type TopAuthor = { user_id: number; name: string; edits: number }

type Stats = {
  totals: Totals
  by_category: CategoryStat[]
  recent: PageStat[]
  top_authors: TopAuthor[]
  top_rated_pages: PageStat[]
  low_rated_pages: PageStat[]
  unrated_pages: PageStat[]
  most_viewed_pages: PageStat[]
  rating_distribution: RatingDistributionRow[]
}

const FALLBACK_COLORS = ['#0f766e', '#0284c7', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#64748b']

function fmtDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function fmtRating(value?: number | null) {
  if (!value) return '—'
  return value.toLocaleString('it-IT', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function StatKpiCard({
  icon,
  label,
  value,
  helper,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  helper: string
  accent: string
}) {
  const theme = useTheme()
  return (
    <Card
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 3,
        minHeight: 176,
        color: theme.palette.common.white,
        backgroundImage: `linear-gradient(135deg, ${alpha(accent, 0.72)} 0%, ${alpha(accent, 0.96)} 100%)`,
        border: `1px solid ${alpha(accent, 0.24)}`,
        boxShadow: `0 14px 34px ${alpha(accent, 0.24)}`,
        '&::before': {
          content: '""',
          position: 'absolute',
          width: 132,
          height: 132,
          borderRadius: '50%',
          right: -30,
          top: -18,
          backgroundColor: alpha(theme.palette.common.white, 0.14),
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          width: 160,
          height: 160,
          borderRadius: '50%',
          right: 24,
          bottom: -88,
          backgroundColor: alpha(theme.palette.common.white, 0.1),
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          height: '100%',
          px: 2.5,
          py: 2.25,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
          <Box>
            <Typography
              variant="overline"
              sx={{
                display: 'block',
                color: alpha(theme.palette.common.white, 0.92),
                letterSpacing: 0.36,
                fontSize: 12,
                fontWeight: 700,
                lineHeight: 1.2,
                textTransform: 'none',
              }}
            >
              Statistiche Wiki
            </Typography>
            <Typography variant="h6" sx={{ mt: 0.75, fontWeight: 700, lineHeight: 1.15 }}>
              {label}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2.5,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.common.white, 0.18),
              color: theme.palette.common.white,
              border: `1px solid ${alpha(theme.palette.common.white, 0.18)}`,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        </Stack>

        <Stack spacing={0.75}>
          <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1, letterSpacing: -1.1 }}>
            {value}
          </Typography>
          <Typography variant="body2" sx={{ color: alpha(theme.palette.common.white, 0.9) }}>
            {helper}
          </Typography>
        </Stack>
      </Box>
    </Card>
  )
}

function SectionCard({ title, helper, action, children }: {
  title: string
  helper?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', height: '100%' }}>
      <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            {helper ? (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.35 }}>
                {helper}
              </Typography>
            ) : null}
          </Box>
          {action}
        </Stack>
      </Box>
      {children}
    </Card>
  )
}

function PageListCard({
  title,
  helper,
  pages,
  emptyLabel,
  accent,
  navigate,
  mode,
}: {
  title: string
  helper: string
  pages: PageStat[]
  emptyLabel: string
  accent: string
  navigate: (path: string) => void
  mode: 'rating' | 'views' | 'unrated' | 'recent'
}) {
  const theme = useTheme()
  return (
    <SectionCard title={title} helper={helper}>
      <Stack divider={<Divider />}>
        {pages.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.disabled" fontSize={13}>
              {emptyLabel}
            </Typography>
          </Box>
        ) : (
          pages.map((page, index) => (
            <Stack
              key={`${title}-${page.id}`}
              direction="row"
              spacing={1.25}
              alignItems="center"
              sx={{ px: 2.25, py: 1.35, cursor: 'pointer', '&:hover': { bgcolor: 'grey.50' } }}
              onClick={() => navigate(`/wiki/${page.id}`)}
            >
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha(accent, 0.14),
                  color: accent,
                  fontWeight: 800,
                  fontSize: 11,
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </Box>

              <Stack spacing={0.35} sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1 }}>
                    {page.title}
                  </Typography>
                  <Chip
                    size="small"
                    label={page.is_published ? 'Pubblicata' : 'Bozza'}
                    sx={{
                      height: 18,
                      fontSize: 10,
                      fontWeight: 700,
                      flexShrink: 0,
                      bgcolor: page.is_published ? '#dcfce7' : '#fef9c3',
                      color: page.is_published ? '#166534' : '#854d0e',
                    }}
                  />
                </Stack>

                <Stack direction="row" alignItems="center" spacing={0.85} flexWrap="wrap">
                  <Typography variant="caption" fontFamily="monospace" fontWeight={800} color="primary.main">
                    {page.kb_code || `#${page.id}`}
                  </Typography>

                  {mode === 'rating' ? (
                    <>
                      <Stack direction="row" alignItems="center" spacing={0.25}>
                        <StarRoundedIcon sx={{ fontSize: 14, color: theme.palette.warning.main }} />
                        <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 700 }}>
                          {fmtRating(page.avg_rating)}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                        {page.rating_count ?? 0} voti
                      </Typography>
                    </>
                  ) : null}

                  {mode === 'views' ? (
                    <Stack direction="row" alignItems="center" spacing={0.25}>
                      <VisibilityIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                      <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 700 }}>
                        {page.view_count.toLocaleString('it-IT')}
                      </Typography>
                    </Stack>
                  ) : null}

                  {mode === 'unrated' ? (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                      Nessun voto · aggiornata {fmtDate(page.updated_at)}
                    </Typography>
                  ) : null}

                  {mode === 'recent' ? (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                      Aggiornata {fmtDate(page.updated_at)}
                    </Typography>
                  ) : null}
                </Stack>
              </Stack>
            </Stack>
          ))
        )}
      </Stack>
    </SectionCard>
  )
}

export default function WikiStats() {
  const theme = useTheme()
  const toast = useToast()
  const navigate = useNavigate()
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    ;(async () => {
      try {
        const res = await api.get<Stats>('/wiki-stats/')
        setStats(res.data)
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [toast])

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight={300}>
        <CircularProgress />
      </Stack>
    )
  }

  if (!stats) return null

  const { totals, by_category, recent, top_authors, top_rated_pages, low_rated_pages, unrated_pages, most_viewed_pages, rating_distribution } = stats
  const totalDistribution = rating_distribution.reduce((acc, row) => acc + row.count, 0)

  return (
    <Stack spacing={2.5} sx={{ width: '100%' }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(1, minmax(0, 1fr))',
            sm: 'repeat(2, minmax(0, 1fr))',
            xl: 'repeat(3, minmax(0, 1fr))',
          },
          gap: 2,
        }}
      >
        <StatKpiCard icon={<ArticleOutlinedIcon sx={{ fontSize: 22 }} />} label="Totale pagine" value={totals.total.toLocaleString('it-IT')} helper={`${totals.published} pubblicate · ${totals.drafts} bozze`} accent="#0f766e" />
        <StatKpiCard icon={<VisibilityIcon sx={{ fontSize: 22 }} />} label="Visualizzazioni" value={totals.total_views.toLocaleString('it-IT')} helper="Somma delle aperture registrate sulle pagine Wiki" accent="#0284c7" />
        <StatKpiCard icon={<StarRoundedIcon sx={{ fontSize: 22 }} />} label="Media voto" value={totals.total_votes ? fmtRating(totals.average_rating) : '—'} helper={totals.total_votes ? `${totals.total_votes} voti raccolti` : 'Nessun voto registrato'} accent="#f59e0b" />
        <StatKpiCard icon={<SentimentSatisfiedAltRoundedIcon sx={{ fontSize: 22 }} />} label="Pagine votate" value={totals.rated_pages.toLocaleString('it-IT')} helper="Pagine che hanno ricevuto almeno una valutazione" accent="#7c3aed" />
        <StatKpiCard icon={<StarBorderRoundedIcon sx={{ fontSize: 22 }} />} label="Senza voti" value={totals.unrated_pages.toLocaleString('it-IT')} helper="Pagine ancora da valutare dagli utenti" accent="#ea580c" />
        <StatKpiCard icon={<FolderOpenRoundedIcon sx={{ fontSize: 22 }} />} label="Categorie attive" value={by_category.length.toLocaleString('it-IT')} helper="Categorie con almeno una pagina presente nella knowledge base" accent="#14b8a6" />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.7fr) minmax(340px, 0.95fr)' },
          gap: 2,
          alignItems: 'stretch',
        }}
      >
        <SectionCard title="Pagine per categoria" helper="Distribuzione delle pagine pubblicate e in bozza nelle categorie Wiki">
          <Box sx={{ p: 2.5, pt: 2 }}>
            {by_category.length === 0 ? (
              <Typography color="text.disabled" fontSize={13}>
                Nessuna categoria configurata
              </Typography>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={by_category} margin={{ top: 0, right: 8, left: -20, bottom: 40 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} angle={-32} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'Pagine']} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {by_category.map((entry, index) => (
                      <Cell key={entry.name} fill={entry.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Box>
        </SectionCard>

        <SectionCard
          title="Distribuzione voti"
          helper="Numero di valutazioni 1–5 stelle raccolte sulle pagine Wiki"
          action={<Chip size="small" icon={<InsightsRoundedIcon sx={{ fontSize: '0.9rem !important' }} />} label={`${totalDistribution} voti`} sx={{ height: 22, fontSize: 10, fontWeight: 700 }} />}
        >
          <Box sx={{ p: 2.5, pt: 2 }}>
            {totalDistribution === 0 ? (
              <Typography color="text.disabled" fontSize={13}>
                Nessun voto disponibile ancora
              </Typography>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rating_distribution} margin={{ top: 0, right: 8, left: -12, bottom: 0 }}>
                  <XAxis dataKey="stars" tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(value) => `${value}★`} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'Voti']} labelFormatter={(value) => `${value} stelle`} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {rating_distribution.map((row) => (
                      <Cell key={row.stars} fill={row.stars >= 4 ? '#16a34a' : row.stars === 3 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Box>
        </SectionCard>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' },
          gap: 2,
          alignItems: 'stretch',
        }}
      >
        <PageListCard title="Wiki più votate" helper="Ordinate per media voto e numero di valutazioni" pages={top_rated_pages} emptyLabel="Nessun voto disponibile ancora" accent={theme.palette.warning.main} navigate={navigate} mode="rating" />
        <PageListCard title="Wiki meno votate" helper="Pagine da rivedere perché hanno raccolto feedback più basso" pages={low_rated_pages} emptyLabel="Nessuna pagina con voti disponibili" accent={theme.palette.error.main} navigate={navigate} mode="rating" />
        <PageListCard title="Wiki più viste" helper="Contenuti più consultati dagli utenti" pages={most_viewed_pages} emptyLabel="Nessuna pagina disponibile" accent={theme.palette.info.main} navigate={navigate} mode="views" />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.25fr) minmax(0, 0.95fr) minmax(0, 0.95fr)' },
          gap: 2,
          alignItems: 'stretch',
        }}
      >
        <PageListCard title="Pagine modificate di recente" helper="Ultime pagine aggiornate, utili per controllare attività e freschezza contenuti" pages={recent} emptyLabel="Nessuna pagina ancora" accent={theme.palette.primary.main} navigate={navigate} mode="recent" />

        <SectionCard title="Top autori" helper="Utenti con più revisioni registrate nelle Wiki">
          <Box sx={{ p: 2.25 }}>
            {top_authors.length === 0 ? (
              <Typography color="text.disabled" fontSize={13}>
                Nessuna revisione registrata ancora
              </Typography>
            ) : (
              <Stack spacing={1.4}>
                {top_authors.map((author, index) => (
                  <Stack key={author.user_id} spacing={0.55}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                        <Box sx={{ width: 22, height: 22, borderRadius: 999, bgcolor: FALLBACK_COLORS[index % FALLBACK_COLORS.length], display: 'grid', placeItems: 'center', color: '#fff', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                          {index + 1}
                        </Box>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {author.name}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        {author.edits} mod.
                      </Typography>
                    </Stack>
                    <Box sx={{ height: 6, borderRadius: 999, bgcolor: 'grey.100', overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${Math.round((author.edits / top_authors[0].edits) * 100)}%`, bgcolor: FALLBACK_COLORS[index % FALLBACK_COLORS.length], borderRadius: 999, transition: 'width 0.5s ease' }} />
                    </Box>
                  </Stack>
                ))}
              </Stack>
            )}
          </Box>
        </SectionCard>

        <PageListCard title="Ancora senza voti" helper="Pagine da promuovere o far validare per raccogliere feedback" pages={unrated_pages} emptyLabel="Ottimo: tutte le pagine hanno almeno un voto" accent={theme.palette.secondary.main} navigate={navigate} mode="unrated" />
      </Box>
    </Stack>
  )
}
