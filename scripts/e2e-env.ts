/**
 * Preparación del entorno de las pruebas E2E.
 *
 * Los scripts de E2E hablan con la base **de pruebas**, no con la de la
 * aplicación. Como `lib/db.ts` y `lib/auth.ts` leen sus variables en el momento
 * de importarse, la sustitución tiene que ocurrir *antes* de esas importaciones:
 * de ahí que este módulo se importe primero y los demás con `await import()`.
 *
 * También es el único punto donde se llama a la guardia: así ningún script de
 * E2E puede saltársela por olvido.
 */
import { assertIsolatedTestDatabase } from "@/lib/testing/e2e-database-guard"

export type E2eEnvironment = {
  /** Descripción de la base aceptada, sin credenciales. Apta para imprimir. */
  database: string
  baseUrl: string
  accounts: {
    admin: E2eAccount
    sales: E2eAccount
    content: E2eAccount
  }
}

export type E2eAccount = {
  email: string
  password: string
  name: string
  role: "ADMIN" | "SALES" | "CONTENT"
}

function requireVar(name: string): string {
  const value = process.env[name]
  if (!value || !value.trim()) {
    throw new Error(`Falta ${name}. Copia .env.e2e.example a .env.e2e y ejecuta \`npm run e2e:env\`.`)
  }
  return value.trim()
}

/**
 * Valida la base de pruebas, reescribe las variables que leerán `lib/db.ts` y
 * `lib/auth.ts`, y devuelve la configuración del escenario.
 *
 * Debe llamarse **antes** de importar cualquier módulo que lea el entorno.
 */
export function prepareE2eEnvironment(): E2eEnvironment {
  const candidateUrl = process.env.E2E_DATABASE_URL
  const applicationUrl = process.env.DATABASE_URL

  if (!applicationUrl?.trim()) {
    // No es un error: en CI puede que solo existan las variables de E2E. Pero sí
    // significa que la comprobación más útil de la guardia —"no es la base de la
    // aplicación"— no se ha podido hacer, y eso hay que decirlo en voz alta en vez
    // de dejar creer que se ha verificado algo que no se ha verificado.
    console.warn(
      "Aviso: DATABASE_URL no está definida, así que no se ha podido comprobar que " +
        "la base de pruebas sea distinta de la de la aplicación."
    )
  }

  const database = assertIsolatedTestDatabase({
    candidateUrl,
    // La cadena de la aplicación se lee tal cual está en el entorno: si
    // coinciden, la guardia aborta. Esta comparación es el motivo de que este
    // módulo se ejecute antes de sobrescribir DATABASE_URL.
    applicationUrl,
    allowNonLocal: process.env.E2E_ALLOW_NONLOCAL === "true",
  })

  const url = candidateUrl as string
  process.env.DATABASE_URL = url
  // Sin pooler: la base de pruebas es PostgreSQL directo, así que la conexión
  // de migraciones y la de runtime son la misma.
  process.env.DIRECT_URL = url

  process.env.BETTER_AUTH_SECRET = requireVar("E2E_BETTER_AUTH_SECRET")
  process.env.RATE_LIMIT_HASH_SECRET = requireVar("E2E_RATE_LIMIT_HASH_SECRET")
  process.env.VIP_TOKEN_HASH_SECRET = requireVar("E2E_VIP_TOKEN_HASH_SECRET")

  const baseUrl = process.env.E2E_BASE_URL?.trim() || "http://localhost:3100"
  process.env.BETTER_AUTH_URL = baseUrl
  process.env.NEXT_PUBLIC_SITE_URL = baseUrl

  // El contenido de ejemplo debe listarse en las pruebas: todas las fichas del
  // escenario llevan isDemo=true (ver lib/domain/content.ts).
  process.env.ENABLE_DEMO_CONTENT = "true"

  // Ninguna prueba debe intentar enviar correo. Sin transporte, cada intento
  // queda como SKIPPED_CONFIG en NotificationLog, que es justo lo que se quiere
  // comprobar: que guardar un lead no depende del proveedor de email.
  delete process.env.RESEND_API_KEY
  delete process.env.LEADS_FROM_EMAIL
  delete process.env.SEND_LEAD_ACKNOWLEDGEMENT

  return {
    database,
    baseUrl,
    accounts: {
      admin: {
        email: requireVar("E2E_ADMIN_EMAIL"),
        password: requireVar("E2E_ADMIN_PASSWORD"),
        name: "Admin de pruebas E2E",
        role: "ADMIN",
      },
      sales: {
        email: requireVar("E2E_SALES_EMAIL"),
        password: requireVar("E2E_SALES_PASSWORD"),
        name: "Comercial de pruebas E2E",
        role: "SALES",
      },
      content: {
        email: requireVar("E2E_CONTENT_EMAIL"),
        password: requireVar("E2E_CONTENT_PASSWORD"),
        name: "Editor de pruebas E2E",
        role: "CONTENT",
      },
    },
  }
}
