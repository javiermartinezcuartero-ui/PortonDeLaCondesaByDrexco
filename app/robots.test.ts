import { describe, expect, it } from "vitest"
import robots from "@/app/robots"

/**
 * `robots.txt` es una de las pocas afirmaciones del proyecto que un evaluador
 * puede comprobar con un solo `curl`, y estaba mal: tres documentos
 * (`docs/checklist-aceptacion.md` 1.7, `docs/despliegue-vercel.md` smoke test 9
 * y `docs/evidencias-tfm.md` §3) daban por hecho un `Disallow: /admin` que el
 * código no emitía. Estas pruebas fijan las dos decisiones para que no vuelvan a
 * separarse del texto.
 */

function rules() {
  const value = robots().rules
  // El tipo de Next admite una regla o un array; aquí siempre es una.
  if (Array.isArray(value)) throw new Error("se esperaba una única regla")
  return value
}

function disallowList(): string[] {
  const { disallow } = rules()
  if (!disallow) return []
  return Array.isArray(disallow) ? disallow : [disallow]
}

describe("robots.txt", () => {
  it("impide el rastreo del panel", () => {
    expect(disallowList()).toContain("/admin")
  })

  it("impide el rastreo de la API", () => {
    // Ningún endpoint devuelve contenido indexable y varios exigen sesión.
    expect(disallowList()).toContain("/api")
  })

  it("no bloquea las bibliotecas VIP: ahí la exclusión es por noindex", () => {
    // Bloquearlas aquí impediría al buscador leer el `noindex` de cada página,
    // que es justo el mecanismo con el que se excluyen (lib/vip/metadata.ts).
    const disallow = disallowList().join(" ")
    expect(disallow).not.toMatch(/bodas-reales|catering/)
  })

  it("el resto del sitio sí se rastrea", () => {
    expect(rules().allow).toBe("/")
  })

  it("declara el sitemap con URL absoluta", () => {
    const { sitemap } = robots()
    expect(typeof sitemap).toBe("string")
    expect(sitemap).toMatch(/^https?:\/\/.+\/sitemap\.xml$/)
  })
})
