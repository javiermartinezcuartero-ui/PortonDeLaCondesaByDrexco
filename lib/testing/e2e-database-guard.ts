/**
 * Guardia de la base de datos de pruebas E2E.
 *
 * Las E2E son **destructivas**: `scripts/e2e-seed.ts` vacía todas las tablas
 * antes de sembrar el escenario. Un error de una sola variable de entorno
 * bastaría para vaciar la base de desarrollo o la de producción, así que la
 * comprobación no es un comentario en el runbook: es código con pruebas que
 * aborta antes de abrir la primera conexión.
 *
 * Vive en `lib/` y no en `scripts/` precisamente para poder probarla con la
 * suite normal (`lib/testing/e2e-database-guard.test.ts`). Una salvaguarda sin
 * pruebas no es una salvaguarda: es una intención.
 */

/** Hosts en los que se considera aceptable destruir datos sin más preguntas. */
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"])

/**
 * Fragmentos de host que delatan una base gestionada (candidata a ser la real).
 * La lista no pretende ser exhaustiva —no puede serlo—: es la última red antes
 * del `TRUNCATE`, no la única.
 */
const MANAGED_HOST_FRAGMENTS = [
  "supabase.co",
  "supabase.com",
  "supabase.in",
  "rds.amazonaws.com",
  "neon.tech",
  "render.com",
  "railway.app",
  "azure.com",
  "googleapis.com",
  "digitalocean.com",
  "planetscale",
  "timescale",
]

/** Una base no local debe llamarse como lo que es. */
const TEST_DATABASE_NAME_FRAGMENTS = ["e2e", "test", "prueba"]

export class UnsafeTestDatabaseError extends Error {
  constructor(message: string) {
    super(
      `${message}\n\n` +
        "Las pruebas E2E vacían la base de datos entera. Apúntalas a una base " +
        "desechable (docker-compose.e2e.yml) y vuelve a intentarlo. " +
        "Ver docs/pruebas-e2e.md §2."
    )
    this.name = "UnsafeTestDatabaseError"
  }
}

export type TestDatabaseGuardOptions = {
  /** Cadena de conexión que van a usar las pruebas. */
  candidateUrl: string | undefined
  /**
   * Cadena que usa la aplicación en este entorno (`DATABASE_URL` de `.env`).
   * Si coincide con la candidata, se aborta siempre: da igual dónde apunte.
   */
  applicationUrl?: string | undefined
  /**
   * Permite hosts no locales. Existe para CI, donde la base de pruebas puede
   * ser un contenedor de servicio con nombre de red propio. No basta por sí
   * sola: el nombre de la base debe seguir delatando que es de pruebas.
   */
  allowNonLocal?: boolean
}

/** Describe una conexión sin exponer usuario ni contraseña. */
function describe(url: URL): string {
  return `${url.hostname}:${url.port || "5432"}${url.pathname}`
}

function parse(raw: string): URL {
  try {
    return new URL(raw)
  } catch {
    throw new UnsafeTestDatabaseError("La cadena de conexión de pruebas no es una URL válida.")
  }
}

/**
 * Compara dos conexiones por host, puerto y nombre de base. Se ignoran usuario,
 * contraseña y parámetros: `...:6543/postgres?pgbouncer=true` y
 * `...:6543/postgres` son la misma base, y tratarlas como distintas sería
 * justamente el agujero que esta función existe para tapar.
 */
function sameDatabase(a: URL, b: URL): boolean {
  return a.hostname === b.hostname && (a.port || "5432") === (b.port || "5432") && a.pathname === b.pathname
}

/**
 * Aborta si la base indicada no es claramente desechable.
 *
 * @returns una descripción sin credenciales de la base aceptada, para poder
 * registrarla en la salida del script sin filtrar la contraseña.
 */
export function assertIsolatedTestDatabase(options: TestDatabaseGuardOptions): string {
  const { candidateUrl, applicationUrl, allowNonLocal = false } = options

  if (!candidateUrl || !candidateUrl.trim()) {
    throw new UnsafeTestDatabaseError("Falta E2E_DATABASE_URL: no hay ninguna base de pruebas configurada.")
  }

  const candidate = parse(candidateUrl.trim())

  if (!candidate.protocol.startsWith("postgres")) {
    throw new UnsafeTestDatabaseError(`Protocolo inesperado "${candidate.protocol}": se esperaba postgresql://.`)
  }

  const databaseName = candidate.pathname.replace(/^\//, "")
  if (!databaseName) {
    throw new UnsafeTestDatabaseError("La cadena de conexión de pruebas no indica ninguna base de datos.")
  }

  if (applicationUrl?.trim()) {
    const application = parse(applicationUrl.trim())
    if (sameDatabase(candidate, application)) {
      throw new UnsafeTestDatabaseError(
        `E2E_DATABASE_URL apunta a la misma base que usa la aplicación (${describe(candidate)}).`
      )
    }
  }

  const hostname = candidate.hostname.toLowerCase()
  const managed = MANAGED_HOST_FRAGMENTS.find((fragment) => hostname.includes(fragment))
  const isLocal = LOCAL_HOSTNAMES.has(hostname)

  // Un host gestionado nunca cuenta como local, incluso si algún día se colara
  // en la lista de hosts locales por error.
  if (managed && !allowNonLocal) {
    throw new UnsafeTestDatabaseError(
      `El host de pruebas parece una base gestionada ("${managed}"). Si de verdad es desechable, ` +
        "declara E2E_ALLOW_NONLOCAL=true y usa un nombre de base que lo diga."
    )
  }

  if (!isLocal && !allowNonLocal) {
    throw new UnsafeTestDatabaseError(
      `El host de pruebas (${hostname}) no es local. Declara E2E_ALLOW_NONLOCAL=true si es intencionado.`
    )
  }

  // Con el permiso explícito seguimos exigiendo que el nombre delate la
  // finalidad: la base por defecto de Supabase se llama "postgres", así que un
  // despiste de copiar y pegar seguiría abortando aquí.
  if (!isLocal) {
    const named = TEST_DATABASE_NAME_FRAGMENTS.some((fragment) => databaseName.toLowerCase().includes(fragment))
    if (!named) {
      throw new UnsafeTestDatabaseError(
        `La base "${databaseName}" está en un host remoto y su nombre no contiene ` +
          `${TEST_DATABASE_NAME_FRAGMENTS.join(", ")}. No se asume que sea de pruebas.`
      )
    }
  }

  return describe(candidate)
}
