import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { TEST_DATA_EMAIL_SUFFIXES } from "@/lib/testing/test-data-domains"

/**
 * `npm run test:clean` borra contactos con su historial completo por cascada, y la
 * única cosa que separa esa operación de un borrado de datos reales es la lista de
 * sufijos que decide a quién alcanza.
 *
 * Estas pruebas la vigilan. No comprueban el borrado —eso exigiría crear y destruir
 * datos en la base compartida, que es justo el problema que el script resuelve—,
 * sino la propiedad que lo hace seguro: **cada sufijo pertenece a un dominio que no
 * puede existir en Internet**. Si alguien añadiera `@gmail.com` a la lista, aquí
 * saltaría antes de que el script se ejecutara contra producción.
 *
 * La lista se importa de `lib/testing/test-data-domains.ts` y no del script, y eso
 * lo enseñó este mismo archivo: la primera versión importaba la constante del script,
 * que llama a `main()` en su nivel superior, así que **cada `npm test` habría
 * ejecutado el borrado**.
 */

/** TLD que el IETF reserva y que nadie puede registrar (RFC 2606 §2, RFC 6761 §6). */
const TLD_RESERVADOS = [".test", ".invalid", ".example", ".localhost"]

/** Dominios de segundo nivel reservados para documentación (RFC 2606 §3). */
const DOMINIOS_DOCUMENTACION = ["example.com", "example.net", "example.org"]

describe("dominios que test:clean puede borrar", () => {
  it("todos son dominios que no pueden existir en Internet", () => {
    for (const sufijo of TEST_DATA_EMAIL_SUFFIXES) {
      const esTldReservado = TLD_RESERVADOS.some((tld) => sufijo.endsWith(tld))
      const esDominioDocumentacion = DOMINIOS_DOCUMENTACION.some((dominio) => sufijo.endsWith(dominio))

      expect(
        esTldReservado || esDominioDocumentacion,
        `"${sufijo}" no es un dominio reservado: un contacto real podría tener ahí su correo`
      ).toBe(true)
    }
  })

  it("ninguno es un proveedor de correo real", () => {
    // La comprobación de arriba ya lo cubre, pero esta nombra el error concreto que
    // se quiere impedir, y es la que se leerá primero si alguien la rompe.
    const prohibidos = ["gmail", "hotmail", "outlook", "yahoo", "icloud", "protonmail", "portondelacondesa.com"]

    for (const sufijo of TEST_DATA_EMAIL_SUFFIXES) {
      for (const prohibido of prohibidos) {
        expect(sufijo, `"${sufijo}" alcanzaría correos reales de ${prohibido}`).not.toContain(prohibido)
      }
    }
  })

  it("incluye el dominio de la demostración y los de las pruebas", () => {
    // Cobertura mínima: si alguien quita uno de estos, `npm run test:clean` deja de
    // limpiar lo que existe para limpiar.
    expect(TEST_DATA_EMAIL_SUFFIXES).toContain(".invalid")
    expect(TEST_DATA_EMAIL_SUFFIXES).toContain(".test")
    expect(TEST_DATA_EMAIL_SUFFIXES.some((s) => s.includes("demo.portondelacondesa"))).toBe(true)
  })

  it("el script está declarado en package.json y no borra sin más", () => {
    const { scripts } = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> }
    expect(scripts["test:clean"]).toContain("scripts/test-data-clean.ts")

    // El modo seco es lo que permite ver el alcance antes de borrar. Si se pierde,
    // la operación pasa a ser a ciegas.
    const fuente = readFileSync("scripts/test-data-clean.ts", "utf8")
    expect(fuente).toContain("--seco")
    // Y la auditoría no se toca: es una decisión, no un olvido.
    expect(fuente).not.toMatch(/auditEvent\.delete/)
  })
})
