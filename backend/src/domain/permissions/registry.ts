import type { AppModule } from "@prisma/client";

/**
 * مفاتيح موحّدة: resource:action → (module, action في RolePermission)
 */
export const PERMISSION_KEYS = {
  "invoice:create": { module: "SALES" as AppModule, action: "CREATE" },
  "invoice:edit": { module: "SALES" as AppModule, action: "EDIT" },
  "invoice:submit": { module: "SALES" as AppModule, action: "SUBMIT" },
  "invoice:approve": { module: "SALES" as AppModule, action: "APPROVE" },
  "invoice:reject": { module: "SALES" as AppModule, action: "APPROVE" },
  "invoice:post": { module: "SALES" as AppModule, action: "POST" },
  "invoice:delete": { module: "SALES" as AppModule, action: "DELETE" },

  "purchase_invoice:create": { module: "PURCHASES" as AppModule, action: "CREATE" },
  "purchase_invoice:edit": { module: "PURCHASES" as AppModule, action: "EDIT" },
  "purchase_invoice:submit": { module: "PURCHASES" as AppModule, action: "SUBMIT" },
  "purchase_invoice:approve": { module: "PURCHASES" as AppModule, action: "APPROVE" },
  "purchase_invoice:reject": { module: "PURCHASES" as AppModule, action: "APPROVE" },
  "purchase_invoice:post": { module: "PURCHASES" as AppModule, action: "POST" },
  "purchase_invoice:delete": { module: "PURCHASES" as AppModule, action: "DELETE" },

  "finance:vat_report": { module: "FINANCE" as AppModule, action: "VAT_REPORT" },
  "notifications:read": { module: "SETTINGS" as AppModule, action: "NOTIFICATIONS_READ" },
} as const;

export type PermissionKey = keyof typeof PERMISSION_KEYS;

export function resolvePermission(key: string): { module: AppModule; action: string } {
  const k = key as PermissionKey;
  const row = PERMISSION_KEYS[k];
  if (!row) {
    throw new Error(`Unknown permission key: ${key}`);
  }
  return row;
}
