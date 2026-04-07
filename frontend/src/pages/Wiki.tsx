import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Rating,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined'
import ReorderIcon from '@mui/icons-material/Reorder'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined'
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import { useLocation, useNavigate } from 'react-router-dom'

import { api } from '@shared/api/client'
import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'
import { compactResetButtonSx } from '@shared/ui/toolbarStyles'
import FilterChip from '@shared/ui/FilterChip'
import { useAuth } from '../auth/AuthProvider'
import WikiCategoryManager from '../ui/WikiCategoryManager'

type Category = { id: number; name: string; sort_order: number; emoji?: string; color?: string }

type PageRow = {
  id: number
  title: string
  slug: string
  category?: number | null
  category_name?: string | null
  category_emoji?: string | null
  category_color?: string | null
  summary?: string | null
  tags?: string[] | null
  is_published: boolean
  average_rating?: number | null
  rating_count?: number
  attachment_count?: number
  view_count?: number
  created_by_username?: string | null
  updated_by_username?: string | null
  updated_at?: string | null
}

type ApiPage<T> = { count: number; results: T[] }

type ViewMode = 'grid' | 'list'
type SortValue = 'title' | '-updated_at' | '-average_rating' | '-view_count' | '-created_at'

const ACCENTS = ['#0f766e', '#3b82f6', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#10b981', '#f97316']
const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'title', label: 'Titolo A-Z' },
  { value: '-updated_at', label: 'Aggiornate di recente' },
  { value: '-average_rating', label: 'Più votate' },
  { value: '-view_count', label: 'Più viste' },
  { value: '-created_at', label: 'Più recenti' },
]

function fmtDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

function ratingText(page: PageRow): string {
  if ((page.rating_count ?? 0) <= 0) return 'Ancora nessun voto'
  return `${(page.average_rating ?? 0).toLocaleString('it-IT', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} · ${page.rating_count} vot${(page.rating_count ?? 0) === 1 ? 'o' : 'i'}`
}

function resultLabel(count: number): string {
  return `${count} pagin${count === 1 ? 'a' : 'e'}`
}

function statText(value?: number | null): string {
  return (value ?? 0).toLocaleString('it-IT')
}

function WikiCard({
  page,
  categoryMap,
  onClick,
}: {
  page: PageRow
  categoryMap: Record<number, Category>
  onClick: () => void
}) {
  const cat = page.category ? categoryMap[page.category] : null
  const accent = cat?.color ?? ACCENTS[(page.category ?? 0) % ACCENTS.length]
  const emoji = cat?.emoji ?? '📄'
  const tags = (page.tags ?? []).slice(0, 3)

  return (
    <Card
      onClick={onClick}
      variant="outlined"
      sx={{
        cursor: 'pointer',
        borderRadius: 1.5,
        borderColor: 'grey.200',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'box-shadow 0.15s, border-color 0.15s, transform 0.15s',
        '&:hover': {
          boxShadow: `0 10px 24px ${accent}18`,
          borderColor: accent,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Box sx={{ height: 3, bgcolor: accent, flexShrink: 0 }} />

      <Stack sx={{ p: 1.75, flex: 1 }} spacing={1.15}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap">
            <Typography sx={{ fontSize: 18, lineHeight: 1 }}>{emoji}</Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: accent,
                bgcolor: `${accent}16`,
                px: 0.75,
                py: 0.3,
                borderRadius: 0.75,
                letterSpacing: '0.03em',
                fontSize: 10.5,
              }}
            >
              {page.category_name ?? 'Senza categoria'}
            </Typography>
          </Stack>
          {!page.is_published && (
            <Chip
              label="Bozza"
              size="small"
              sx={{
                height: 18,
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 0.75,
                bgcolor: '#fef9c3',
                color: '#854d0e',
              }}
            />
          )}
        </Stack>

        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            color: 'text.primary',
            lineHeight: 1.35,
            letterSpacing: '-0.01em',
            minHeight: 38,
          }}
        >
          {page.title}
        </Typography>

        {page.summary ? (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontSize: 12.5,
              lineHeight: 1.55,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: 58,
            }}
          >
            {page.summary}
          </Typography>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: 12.5, minHeight: 58 }}>
            Nessun riepilogo disponibile.
          </Typography>
        )}

        <Stack direction="row" alignItems="center" spacing={0.75}>
          <Rating
            value={page.average_rating ?? 0}
            precision={0.1}
            readOnly
            size="small"
            sx={{
              '& .MuiRating-iconFilled': { color: '#f59e0b' },
              '& .MuiRating-iconEmpty': { color: '#fcd34d' },
              fontSize: 16,
            }}
          />
          <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary' }}>
            {ratingText(page)}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={0.5} flexWrap="wrap">
          {tags.map((t) => (
            <Typography
              key={t}
              variant="caption"
              sx={{
                fontSize: 10.5,
                fontWeight: 600,
                color: 'text.disabled',
                bgcolor: 'grey.50',
                px: 0.75,
                py: 0.25,
                borderRadius: 0.75,
              }}
            >
              {t}
            </Typography>
          ))}
          {(page.tags?.length ?? 0) > 3 && (
            <Typography variant="caption" sx={{ fontSize: 10.5, color: 'text.disabled' }}>
              +{page.tags!.length - 3}
            </Typography>
          )}
        </Stack>

        <Stack spacing={0.75} sx={{ pt: 1, borderTop: '1px solid', borderColor: 'grey.100' }}>
          <Stack direction="row" alignItems="center" spacing={1.2} flexWrap="wrap">
            <Stack direction="row" alignItems="center" spacing={0.45}>
              <VisibilityOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
              <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary' }}>
                {statText(page.view_count)}
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.45}>
              <AttachFileOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
              <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary' }}>
                {statText(page.attachment_count)}
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.45}>
              <ScheduleOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
              <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary' }}>
                {fmtDate(page.updated_at) || '—'}
              </Typography>
            </Stack>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <PersonOutlineOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>
              {page.updated_by_username || page.created_by_username || 'Autore non disponibile'}
            </Typography>
          </Stack>
        </Stack>
      </Stack>
    </Card>
  )
}

