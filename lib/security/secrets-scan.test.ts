import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  ALLOWED_FINDINGS,
  SECRET_PATTERNS,
  isAllowedFinding,
  isScannedFile,
  isSkippedFile,
} from "@/lib/security/secret-patterns"

/**
 * Escáner de secretos sobre los archivos que **git subiría**.
 *
 * No se recorre el disco entero: se pregunta a git qué está versionado o sin
 * ignorar, que es exactamente el conjunto que puede acabar publicado. Un `.env`
 * lleno de claves reales no es un problema mientras esté ignorado; el problema es
 * lo que sale del repositorio.
 *
 * Este test es la red de seguridad de la regla de CLAUDE.md "no incluyas secretos
 * en archivos versionables". Ya evitó una fuga real: en la Fase 6 el README llegó a
 * contener la contraseña de administración en claro.
 *
 * Los patrones y las excepciones viven en `lib/security/secret-patterns.ts`,
 * compartidos con el escáner del historial (`npm run secrets:history`): el árbol
 * limpio y el historial sucio son estados distintos y hacen falta los dos
 * escaneos, pero con una sola lista de qué buscar.
 */

function trackedFiles(): string[] {
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  })
  return output.split("\n").map((line) => line.trim()).filter(Boolean)
}

describe("escáner de secretos", () => {
  const files = trackedFiles().filter((file) => isScannedFile(file) && !isSkippedFile(file))

  it("encuentra archivos que revisar (el escáner no está vacío por error)", () => {
    // Sin esta comprobación, un fallo de `git ls-files` haría pasar el test con 0
    // archivos y daría una falsa tranquilidad.
    expect(files.length).toBeGreaterThan(100)
  })

  it("también revisa los archivos de texto sin extensión", () => {
    // Filtrar solo por extensión dejaba fuera NOTICE, y dejaría fuera LICENSE
    // cuando exista. Son archivos de texto capaces de llevar pegada una cadena
    // de conexión, y el escáner los daba por revisados sin abrirlos.
    expect(files).toContain("NOTICE")
  })

  it("ningún archivo versionable contiene un secreto", () => {
    const findings: string[] = []

    for (const file of files) {
      let content: string
      try {
        content = readFileSync(file, "utf8")
      } catch {
        continue
      }

      for (const { name, regex } of SECRET_PATTERNS) {
        if (regex.test(content) && !isAllowedFinding(file, name)) {
          findings.push(`${file}: ${name}`)
        }
      }
    }

    expect(findings).toEqual([])
  })

  it("cada excepción de la lista lleva su motivo escrito", () => {
    // Una excepción sin explicación es un agujero con permiso: al cabo de dos
    // fases nadie recuerda si era un falso positivo o una fuga que se toleró.
    for (const entry of ALLOWED_FINDINGS) {
      expect(entry.reason.length, `la excepción de ${entry.file} no explica por qué`).toBeGreaterThan(40)
      expect(SECRET_PATTERNS.map(({ name }) => name)).toContain(entry.pattern)
    }
  })

  it("el módulo de patrones no dispara sus propios patrones", () => {
    // `secret-patterns.ts` está en la lista de omitidos por prudencia, pero si
    // además no se autodetecta, la omisión no puede esconder nada.
    const source = readFileSync("lib/security/secret-patterns.ts", "utf8")
    const selfMatches = SECRET_PATTERNS.filter(({ regex }) => regex.test(source)).map(({ name }) => name)

    expect(selfMatches).toEqual([])
  })

  it("los únicos archivos de la familia .env versionables son las dos plantillas", () => {
    // La versión anterior de esta prueba era una tautología:
    //
    //   expect(files.some((f) => f === ".env" || f.startsWith(".env."))).toBe(
    //     files.includes(".env.example")
    //   )
    //
    // `.env.example` está versionado, así que el lado izquierdo era true por su
    // culpa y el derecho también: `true === true` pasaba siempre. Añadir un
    // `.env.production` con credenciales reales —o un `git add -f .env.local`— no
    // la rompía. Era el único guardián automático de la promesa central del
    // proyecto y no guardaba nada.
    //
    // Con la lista exacta, cualquier variante nueva rompe la prueba y obliga a
    // decidir a conciencia si de verdad debe publicarse.
    const envFamily = files.filter((file) => file === ".env" || file.startsWith(".env.")).sort()

    expect(envFamily).toEqual([".env.e2e.example", ".env.example"])
  })

  it("las plantillas .env no llevan ningún valor", () => {
    // Se recorren TODAS las plantillas en lugar de nombrar una: la comprobación
    // solo cubría `.env.example` y dejaba fuera `.env.e2e.example`, que es la que
    // documenta el flujo "copia este archivo y rellénalo" y por tanto la que más
    // fácil se guarda rellena por encima de la plantilla.
    const templates = files.filter((file) => file.startsWith(".env.") && file.endsWith(".example"))
    expect(templates.length).toBeGreaterThanOrEqual(2)

    for (const template of templates) {
      const assignments = readFileSync(template, "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => /^[A-Z0-9_]+=/.test(line))

      expect(assignments.length, `${template} no declara variables`).toBeGreaterThan(0)
      for (const assignment of assignments) {
        expect(assignment, `${template} lleva un valor: ${assignment.split("=")[0]}=…`).toMatch(/=$/)
      }
    }
  })

  it("ninguna variable NEXT_PUBLIC_ transporta un secreto", () => {
    const publicVars = new Set<string>()

    for (const file of files) {
      let content: string
      try {
        content = readFileSync(file, "utf8")
      } catch {
        continue
      }
      for (const match of content.matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)) {
        publicVars.add(match[1])
      }
    }

    // Lo que se expone al navegador tiene que ser justificable una por una.
    expect([...publicVars].sort()).toEqual(["NEXT_PUBLIC_SITE_URL"])
    for (const name of publicVars) {
      expect(name).not.toMatch(/KEY|SECRET|TOKEN|PASSWORD|SERVICE_ROLE/i)
    }
  })
})
