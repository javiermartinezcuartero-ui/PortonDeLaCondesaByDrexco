import { existsSync } from "node:fs"

/**
 * Cuentas y datos del escenario E2E, leídos del entorno.
 *
 * Ninguna contraseña está escrita en el código: viven en `.env.e2e`, que no se
 * versiona. Es la misma regla que rige el resto del proyecto y no hay motivo
 * para que las pruebas sean la excepción (`lib/security/secrets-scan.test.ts`
 * revisaría este archivo igual que cualquier otro).
 */

// Las pruebas también pueden ejecutarse de una en una desde el IDE, sin pasar
// por el `playwright.config.ts`; cargar aquí el entorno hace que eso funcione.
for (const file of [".env", ".env.e2e"]) {
  if (existsSync(file)) process.loadEnvFile(file)
}

function required(name: string): string {
  const value = process.env[name]
  if (!value?.trim()) {
    throw new Error(`Falta ${name} en .env.e2e. Ver docs/pruebas-e2e.md §2.`)
  }
  return value.trim()
}

export type Role = "admin" | "sales" | "content"

export const ACCOUNTS: Record<Role, { email: string; password: string }> = {
  admin: { email: required("E2E_ADMIN_EMAIL"), password: required("E2E_ADMIN_PASSWORD") },
  sales: { email: required("E2E_SALES_EMAIL"), password: required("E2E_SALES_PASSWORD") },
  content: { email: required("E2E_CONTENT_EMAIL"), password: required("E2E_CONTENT_PASSWORD") },
}

/** Estado de sesión guardado por `auth.setup.ts`. */
export const STORAGE_STATE: Record<Role, string> = {
  admin: "e2e/.auth/admin.json",
  sales: "e2e/.auth/sales.json",
  content: "e2e/.auth/content.json",
}

/** Fichas y contacto sembrados por `scripts/e2e-seed.ts`. */
export const FIXTURES = {
  wedding: { slug: "boda-e2e-lavanda", title: "Boda de pruebas E2E — Lavanda" },
  catering: { slug: "catering-e2e-corporativo", title: "Catering de pruebas E2E — Corporativo" },
  existingLead: {
    email: "carmen.solicitud@ejemplo.test",
    firstName: "Carmen",
    subject: "Solicitud sembrada para las pruebas del CRM",
  },
} as const

/** Cadena de conexión de la base de pruebas, para las comprobaciones directas. */
export const E2E_DATABASE_URL = required("E2E_DATABASE_URL")
