import * as React from 'react'
import { Box, CircularProgress, Chip, Stack, Typography } from '@mui/material'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import WeatherHeroCard from '../ui/WeatherHeroCard'
import ContributorCard from '../ui/ContributorCard'
import RecentIssuesCard from '../ui/RecentIssuesCard'
import AnnouncementsCard from '../ui/AnnouncementsCard'
import TodoCard from '../ui/TodoCard'
import AreaTaskCard from '../ui/AreaTaskCard'
import MaintenanceAlertsCard from '../ui/MaintenanceAlertsCard'
import DashboardGrid from '../features/dashboard/DashboardGrid'
import { useDashboardLayout } from '../features/dashboard/useDashboardLayout'
import { useDashboardEditMode } from '../features/dashboard/DashboardEditModeContext'
import { findFreeSlot } from '../features/dashboard/dashboardTypes'

// ─── Widget carousel (mobile) ─────────────────────────────────────────────────

const WIDGETS = [
  <RecentIssuesCard key="issues" />,
  <AreaTaskCard key="area-tasks" />,
  <AnnouncementsCard key="announcements" />,
  <TodoCard key="todo" />,
  <MaintenanceAlertsCard key="maintenance" />,
]
const TOTAL = WIDGETS.length

function WidgetCarousel() {
  const [index, setIndex] = React.useState(0)
  const touchStartX = React.useRef<number | null>(null)

  const prev = () => setIndex(i => (i - 1 + TOTAL) % TOTAL)
  const next = () => setIndex(i => (i + 1) % TOTAL)

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) {
      if (dx < 0) next()
      else prev()
    }
    touchStartX.current = null
  }

  return (
    <>
      <Box
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        sx={{ overflow: 'hidden', borderRadius: 1 }}
      >
        {WIDGETS[index]}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.75, mt: 1.25 }}>
        {Array.from({ length: TOTAL }, (_, i) => (
          <Box
            key={i}
            onClick={() => setIndex(i)}
            sx={{
              width: i === index ? 18 : 7,
              height: 7,
              borderRadius: '999px',
              bgcolor: i === index ? 'primary.main' : 'divider',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
            }}
          />
        ))}
      </Box>
    </>
  )
}

// ─── Dashboard desktop legacy (fallback se il caricamento del layout dinamico fallisce) ─

function LegacyDesktopLayout() {
  return (
    <>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 350px' },
        gap: 2,
        alignItems: 'stretch',
      }}>
        <WeatherHeroCard />
        <ContributorCard />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, alignItems: 'stretch', mt: 2.5 }}>
        <RecentIssuesCard />
        <AreaTaskCard />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, alignItems: 'stretch', mt: 2.5 }}>
        <AnnouncementsCard />
        <TodoCard />
      </Box>

      <Box sx={{ mt: 2.5 }}>
        <MaintenanceAlertsCard />
      </Box>
    </>
  )
}

// ─── Dashboard desktop dinamica (griglia 6 colonne, drag/resize in modalità "Personalizza") ─

function DynamicDesktopLayout() {
  const { editMode } = useDashboardEditMode()
  const { widgets, layoutItems, setLayoutItems, loading, save } = useDashboardLayout()
  const wasEditMode = React.useRef(editMode)
  const layoutItemsRef = React.useRef(layoutItems)
  const hasPendingChanges = React.useRef(false)
  layoutItemsRef.current = layoutItems

  // Ogni modifica al layout mentre si è in modalità "Personalizza" (drag,
  // resize, nascondi, mostra) marca che c'è qualcosa da salvare.
  React.useEffect(() => {
    if (editMode) hasPendingChanges.current = true
  }, [layoutItems, editMode])

  // Salvataggio automatico con debounce: non ad ogni singolo frame di drag,
  // ma poco dopo l'ultima modifica. Prima salvavamo solo allo spegnimento
  // esplicito del toggle "Personalizza" dal menu — se l'utente cambiava
  // pagina senza spegnerlo prima, il componente si smontava (la route
  // cambia, <Outlet/> smonta Dashboard) prima che quel salvataggio potesse
  // scattare, perdendo le modifiche ("torno in dashboard e vedo il
  // default"). Il debounce copre il caso comune; l'effetto di flush allo
  // smontaggio sotto copre anche il caso limite di navigazione immediata.
  React.useEffect(() => {
    if (!editMode || !hasPendingChanges.current) return
    const timer = setTimeout(() => {
      save(layoutItemsRef.current)
      hasPendingChanges.current = false
    }, 800)
    return () => clearTimeout(timer)
  }, [layoutItems, editMode, save])

  // Spegnimento esplicito di "Personalizza" (menu utente): salva subito,
  // senza aspettare il debounce.
  React.useEffect(() => {
    if (wasEditMode.current && !editMode && hasPendingChanges.current) {
      save(layoutItemsRef.current)
      hasPendingChanges.current = false
    }
    wasEditMode.current = editMode
  }, [editMode, save])

  // Flush finale allo smontaggio del componente (es. navigazione via pagina
  // mentre "Personalizza" è ancora acceso e ci sono modifiche più recenti
  // degli 800ms di debounce): invia comunque l'ultimo stato noto.
  React.useEffect(() => {
    return () => {
      if (hasPendingChanges.current) {
        save(layoutItemsRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  if (widgets.length === 0) {
    // Catalogo widget non disponibile (endpoint non raggiungibile/errore):
    // ripiega sul layout fisso storico invece di mostrare una dashboard vuota.
    return <LegacyDesktopLayout />
  }

  const hiddenWidgets = widgets.filter(w => {
    const item = layoutItems.find(it => it.widget_key === w.key)
    return item ? !item.visible : false
  })

  const handleShowWidget = (widgetKey: string) => {
    const widget = widgets.find(w => w.key === widgetKey)
    if (!widget) return
    const visibleItems = layoutItems.filter(it => it.visible)
    const { x, y } = findFreeSlot(visibleItems, widget.default_w, widget.default_h)
    setLayoutItems(layoutItems.map(it =>
      it.widget_key === widgetKey
        ? { ...it, visible: true, x, y, w: widget.default_w, h: widget.default_h }
        : it
    ))
  }

  return (
    <>
      {editMode && hiddenWidgets.length > 0 && (
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Widget nascosti:
          </Typography>
          {hiddenWidgets.map(w => (
            <Chip
              key={w.key}
              size="small"
              label={w.label}
              icon={<VisibilityOutlinedIcon sx={{ fontSize: 15 }} />}
              onClick={() => handleShowWidget(w.key)}
              variant="outlined"
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Stack>
      )}
      <DashboardGrid
        widgets={widgets}
        layoutItems={layoutItems}
        onLayoutItemsChange={setLayoutItems}
        editMode={editMode}
      />
    </>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, width: '100%' }}>

      {/* Desktop: griglia dinamica personalizzabile */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <DynamicDesktopLayout />
      </Box>

      {/* Mobile: carousel swipe (layout fisso, non personalizzabile) */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 2,
          alignItems: 'stretch',
          mb: 2,
        }}>
          <WeatherHeroCard />
          <ContributorCard />
        </Box>
        <WidgetCarousel />
      </Box>

    </Box>
  )
}
