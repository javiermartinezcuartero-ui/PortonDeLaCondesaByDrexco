import { describe, expect, it } from "vitest"
import {
  createContentEntrySchema,
  externalMediaSchema,
  saveContentEntrySchema,
  slugSchema,
  validateSaveConsistency,
} from "@/lib/validation/content"

describe("slugSchema", () => {
  it.each(["laura-y-marcos", "gala-empresa-2026", "abc"])("acepta %s", (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(true)
  })

  it.each([
    ["mayúsculas", "Laura-Y-Marcos"],
    ["espacios", "laura y marcos"],
    ["acentos", "comunión"],
    ["guion al inicio", "-laura"],
    ["guion al final", "laura-"],
    ["guiones dobles", "laura--marcos"],
    ["barra (intento de ruta)", "laura/marcos"],
    ["demasiado corto", "ab"],
  ])("rechaza %s", (_descripcion, slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(false)
  })
})

describe("createContentEntrySchema", () => {
  it("acepta el mínimo necesario para crear un borrador", () => {
    const result = createContentEntrySchema.safeParse({
      type: "REAL_WEDDING",
      slug: "boda-de-prueba",
      title: "Boda de prueba",
    })
    expect(result.success).toBe(true)
  })

  it("rechaza un tipo de contenido inexistente", () => {
    const result = createContentEntrySchema.safeParse({ type: "CUMPLEANOS", slug: "x-y-z", title: "T" })
    expect(result.success).toBe(false)
  })

  it("rechaza un título vacío", () => {
    const result = createContentEntrySchema.safeParse({ type: "REAL_WEDDING", slug: "x-y-z", title: "   " })
    expect(result.success).toBe(false)
  })
})

function baseSaveValues(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    expectedUpdatedAt: "2026-08-11T10:00:00.000Z",
    type: "REAL_WEDDING",
    slug: "boda-de-prueba",
    isDemo: false,
    featured: false,
    sortOrder: 0,
    seoNoindex: true,
    translations: { es: { title: "Boda de prueba" } },
    media: [],
    providers: [],
    menuSections: [],
    timeline: [],
    highlights: [],
    ...overrides,
  }
}

describe("saveContentEntrySchema", () => {
  it("acepta una ficha mínima con solo la traducción española", () => {
    const result = saveContentEntrySchema.safeParse(baseSaveValues())
    expect(result.success).toBe(true)
  })

  it("convierte los textos opcionales vacíos en undefined, no en cadena vacía", () => {
    const result = saveContentEntrySchema.parse(baseSaveValues({ season: "  ", space: "" }))
    expect(result.season).toBeUndefined()
    expect(result.space).toBeUndefined()
  })

  it("exige el título español", () => {
    const result = saveContentEntrySchema.safeParse(baseSaveValues({ translations: { es: { title: "" } } }))
    expect(result.success).toBe(false)
  })

  it("acepta que la traducción inglesa esté completamente vacía", () => {
    const result = saveContentEntrySchema.safeParse(
      baseSaveValues({ translations: { es: { title: "T" }, en: { title: "", subtitle: "", intro: "" } } })
    )
    expect(result.success).toBe(true)
  })

  it("rechaza una traducción inglesa con contenido pero sin título", () => {
    const result = saveContentEntrySchema.safeParse(
      baseSaveValues({ translations: { es: { title: "T" }, en: { title: "", subtitle: "Only a subtitle" } } })
    )
    expect(result.success).toBe(false)
    expect(JSON.stringify(result)).toMatch(/título en inglés/i)
  })

  it("convierte la fecha del evento a Date", () => {
    const result = saveContentEntrySchema.parse(baseSaveValues({ eventDate: "2025-10-18" }))
    expect(result.eventDate?.toISOString()).toBe("2025-10-18T00:00:00.000Z")
  })

  it("rechaza una fecha con formato inválido", () => {
    expect(saveContentEntrySchema.safeParse(baseSaveValues({ eventDate: "18/10/2025" })).success).toBe(false)
  })

  it("acepta el presupuesto como texto del formulario y lo convierte a entero", () => {
    const result = saveContentEntrySchema.parse(baseSaveValues({ priceFrom: "8500", priceTo: "13500" }))
    expect(result.priceFrom).toBe(8500)
    expect(result.priceTo).toBe(13500)
  })

  it("acepta un CTA con ruta interna", () => {
    expect(saveContentEntrySchema.safeParse(baseSaveValues({ ctaHref: "/#contacto" })).success).toBe(true)
  })

  it.each(["https://otro-sitio.example.com", "//evil.example.com", "javascript:alert(1)"])(
    "rechaza el CTA externo %s",
    (ctaHref) => {
      expect(saveContentEntrySchema.safeParse(baseSaveValues({ ctaHref })).success).toBe(false)
    }
  )

  it("rechaza un expectedUpdatedAt que no sea una fecha ISO", () => {
    expect(saveContentEntrySchema.safeParse(baseSaveValues({ expectedUpdatedAt: "ayer" })).success).toBe(false)
  })
})

describe("validateSaveConsistency", () => {
  it("no devuelve errores en una ficha coherente", () => {
    const values = saveContentEntrySchema.parse(baseSaveValues())
    expect(validateSaveConsistency(values)).toEqual([])
  })

  it("detecta un presupuesto invertido", () => {
    const values = saveContentEntrySchema.parse(baseSaveValues({ priceFrom: "13500", priceTo: "8500" }))
    expect(validateSaveConsistency(values)).toContainEqual(expect.stringMatching(/mínimo no puede ser mayor/i))
  })

  it("detecta más de una imagen principal", () => {
    const values = saveContentEntrySchema.parse(
      baseSaveValues({
        media: [
          { id: "m1", sortOrder: 0, isHero: true, inGallery: true },
          { id: "m2", sortOrder: 1, isHero: true, inGallery: true },
        ],
      })
    )
    expect(validateSaveConsistency(values)).toContainEqual(expect.stringMatching(/una imagen principal/i))
  })

  it("detecta un pase de minuta sin platos", () => {
    const values = saveContentEntrySchema.parse(
      baseSaveValues({ menuSections: [{ course: "Entrantes", items: [] }] })
    )
    expect(validateSaveConsistency(values)).toContainEqual(expect.stringMatching(/sin ningún plato/i))
  })
})

describe("externalMediaSchema", () => {
  it("acepta un vídeo con miniatura", () => {
    const result = externalMediaSchema.safeParse({
      contentEntryId: "entry-1",
      type: "EXTERNAL_VIDEO",
      url: "https://youtu.be/abc123",
      thumbnailUrl: "https://cdn.example.com/thumb.jpg",
    })
    expect(result.success).toBe(true)
  })

  it("exige la miniatura", () => {
    const result = externalMediaSchema.safeParse({
      contentEntryId: "entry-1",
      type: "REEL",
      url: "https://www.instagram.com/reel/abc/",
      thumbnailUrl: "",
    })
    expect(result.success).toBe(false)
  })
})
