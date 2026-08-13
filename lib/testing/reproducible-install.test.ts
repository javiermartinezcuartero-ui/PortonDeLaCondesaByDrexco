import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * Reproducibilidad de la instalación.
 *
 * La auditoría final encontró que `npm ci` no dejaba un cliente de Prisma usable:
 * `npm run typecheck` fallaba justo después de una instalación limpia con
 * "Module '@prisma/client' has no exported member 'ContentType'". Y la secuencia
 * exacta que fallaba es la de CI —`npm ci` → lint → typecheck → test → build—, así
 * que el flujo de trabajo habría estado rojo en el primer runner limpio. También
 * habría fallado a cualquiera que clonase el repositorio y siguiera el README.
 *
 * No se detectó antes porque en el equipo de desarrollo el cliente ya estaba
 * generado de una ejecución anterior: el fallo solo aparece cuando `node_modules`
 * se crea de cero, que es precisamente lo que nadie hace en local y CI hace
 * siempre.
 *
 * Estas pruebas fijan las dos piezas que lo garantizan. Son de configuración, no de
 * comportamiento, y por eso no necesitan base de datos ni red.
 */

function packageJson(): { scripts?: Record<string, string> } {
  return JSON.parse(readFileSync("package.json", "utf8"))
}

describe("instalación limpia", () => {
  it("package.json genera el cliente de Prisma en postinstall", () => {
    // Es lo que hace que `npm ci` sea autosuficiente: en CI, en Vercel y en un
    // clon nuevo. La alternativa —un paso explícito en cada sitio— se olvida en
    // alguno de los tres.
    const { scripts } = packageJson()

    expect(scripts?.postinstall, "falta el postinstall que genera el cliente").toBeDefined()
    expect(scripts?.postinstall).toContain("prisma generate")
  })

  it("el cliente generado exporta los enums del esquema", () => {
    // La comprobación de fondo: que lo que hay instalado AHORA sirve. Si el cliente
    // fuera el stub que instala el paquete sin generar, estos tipos no existirían y
    // el typecheck del proyecto fallaría — que es exactamente el síntoma original.
    const enums = readFileSync("prisma/schema.prisma", "utf8")
      .split("\n")
      .filter((line) => line.startsWith("enum "))
      .map((line) => line.replace(/^enum\s+(\w+).*$/, "$1"))

    expect(enums.length).toBeGreaterThan(5)

    const generated = readFileSync("node_modules/.prisma/client/index.d.ts", "utf8")
    for (const name of enums) {
      expect(generated, `el cliente generado no declara el enum ${name}`).toContain(name)
    }
  })

  it("hay un único lockfile", () => {
    // Dos lockfiles son una instalación no reproducible esperando a ocurrir: `npm
    // ci` y el otro gestor resolverían árboles distintos.
    const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    })
      .split("\n")
      .map((line) => line.trim())

    const lockfiles = tracked.filter((file) =>
      ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb"].includes(file)
    )

    expect(lockfiles).toEqual(["package-lock.json"])
  })

  it("el flujo de trabajo de CI ejecuta la secuencia completa", () => {
    // Si alguien quita un paso, esta prueba lo dice. El orden importa: el typecheck
    // tiene que ir después de la instalación (que ahora genera el cliente) y el
    // build al final.
    const ci = readFileSync(".github/workflows/ci.yml", "utf8")

    for (const step of ["npm ci", "npm run lint", "npm run typecheck", "npm run test", "npm run build"]) {
      expect(ci, `CI no ejecuta ${step}`).toContain(step)
    }
    // Y el escaneo del historial, que necesita el historial completo para servir.
    expect(ci).toContain("npm run secrets:history")
    expect(ci).toContain("fetch-depth: 0")
  })
})
