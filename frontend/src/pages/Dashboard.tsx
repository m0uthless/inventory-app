import * as React from 'react'
import { Box, Button, ButtonBase, CircularProgress } from '@mui/material'
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

// Ordine e altezza dei widget quando la griglia non c'è (telefono, o catalogo non raggiungibile).
const STACK: [string, number][] = [
  ['weather', 0], ['quick-actions-pair', 76], ['issues', 330], ['area-tasks', 330], ['maintenance', 330], ['team', 150],
  ['announcements', 260], ['todo', 260], ['sticky-note', 220], ['birthdays', 130], ['contributor', 250],
]

/** Widget uno sotto l'altro (telefono e ripiego). */
function StackedWidgets({ columns = 1 }: { columns?: number }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: '12px' }}>
      {STACK.map(([k, h]) => {
        const W = WIDGET_REGISTRY[k]
        return W ? <Box key={k} sx={{ minHeight: h || undefined, display: 'flex', gridColumn: k === 'weather' || k === 'quick-actions-pair' ? '1 / -1' : undefined }}><W /></Box> : null
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

/** Dashboard "Tinte" (anteprima design-previews/db-base.html): widget con tinte tenui, griglia personalizzabile. */
export default function Dashboard() {
  useOwnPageHeader()
  const { editMode, toggleEditMode } = useDashboardEditMode()
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <Box sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'flex-end', mb: 1.25 }}>
        <Button variant={editMode ? 'contained' : 'outlined'} color={editMode ? 'primary' : 'inherit'} startIcon={<CampoIcon name="columns" size={15} />} onClick={toggleEditMode}>
          {editMode ? 'Fine' : 'Personalizza'}
        </Button>
      </Box>
      {/* Desktop: griglia personalizzabile */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <DynamicDesktopLayout />
      </Box>
      {/* Telefono: widget uno sotto l'altro */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <StackedWidgets />
      </Box>
    </Box>
  )
}
