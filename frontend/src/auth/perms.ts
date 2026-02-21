// Central place for all permission strings used by the UI.
// Keep this file as the single source of truth to avoid mismatches across routes/nav/buttons.

export const PERMS = {
  crm: {
    customer: {
      view: "crm.view_customer",
      add: "crm.add_customer",
      change: "crm.change_customer",
      delete: "crm.delete_customer",
    },
    site: {
      view: "crm.view_site",
      add: "crm.add_site",
      change: "crm.change_site",
      delete: "crm.delete_site",
    },
    contact: {
      view: "crm.view_contact",
      add: "crm.add_contact",
      change: "crm.change_contact",
      delete: "crm.delete_contact",
    },
  },

  inventory: {
    inventory: {
      view: "inventory.view_inventory",
      view_secrets: "inventory.view_secrets",
      add: "inventory.add_inventory",
      change: "inventory.change_inventory",
      delete: "inventory.delete_inventory",
    },
  },

  audit: {
    view: "audit.view_auditevent",
  },

  maintenance: {
    plan: {
      view:   "maintenance.view_maintenanceplan",
      add:    "maintenance.add_maintenanceplan",
      change: "maintenance.change_maintenanceplan",
      delete: "maintenance.delete_maintenanceplan",
    },
    event: {
      view:   "maintenance.view_maintenanceevent",
      add:    "maintenance.add_maintenanceevent",
      change: "maintenance.change_maintenanceevent",
      delete: "maintenance.delete_maintenanceevent",
    },
    notification: {
      view: "maintenance.view_maintenancenotification",
    },
    tech: {
      view:   "maintenance.view_tech",
      add:    "maintenance.add_tech",
      change: "maintenance.change_tech",
      delete: "maintenance.delete_tech",
    },
  },

  wiki: {
    page: { view: "wiki.view_wikipage" },
  },
} as const;

export const TRASH_VIEW_ANY = [
  PERMS.crm.customer.view,
  PERMS.crm.site.view,
  PERMS.crm.contact.view,
  PERMS.inventory.inventory.view,
] as const;

export const MAINTENANCE_VIEW_ANY = [
  PERMS.maintenance.plan.view,
  PERMS.maintenance.event.view,
  PERMS.maintenance.tech.view,
  PERMS.maintenance.notification.view,
] as const;