function WikiListRow({
  page,
  categoryMap,
  onClick,
}: {
  page: PageRow
  categoryMap: Record<number, Category>
  onClick: () => void
}) {
  const cat = page.category ? categoryMap[page.category] : null
  const accent = cat?.color ?? ACCENTS[(page.category ?? 0) % ACCENTS.length]
  const emoji = cat?.emoji ?? '📄'
  const tags = (page.tags ?? []).slice(0, 4)

  return (
    <Card
      onClick={onClick}
      variant="outlined"
      sx={{
        cursor: 'pointer',
        borderRadius: 1.5,
        borderColor: 'grey.200',
        transition: 'box-shadow 0.15s, border-color 0.15s, transform 0.15s',
        '&:hover': {
          boxShadow: `0 8px 20px ${accent}18`,
          borderColor: accent,
          transform: 'translateY(-1px)',
        },
      }}
    >
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} justifyContent="space-between" sx={{ px: 1.75, py: 1.5 }}>
        <Stack spacing={0.95} sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap">
            <Typography sx={{ fontSize: 18, lineHeight: 1 }}>{emoji}</Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: accent,
                bgcolor: `${accent}16`,
                px: 0.75,
                py: 0.25,
                borderRadius: 0.75,
                letterSpacing: '0.03em',
                fontSize: 10.5,
              }}
            >
              {page.category_name ?? 'Senza categoria'}
            </Typography>
            {!page.is_published && (
              <Chip
                label="Bozza"
                size="small"
                sx={{
                  height: 18,
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 0.75,
                  bgcolor: '#fef9c3',
                  color: '#854d0e',
                }}
              />
            )}
          </Stack>

          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              color: 'text.primary',
              lineHeight: 1.3,
              letterSpacing: '-0.01em',
            }}
          >
            {page.title}
          </Typography>

          {page.summary ? (
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontSize: 12.5,
                lineHeight: 1.55,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {page.summary}
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: 12.5 }}>
              Nessun riepilogo disponibile.
            </Typography>
          )}

          {!!tags.length && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {tags.map((t) => (
                <Typography
                  key={t}
                  variant="caption"
                  sx={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: 'text.disabled',
                    bgcolor: 'grey.50',
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 0.75,
                  }}
                >
                  {t}
                </Typography>
              ))}
              {(page.tags?.length ?? 0) > 4 && (
                <Typography variant="caption" sx={{ fontSize: 10.5, color: 'text.disabled' }}>
                  +{page.tags!.length - 4}
                </Typography>
              )}
            </Stack>
          )}
        </Stack>

        <Stack
          spacing={0.9}
          alignItems={{ xs: 'flex-start', lg: 'flex-end' }}
          justifyContent="space-between"
          sx={{ minWidth: { xs: 0, lg: 240 }, flexShrink: 0 }}
        >
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Rating
              value={page.average_rating ?? 0}
              precision={0.1}
              readOnly
              size="small"
              sx={{
                '& .MuiRating-iconFilled': { color: '#f59e0b' },
                '& .MuiRating-iconEmpty': { color: '#fcd34d' },
                fontSize: 16,
              }}
            />
            <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary' }}>
              {ratingText(page)}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1.15} flexWrap="wrap" justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}>
            <Stack direction="row" alignItems="center" spacing={0.4}>
              <VisibilityOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
              <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary' }}>
                {statText(page.view_count)}
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.4}>
              <AttachFileOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
              <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary' }}>
                {statText(page.attachment_count)}
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.4}>
              <ScheduleOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
              <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary' }}>
                {fmtDate(page.updated_at) || '—'}
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={0.5}>
            <PersonOutlineOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>
              {page.updated_by_username || page.created_by_username || 'Autore non disponibile'}
            </Typography>
          </Stack>
        </Stack>
      </Stack>
    </Card>
  )
}

