/**
 * MonitorDrawer — drawer di dettaglio per i monitor workstation.
 * Pattern allineato a InventoryDrawer: DrawerShell con canChange/canDelete/restore,
 * tab Dettagli / Audit, link "Apri workstation" cliccabile.
 */
import { Box, Button, Stack } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList, DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'
import AuditEventsTab from '../../ui/AuditEventsTab'
import type { MonitorRow } from '../../pages/Monitor'

// ─── Colori stato ─────────────────────────────────────────────────────────────

const STATO_HEX: Record<string, string> = {
  in_uso:        '#10b981',
  da_installare: '#f59e0b',
  guasto:        '#ef4444',
  rma:           '#94a3b8',
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MonitorDrawerProps {
  open: boolean
  onClose: () => void
  detail: MonitorRow | null
  detailLoading: boolean
  selectedId: number | null
  drawerTab: number
  onTabChange: (v: number) => void
  canChange: boolean
  canDelete: boolean
  deleteBusy: boolean
  restoreBusy: boolean
  onEdit: () => void
  onDelete: () => void
  onRestore: () => void | Promise<void>
  /** Naviga alla pagina Inventory aprendo il drawer dell'inventory associato. */
  onNavigateToInventory: (inventoryId: number) => void
}

// ─── MonitorDrawer ────────────────────────────────────────────────────────────

export default function MonitorDrawer({
  open, onClose, detail, detailLoading, selectedId,
  drawerTab, onTabChange,
  canChange, canDelete, deleteBusy, restoreBusy,
  onEdit, onDelete, onRestore,
  onNavigateToInventory,
}: MonitorDrawerProps) {
  const color = STATO_HEX[detail?.stato ?? ''] ?? '#94a3b8'
  const isDeleted = !!detail?.deleted_at

  const title = detail
    ? `${detail.produttore}${detail.modello ? ` ${detail.modello}` : ''}`
    : selectedId ? `Monitor #${selectedId}` : 'Monitor'

  const subtitle = detail?.site_name ?? undefined

  const statusLabel = detail ? `● ${detail.stato_label}` : undefined

  // ── Header: bottone workstation ────────────────────────────────────────────
  const header = detail?.inventory ? (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
      <Button
        size="small"
        variant="contained"
        endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
        sx={{ bgcolor: '#0d9488', color: '#fff', fontWeight: 600, '&:hover': { bgcolor: '#0f766e' } }}
        onClick={() => onNavigateToInventory(detail.inventory!)}
      >
        Apri workstation
      </Button>
    </Stack>
  ) : null

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      width={420}
      gradient="teal"
      statusLabel={statusLabel}
      title={title}
      subtitle={subtitle}
      caption={detail?.tipo_label}
      loading={detailLoading}
      canChange={canChange && !isDeleted}
      canDelete={canDelete && !isDeleted}
      deleteBusy={deleteBusy}
      restoreBusy={restoreBusy}
      deleted={isDeleted}
      onEdit={onEdit}
      onDelete={onDelete}
      onRestore={onRestore}
      tabs={['Dettagli', 'Audit']}
      tabValue={drawerTab}
      onTabChange={onTabChange}
    >
      {/* ── Tab 0: Dettagli ── */}
      {drawerTab === 0 ? (
        detailLoading ? <DrawerLoadingState /> :
        !detail ? <DrawerEmptyState /> : (
          <>
            {header}

            <DrawerSection title="Informazioni">
              <DrawerFieldList rows={[
                { label: 'Produttore', value: detail.produttore },
                { label: 'Modello',    value: detail.modello },
                { label: 'Seriale',    value: detail.seriale, mono: true },
                { label: 'Tipo',       value: detail.tipo_label },
                { label: 'Radinet',    value: detail.radinet ? 'Sì' : 'No' },
              ]} />
            </DrawerSection>

            <DrawerSection title="Posizione">
              <DrawerFieldList rows={[
                { label: 'Workstation', value: detail.inventory_name },
                { label: 'Sede',        value: detail.site_name },
              ]} />
            </DrawerSection>

            {/* Badge stato colorato */}
            <Box
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.75,
                px: 1.25, py: 0.5, borderRadius: 1,
                bgcolor: `${color}18`, border: `1px solid ${color}44`,
                fontSize: '0.75rem', fontWeight: 700, color,
                alignSelf: 'flex-start',
              }}
            >
              ● {detail.stato_label}
            </Box>
          </>
        )
      ) : null}

      {/* ── Tab 1: Audit ── */}
      {drawerTab === 1 && selectedId ? (
        <AuditEventsTab appLabel="inventory" model="monitor" objectId={selectedId} />
      ) : null}
    </DrawerShell>
  )
}
