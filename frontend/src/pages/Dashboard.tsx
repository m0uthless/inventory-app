import * as React from 'react'
import { Box, Button, ButtonBase, CircularProgress, IconButton, Tooltip } from '@mui/material'
import PauseRoundedIcon from '@mui/icons-material/PauseRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { useAuth } from '../auth/AuthProvider'
import { CampoIcon } from '../ui/campo'
import { useOwnPageHeader } from '../layout/PageHeaderContext'
import DashboardGrid from '../features/dashboard/DashboardGrid'
import { useDashboardLayout } from '../features/dashboard/useDashboardLayout'
import { useDashboardEditMode } from '../features/dashboard/DashboardEditModeContext'
import { WIDGET_REGISTRY, findFreeSlot } from '../features/dashboard/dashboardTypes'
import { WIDGET_MODULE } from '../modules/moduleRegistry'
import { ModuleWidget } from '../features/dashboard/ModuleWidget'
import { useModules } from '../modules/useModules'
import DashboardHero from '../features/dashboard/DashboardHero'
import { ANIM_CLASS } from '../features/dashboard/widgets/tints'

// Ordine e altezza dei widget quando la griglia non c'è (telefono, o catalogo non raggiungibile).
const STACK: [string, number][] = [
  ['issues', 330], ['maintenance', 330], ['area-tasks', 330], ['team', 150], ['birthdays', 230],
  ['announcements', 260], ['todo', 260], ['sticky-note', 220], ['contributor', 250],
]

/** Widget uno sotto l'altro (telefono e ripiego). */
function StackedWidgets({ columns = 1 }: { columns?: number }) {
  const { isHidden } = useModules()
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: '12px' }}>
      {STACK.filter(([k]) => !isHidden(WIDGET_MODULE[k])).map(([k, h]) => {
        const W = WIDGET_REGISTRY[k]
        return W ? <Box key={k} sx={{ minHeight: h || undefined, display: 'flex' }}><ModuleWidget widgetKey={k}><W /></ModuleWidget></Box> : null
      })}
    </Box>
  )
}

// ─── Dashboard desktop dinamica (griglia 6 colonne, drag/resize in modalità "Personalizza") ─