export default function Wiki() {
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { hasPerm } = useAuth()
  const canManageCategories =
    hasPerm('wiki.add_wikicategory') || hasPerm('wiki.change_wikicategory') || hasPerm('wiki.delete_wikicategory')

  const [pages, setPages] = React.useState<PageRow[]>([])
  const [catManagerOpen, setCatManagerOpen] = React.useState(false)
  const [categories, setCategories] = React.useState<Category[]>([])
  const [categoryMap, setCategoryMap] = React.useState<Record<number, Category>>({})
  const [loading, setLoading] = React.useState(false)

  const [q, setQ] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [categoryId, setCategoryId] = React.useState<number | ''>('')
  const [published, setPublished] = React.useState<'' | 'true' | 'false'>('')
  const [viewMode, setViewMode] = React.useState<ViewMode>(() =>
    window.localStorage.getItem('wiki_view_mode') === 'list' ? 'list' : 'grid',
  )
  const [sortBy, setSortBy] = React.useState<SortValue>(() => {
    const raw = window.localStorage.getItem('wiki_sort_mode')
    return SORT_OPTIONS.some((opt) => opt.value === raw) ? (raw as SortValue) : '-updated_at'
  })

  React.useEffect(() => {
    window.localStorage.setItem('wiki_view_mode', viewMode)
  }, [viewMode])

  React.useEffect(() => {
    window.localStorage.setItem('wiki_sort_mode', sortBy)
  }, [sortBy])

  const loadCategories = React.useCallback(async () => {
    try {
      const res = await api.get<ApiPage<Category>>('/wiki-categories/', {
        params: { ordering: 'sort_order,name', page_size: 200 },
      })
      const cats = res.data.results ?? []
      setCategories(cats)
      setCategoryMap(Object.fromEntries(cats.map((c) => [c.id, c])))
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }, [toast])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page_size: 500, ordering: sortBy }
      if (search) params.search = search
      if (categoryId !== '') params.category = categoryId
      if (published !== '') params.is_published = published
      const res = await api.get<ApiPage<PageRow>>('/wiki-pages/', { params })
      setPages(res.data.results ?? [])
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setLoading(false)
    }
  }, [search, categoryId, published, sortBy, toast])

  React.useEffect(() => {
    loadCategories()
  }, [loadCategories])

  React.useEffect(() => {
    load()
  }, [load])

  React.useEffect(() => {
    const state = location.state as { openCategoryManager?: boolean } | null
    if (canManageCategories && state?.openCategoryManager) {
      setCatManagerOpen(true)
      navigate(location.pathname + location.search, { replace: true, state: {} })
    }
  }, [canManageCategories, location.pathname, location.search, location.state, navigate])


  const reset = React.useCallback(() => {
    setQ('')
    setSearch('')
    setCategoryId('')
    setPublished('')
    setSortBy('-updated_at')
  }, [])

  const activeFilterCount = (categoryId !== '' ? 1 : 0) + (published !== '' ? 1 : 0)
  const selectedSortLabel = SORT_OPTIONS.find((opt) => opt.value === sortBy)?.label ?? 'Aggiornate di recente'

  return (
    <Stack spacing={2}>
      <Card variant="outlined" sx={{ borderRadius: 1.5, p: 1.25 }}>
        <Stack spacing={1.15}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={1}
            alignItems={{ xs: 'stretch', lg: 'center' }}
            sx={{
              flexWrap: { lg: 'nowrap' },
              '& .MuiButton-root': { height: 40 },
              '& .MuiToggleButton-root': { height: 40 },
            }}
          >
            <TextField
              size="small"
              placeholder="Cerca"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSearch(q)
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                width: { xs: '100%', lg: 360 },
                flexShrink: 0,
                '& .MuiInputBase-root': {
                  height: 40,
                  fontSize: '0.95rem',
                  borderRadius: 1.5,
                  bgcolor: 'transparent',
                },
                '& .MuiInputBase-input': { py: 0 },
              }}
            />

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                width: { xs: '100%', lg: 'auto' },
                flexWrap: 'wrap',
              }}
            >
              <FilterChip
                compact
                activeCount={activeFilterCount}
                onReset={() => {
                  setCategoryId('')
                  setPublished('')
                }}
              >
                <FormControl size="small" fullWidth>
                  <InputLabel>Categoria</InputLabel>
                  <Select
                    label="Categoria"
                    value={categoryId === '' ? '' : String(categoryId)}
                    onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
                  >
                    <MenuItem value="">Tutte</MenuItem>
                    {categories.map((c) => (
                      <MenuItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth>
                  <InputLabel>Stato</InputLabel>
                  <Select
                    label="Stato"
                    value={published}
                    onChange={(e) => setPublished(e.target.value as '' | 'true' | 'false')}
                  >
                    <MenuItem value="">Tutti</MenuItem>
                    <MenuItem value="true">Pubblicato</MenuItem>
                    <MenuItem value="false">Bozza</MenuItem>
                  </Select>
                </FormControl>
              </FilterChip>

              <FormControl size="small" sx={{ minWidth: 190 }}>
                <InputLabel>Ordina</InputLabel>
                <Select label="Ordina" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortValue)}>
                  {SORT_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <ToggleButtonGroup
                size="small"
                exclusive
                value={viewMode}
                onChange={(_e, value: ViewMode | null) => {
                  if (!value) return
                  setViewMode(value)
                }}
                sx={{
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  overflow: 'hidden',
                  '& .MuiToggleButtonGroup-grouped': {
                    px: 1.1,
                    py: 0,
                    border: 0,
                    borderRadius: '0 !important',
                    color: 'text.secondary',
                  },
                  '& .MuiToggleButton-root.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: '#fff',
                    '&:hover': { bgcolor: 'primary.dark' },
                  },
                  '& .MuiToggleButton-root:not(.Mui-selected):hover': { bgcolor: 'grey.100' },
                }}
              >
                <ToggleButton value="grid" aria-label="Vista griglia">
                  <Tooltip title="Griglia">
                    <GridViewOutlinedIcon sx={{ fontSize: 18 }} />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="list" aria-label="Vista elenco">
                  <Tooltip title="Elenco">
                    <ReorderIcon sx={{ fontSize: 18 }} />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>

              <Tooltip title="Reimposta" arrow>
                <Button size="small" variant="contained" onClick={reset} aria-label="Reimposta" sx={compactResetButtonSx}>
                  <RestartAltIcon />
                </Button>
              </Tooltip>
            </Box>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} justifyContent="space-between">
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 12 }}>
              {resultLabel(pages.length)} · ordinamento: {selectedSortLabel}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 12 }}>
              Vista {viewMode === 'grid' ? 'griglia' : 'elenco'}
            </Typography>
          </Stack>
        </Stack>
      </Card>

      {loading ? (
        <Stack alignItems="center" py={6}>
          <CircularProgress size={28} />
        </Stack>
      ) : pages.length === 0 ? (
        <Stack alignItems="center" py={8} spacing={1}>
          <ArticleOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
          <Typography color="text.secondary">Nessuna pagina trovata.</Typography>
          {(search || categoryId !== '' || published !== '') && (
            <Button size="small" onClick={reset}>
              Azzera filtri
            </Button>
          )}
        </Stack>
      ) : viewMode === 'grid' ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(245px, 1fr))',
            gap: 1.5,
          }}
        >
          {pages.map((p) => (
            <WikiCard key={p.id} page={p} categoryMap={categoryMap} onClick={() => navigate(`/wiki/${p.id}`)} />
          ))}
        </Box>
      ) : (
        <Stack spacing={1.25}>
          {pages.map((p) => (
            <WikiListRow key={p.id} page={p} categoryMap={categoryMap} onClick={() => navigate(`/wiki/${p.id}`)} />
          ))}
        </Stack>
      )}

      {canManageCategories && (
        <WikiCategoryManager
          open={catManagerOpen}
          onClose={() => setCatManagerOpen(false)}
          onChanged={() => {
            loadCategories()
            load()
          }}
        />
      )}
    </Stack>
  )
}
