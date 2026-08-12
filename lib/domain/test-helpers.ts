import { it } from "vitest"

/**
 * Tests de dominio que hablan con la base de datos real de desarrollo
 * (no hay Postgres local/Docker disponible en este entorno). Se saltan
 * automáticamente si no hay DATABASE_URL configurada (p. ej. en CI, que no
 * recibe secretos — ver .github/workflows/ci.yml).
 */
export const itDb = process.env.DATABASE_URL ? it : it.skip

let counter = 0
export function uniqueTestEmail(prefix: string): string {
  counter += 1
  return `test-${prefix}-${Date.now()}-${counter}@example.test`
}

/**
 * Slug único por ejecución. Los tests corren contra la base de desarrollo
 * compartida (ver docs/arquitectura-backend.md §5), así que un slug fijo
 * chocaría con la restricción `@@unique([type, slug])` entre ejecuciones.
 */
export function uniqueSlug(prefix: string): string {
  counter += 1
  return `test-${prefix}-${Date.now()}-${counter}`
}
