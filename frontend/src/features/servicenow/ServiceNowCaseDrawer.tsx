/**
 * ServiceNowCaseDrawer — drawer di dettaglio per i case ServiceNow.
 * Pattern allineato a MonitorDrawer: DrawerShell con canChange/canDelete/restore,
 * tab Dettagli / Audit, anteprima screenshot originale.
 */
import { Avatar, Box, Button, Stack, Typography } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList, DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'
import AuditEventsTab from '../../ui/AuditEventsTab'
import type { ServiceNowCaseRow } from '../../pages/ServiceNowCases'
import { formatOpenedAt } from '../../pages/ServiceNowCases'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ServiceNowCaseDrawerProps {
  open: boolean
  onClose: () => void
  detail: ServiceNowCaseRow | null
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
}

// ─── ServiceNowCaseDrawer ─────────────────────────────────────────────────────

export default function ServiceNowCaseDrawer({
  open, onClose, detail, detailLoading, selectedId,
  drawerTab, onTabChange,
  canChange, canDelete, deleteBusy, restoreBusy,
  onEdit, onDelete, onRestore,
}: ServiceNowCaseDrawerProps) {
  const isDeleted = !!detail?.deleted_at

  const title = detail
    ? detail.number
    : selectedId ? `ServiceNow Case #${selectedId}` : 'ServiceNow Case'

  const subtitle = detail?.account ?? undefined

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      width={420}
      gradient="teal"
      title={title}
      subtitle={subtitle}
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
            {detail.screenshot_url && (
              <Box
                component="img"
                src={detail.screenshot_url}
                alt={`Screenshot ${detail.number}`}
                sx={{
                  width: '100%', borderRadius: 1, border: '1px solid', borderColor: 'divider',
                  display: 'block',
                }}
              />
            )}

            <DrawerSection title="Informazioni">
              <DrawerFieldList rows={[
                { label: 'Numero',  value: detail.number, mono: true },
                { label: 'Account', value: detail.account },
                { label: 'Categoria', value: detail.category_label },
                { label: 'Type', value: detail.case_type_label },
                { label: 'Aperto il', value: formatOpenedAt(detail) },
              ]} />
              {detail.external_url && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
                  component="a"
                  href={detail.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ mt: 1 }}
                >
                  Apri link esterno
                </Button>
              )}
            </DrawerSection>

            <DrawerSection title="Descrizione">
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                {detail.short_description || '—'}
              </Typography>
            </DrawerSection>

            {detail.assigned_to_full_name && (
              <DrawerSection title="Assegnazione">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Avatar src={detail.assigned_to_avatar ?? undefined} sx={{ width: 24, height: 24, fontSize: '0.72rem' }}>
                    {detail.assigned_to_full_name.charAt(0)}
                  </Avatar>
                  <Typography variant="body2" color="text.secondary">{detail.assigned_to_full_name}</Typography>
                </Stack>
              </DrawerSection>
            )}
          </>
        )
      ) : null}

      {/* ── Tab 1: Audit ── */}
      {drawerTab === 1 && selectedId ? (
        <AuditEventsTab appLabel="servicenow" model="servicenowcase" objectId={selectedId} />
      ) : null}
    </DrawerShell>
  )
}