function DynamicDesktopLayout() {
  const { editMode } = useDashboardEditMode()
  const { widgets, layoutItems, setLayoutItems, loading, save } = useDashboardLayout()
  const { me } = useAuth()
  const toast = useToast()
  const [settingDefault, setSettingDefault] = React.useState(false)
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
    return <StackedWidgets columns={2} />
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

  const handleSetDefaultLayout = async () => {
    setSettingDefault(true)
    try {
      await api.post('/dashboard-default-layout/set_mine/')
      toast.success('Layout predefinito impostato: i nuovi utenti lo vedranno al primo accesso.')
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSettingDefault(false)
    }
  }

  return (
    <>
      {editMode ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', p: '8px 12px', mb: 1.75, borderRadius: '10px', border: '1px solid', borderColor: 'archie.fieldLine', bgcolor: 'archie.field', fontSize: 12.5 }}>
          <CampoIcon name="columns" size={16} />
          <Box component="span"><b>Personalizza</b> · trascina dalla maniglia, ridimensiona dai bordi, nascondi con l'occhio. Si salva da solo.</Box>
          {hiddenWidgets.length ? (
            <Box sx={{ display: 'inline-flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
              <Box component="span" sx={{ color: 'text.secondary' }}>Nascosti:</Box>
              {hiddenWidgets.map((w) => (
                <ButtonBase key={w.key} onClick={() => handleShowWidget(w.key)} sx={{ gap: 0.5, height: 24, px: 1, borderRadius: '12px', fontSize: 11.5, border: '1px dashed', borderColor: 'archie.borderStrong', bgcolor: 'background.paper', color: 'text.secondary', '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}>
                  <CampoIcon name="eye" size={12} />{w.label}
                </ButtonBase>
              ))}
            </Box>
          ) : null}
          <Box sx={{ flex: 1 }} />
          {me?.is_superuser ? (
            <Button size="small" variant="outlined" color="inherit" sx={{ bgcolor: 'background.paper' }} onClick={handleSetDefaultLayout} disabled={settingDefault}>
              Imposta come predefinito
            </Button>
          ) : null}
        </Box>
      ) : null}
      <DashboardGrid
        widgets={widgets}
        layoutItems={layoutItems}
        onLayoutItemsChange={setLayoutItems}
        editMode={editMode}
      />
    </>
  )
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

const ANIM_KEY = 'archie-dash-anim'

/**
 * Dashboard "Aurora" (anteprima design-previews/db-base.html, variante F): fascia con lo sfondo
 * animato della login in testa, widget nei colori dell'app che vi salgono sopra, griglia personalizzabile.
 * Le animazioni (sfondo, coriandoli, palloncini) si mettono in pausa con un pulsante, scelta ricordata nel browser.
 */
export default function Dashboard() {
  useOwnPageHeader()
  const { editMode, toggleEditMode } = useDashboardEditMode()
  const [paused, setPaused] = React.useState(() => { try { return localStorage.getItem(ANIM_KEY) === 'off' } catch { return false } })
  const togglePaused = () => setPaused((p) => { try { localStorage.setItem(ANIM_KEY, p ? 'on' : 'off') } catch { /* niente */ } return !p })
  const onBand = { borderColor: 'transparent', boxShadow: '0 14px 34px -14px rgb(16 40 34 / .28), 0 2px 6px rgb(16 40 34 / .06)' }

  const actions = (
    <>
      <Tooltip title={paused ? 'Riprendi le animazioni' : 'Metti in pausa le animazioni'}>
        <IconButton aria-label={paused ? 'Riprendi le animazioni' : 'Metti in pausa le animazioni'} aria-pressed={paused} onClick={togglePaused}
          sx={{ width: 34, height: 34, borderRadius: '8px', bgcolor: (t) => `color-mix(in srgb, ${t.palette.background.paper} 80%, transparent)`, '&:hover': { bgcolor: 'background.paper' } }}>
          {paused ? <PlayArrowRoundedIcon sx={{ fontSize: 18 }} /> : <PauseRoundedIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Tooltip>
      <Button variant={editMode ? 'contained' : 'outlined'} color={editMode ? 'primary' : 'inherit'} startIcon={<CampoIcon name="columns" size={15} />} onClick={toggleEditMode}
        sx={{ display: { xs: 'none', md: 'inline-flex' }, ...(editMode ? {} : { borderColor: 'transparent', bgcolor: (t) => `color-mix(in srgb, ${t.palette.background.paper} 80%, transparent)`, '&:hover': { bgcolor: 'background.paper', borderColor: 'transparent' } }) }}>
        {editMode ? 'Fine' : 'Personalizza'}
      </Button>
    </>
  )

  return (
    <Box className={paused ? 'anim-off' : undefined} sx={{ display: 'flex', flexDirection: 'column', width: '100%', [`&.anim-off .${ANIM_CLASS}`]: { animationPlayState: 'paused' } }}>
      <DashboardHero paused={paused} actions={actions} />
      {/* Desktop: griglia personalizzabile; la prima riga sale sulla fascia */}
      <Box sx={{ display: { xs: 'none', md: 'block' }, position: 'relative', zIndex: 1, mt: editMode ? 2 : '-64px', mx: editMode ? 0 : '14px', '& .on-band > div:last-of-type > section': editMode ? {} : onBand }}>
        <DynamicDesktopLayout />
      </Box>
      {/* Telefono: widget uno sotto l'altro */}
      <Box sx={{ display: { xs: 'block', md: 'none' }, mt: 1.5 }}>
        <StackedWidgets />
      </Box>
    </Box>
  )
}
