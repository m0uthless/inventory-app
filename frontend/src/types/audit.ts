/**
 * Tipo condiviso per le righe degli audit event.
 * Usato da AuditEventsMiniList e AuditEventsTab.
 *
 * Tutti i campi opzionali che non appaiono in entrambi i contesti
 * sono marcati come optional (?) per garantire compatibilità cross-component.
 */
export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "restore"
  | "login"
  | "login_failed"
  | "logout"
  | string;

export type AuditEventRow = {
  id: number;
  created_at: string;
  action: AuditAction;

  // Attore
  actor?: number | null;
  actor_username?: string | null;
  actor_email?: string | null;

  // Entità
  content_type_app?: string | null;
  content_type_model?: string | null;
  object_id?: string | null;
  object_repr?: string | null;
  subject?: string | null;

  // Dettagli evento
  changes?: Record<string, unknown> | null;
  path?: string | null;
  method?: string | null;
};
