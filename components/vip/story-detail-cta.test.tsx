import { describe, expect, it } from "vitest"
import { contactHrefForStory } from "@/components/vip/story-detail"
import { EVENT_TYPES } from "@/lib/validation/lead-request"

/**
 * El CTA de una ficha ("Quiero una boda así") tiene que llegar al formulario de
 * la home con el tipo de evento y la ficha ya cargados. Si este enlace se rompe,
 * la solicitud se guarda pero pierde la atribución de contenido, que es
 * justamente lo que interesa medir de esta sección.
 */
describe("contactHrefForStory", () => {
  it("lleva al formulario de la home con el tipo y la ficha", () => {
    const href = contactHrefForStory("bodas", "ckz0000000000000000000000")
    const url = new URL(href, "https://elportondelacondesa.com")

    expect(url.pathname).toBe("/")
    expect(url.hash).toBe("#contacto")
    expect(url.searchParams.get("tipo")).toBe("WEDDING")
    expect(url.searchParams.get("ficha")).toBe("ckz0000000000000000000000")
  })

  it("una ficha de catering preselecciona el tipo de catering", () => {
    const url = new URL(contactHrefForStory("catering", "abc123"), "https://elportondelacondesa.com")
    expect(url.searchParams.get("tipo")).toBe("EXTERNAL_CATERING")
  })

  it("el tipo que envía es siempre un código válido del vocabulario compartido", () => {
    for (const kind of ["bodas", "catering"] as const) {
      const tipo = new URL(contactHrefForStory(kind, "x"), "https://example.test").searchParams.get("tipo")
      expect(EVENT_TYPES).toContain(tipo)
    }
  })

  it("sin ficha sigue llevando al formulario, solo sin atribución de contenido", () => {
    const url = new URL(contactHrefForStory("bodas"), "https://elportondelacondesa.com")
    expect(url.pathname).toBe("/")
    expect(url.hash).toBe("#contacto")
    expect(url.searchParams.has("ficha")).toBe(false)
  })
})
