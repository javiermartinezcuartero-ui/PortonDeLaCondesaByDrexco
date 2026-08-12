import { describe, expect, it } from "vitest"
import { slugify } from "@/lib/slug"
import { SLUG_PATTERN } from "@/lib/validation/content"

describe("slugify", () => {
  it("pasa a minúsculas y une con guiones", () => {
    expect(slugify("Laura & Marcos")).toBe("laura-marcos")
  })

  it("quita los acentos y la eñe sin dejar caracteres no ASCII", () => {
    expect(slugify("Comunión de Begoña en Añora")).toBe("comunion-de-begona-en-anora")
  })

  it("no deja guiones al inicio ni al final", () => {
    expect(slugify("  ¡Boda de otoño!  ")).toBe("boda-de-otono")
  })

  it("colapsa separadores consecutivos en un solo guion", () => {
    expect(slugify("Gala   empresa --- 2026")).toBe("gala-empresa-2026")
  })

  it("produce siempre un slug que el validador de servidor acepta", () => {
    const entradas = ["Elena & David", "Inauguración showroom", "Menú degustación (edición nº 3)", "ÁÉÍÓÚ"]
    for (const entrada of entradas) {
      expect(slugify(entrada)).toMatch(SLUG_PATTERN)
    }
  })

  it("devuelve cadena vacía si no queda nada utilizable", () => {
    // El editor mostrará el campo vacío y el validador de servidor lo rechazará
    // por longitud mínima: no se inventa un slug.
    expect(slugify("¡¿!?")).toBe("")
  })
})
