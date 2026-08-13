import { describe, expect, it } from "vitest"
import { isScannedFile, matchingPatterns } from "@/lib/security/secret-patterns"

/**
 * Pruebas de los propios patrones del escáner.
 *
 * Faltaban, y el hueco importaba: hasta la auditoría final el escáner no tenía
 * ningún patrón capaz de detectar una contraseña en claro —el único tipo de fuga
 * que este proyecto ya había sufrido de verdad—, y nadie lo notó porque nada
 * comprobaba lo que el escáner *puede* encontrar, solo que no encontraba nada.
 *
 * Un escáner sin casos positivos no es un escáner: es un test que siempre pasa.
 */

function detects(content: string): boolean {
  return matchingPatterns(content).length > 0
}

describe("contraseñas y secretos en claro", () => {
  it("detecta una contraseña asignada entre comillas", () => {
    expect(detects('const ADMIN_PASSWORD = "Verano2026Segura!"')).toBe(true)
    expect(detects('DEMO_ADMIN_PASSWORD: "Rr8v-Lm2-Qz91"')).toBe(true)
    expect(detects('"apiKey": "kx91MnZpQr72Vd"')).toBe(false) // clave en minúsculas: no es el caso cubierto
  })

  it("detecta la fuga concreta que el proyecto ya tuvo: una contraseña en un documento", () => {
    // Reconstrucción del incidente de la Fase 6: la contraseña de administración
    // pegada en el README dentro de un bloque de comandos.
    const readme = [
      "## Puesta en marcha",
      "",
      "```bash",
      "ADMIN_BOOTSTRAP_EMAIL=admin@portondelacondesa.dev",
      "ADMIN_BOOTSTRAP_PASSWORD=Rr8vLm2Qz91xK",
      "npm run admin:bootstrap",
      "```",
    ].join("\n")

    expect(detects(readme)).toBe(true)
  })

  it("detecta un .env versionado por error con valores reales", () => {
    const env = ["DATABASE_URL=postgresql://u:p@host:5432/db", "BETTER_AUTH_SECRET=9f2a1c7e4b8d3a6f"].join("\n")

    expect(detects(env)).toBe(true)
  })

  it("no marca una plantilla sin valores", () => {
    // Todas las líneas acaban en `=`. Es el estado de .env.example y .env.e2e.example.
    const template = [
      "# Secretos de la aplicación",
      "BETTER_AUTH_SECRET=",
      "BETTER_AUTH_SECRET_PREVIOUS=",
      "RATE_LIMIT_HASH_SECRET=",
      "VIP_TOKEN_HASH_SECRET=",
      "ADMIN_BOOTSTRAP_PASSWORD=",
      "SENDGRID_API_KEY=",
    ].join("\n")

    expect(matchingPatterns(template)).toEqual([])
  })

  it("no marca el nombre de la variable siguiente como si fuera un valor", () => {
    // Regresión de la primera versión del patrón: usaba `\s*` tras el igual, `\s`
    // incluye el salto de línea, y el "valor" que capturaba era el nombre de la
    // variable de la línea de abajo. Diez falsos positivos, incluidas las dos
    // plantillas que el propio escáner certifica vacías.
    expect(matchingPatterns("RATE_LIMIT_HASH_SECRET=\nRATE_LIMIT_HASH_SECRET_PREVIOUS=")).toEqual([])
  })

  it("no marca el código que lee el secreto de otro sitio", () => {
    const code = [
      "BETTER_AUTH_SECRET: process.env.E2E_BETTER_AUTH_SECRET,",
      "process.env.RATE_LIMIT_HASH_SECRET = requireVar(source, 'E2E_RATE_LIMIT_HASH_SECRET')",
      "const secret = readEnv('VIP_TOKEN_HASH_SECRET')",
    ].join("\n")

    expect(matchingPatterns(code)).toEqual([])
  })

  it("no marca las constantes ficticias de los tests", () => {
    // Llevan marca de ficticio en el propio valor. Sin esta exclusión harían falta
    // seis excepciones permanentes en la lista, y una lista de excepciones larga
    // deja de leerse.
    const fixtures = [
      'const API_KEY = "SG.clave-de-prueba-que-no-debe-aparecer"',
      'const TEST_PASSWORD = "un-password-de-prueba-123"',
      'process.env.SENDGRID_API_KEY = "SG.no-debe-aparecer"',
    ].join("\n")

    expect(matchingPatterns(fixtures)).toEqual([])
  })

  it("no marca la prosa que menciona el nombre de una variable", () => {
    const prose =
      "`ADMIN_BOOTSTRAP_PASSWORD` solo se usa una vez y hay que retirarla del entorno. " +
      "El VIP_TOKEN_HASH_SECRET es un HMAC irreversible del token de sesión."

    expect(matchingPatterns(prose)).toEqual([])
  })
})

describe("qué archivos entran en el escaneo", () => {
  it("incluye la familia .env completa, no solo las plantillas", () => {
    // `.env.example` colaba por casualidad, porque acaba en `.example`. `.env`,
    // `.env.local` y `.env.production` no se habrían abierto nunca: se daban por
    // revisados sin mirarlos.
    for (const file of [".env", ".env.local", ".env.production", ".env.e2e", ".env.example"]) {
      expect(isScannedFile(file), file).toBe(true)
    }
  })

  it("incluye los archivos de texto sin extensión", () => {
    expect(isScannedFile("NOTICE")).toBe(true)
    expect(isScannedFile("LICENSE")).toBe(true)
  })

  it("deja fuera los binarios", () => {
    for (const file of ["public/icon.png", "app/fonts/dm-sans-latin-variable.woff2", "docs/contact-sheet.jpg"]) {
      expect(isScannedFile(file), file).toBe(false)
    }
  })
})
