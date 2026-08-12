import { afterEach, describe, expect } from "vitest"
import { prisma } from "@/lib/db"
import {
  archiveContentEntry,
  countContentEntriesByStatus,
  createContentEntry,
  duplicateContentEntryAsDraft,
  getContentEntryForAdmin,
  getMissingPublicationRequirements,
  isSlugAvailable,
  listContentEntriesForAdmin,
  publishContentEntry,
  saveContentEntry,
  unpublishContentEntry,
  type SaveContentEntryInput,
} from "@/lib/domain/content"
import { ConcurrentUpdateError, DuplicateSlugError, IncompletePublicationError } from "@/lib/domain/errors"
import { itDb, uniqueSlug } from "@/lib/domain/test-helpers"

const createdIds: string[] = []
afterEach(async () => {
  if (createdIds.length) {
    await prisma.contentEntry.deleteMany({ where: { id: { in: createdIds } } })
    createdIds.length = 0
  }
})

/** Ficha lista para publicar: título ES, slug, hero con alt. */
async function createPublishableEntry(overrides: Partial<Parameters<typeof createContentEntry>[0]> = {}) {
  const entry = await createContentEntry({
    type: "REAL_WEDDING",
    slug: uniqueSlug("cms"),
    translations: { es: { title: "Ficha de prueba" } },
    media: [{ type: "IMAGE", url: "/images/porton/01-boda-civil-jardin.jpg", alt: "Hero de prueba", isHero: true }],
    ...overrides,
  })
  createdIds.push(entry.id)
  return entry
}

async function buildSaveInput(entryId: string, overrides: Partial<SaveContentEntryInput> = {}): Promise<SaveContentEntryInput> {
  const current = await prisma.contentEntry.findUniqueOrThrow({ where: { id: entryId } })
  return {
    id: entryId,
    expectedUpdatedAt: current.updatedAt,
    type: current.type,
    slug: current.slug,
    isDemo: current.isDemo,
    featured: current.featured,
    sortOrder: current.sortOrder,
    seoNoindex: current.seoNoindex,
    translations: { es: { title: "Ficha de prueba" } },
    media: [],
    providers: [],
    menuSections: [],
    timeline: [],
    highlights: [],
    ...overrides,
  }
}

describe("getMissingPublicationRequirements", () => {
  itDb("no exige nada a una ficha completa", async () => {
    const entry = await createPublishableEntry()
    const loaded = await getContentEntryForAdmin(entry.id)
    expect(getMissingPublicationRequirements(loaded!)).toEqual([])
  })

  itDb("detecta la falta de hero", async () => {
    const entry = await createContentEntry({
      type: "REAL_WEDDING",
      slug: uniqueSlug("sin-hero"),
      translations: { es: { title: "Sin hero" } },
    })
    createdIds.push(entry.id)

    const loaded = await getContentEntryForAdmin(entry.id)
    expect(getMissingPublicationRequirements(loaded!)).toContainEqual(expect.stringMatching(/imagen principal/i))
  })

  itDb("detecta una hero sin texto alternativo", async () => {
    const entry = await createContentEntry({
      type: "REAL_WEDDING",
      slug: uniqueSlug("hero-sin-alt"),
      translations: { es: { title: "Hero sin alt" } },
      media: [{ type: "IMAGE", url: "/images/porton/01-boda-civil-jardin.jpg", isHero: true }],
    })
    createdIds.push(entry.id)

    const loaded = await getContentEntryForAdmin(entry.id)
    expect(getMissingPublicationRequirements(loaded!)).toContainEqual(
      expect.stringMatching(/alternativo.*imagen principal/i)
    )
  })

  itDb("detecta imágenes de galería sin alt, no solo la hero", async () => {
    const entry = await createContentEntry({
      type: "REAL_WEDDING",
      slug: uniqueSlug("galeria-sin-alt"),
      translations: { es: { title: "Galería sin alt" } },
      media: [
        { type: "IMAGE", url: "/a.jpg", alt: "Hero", isHero: true },
        { type: "IMAGE", url: "/b.jpg" },
        { type: "IMAGE", url: "/c.jpg" },
      ],
    })
    createdIds.push(entry.id)

    const loaded = await getContentEntryForAdmin(entry.id)
    expect(getMissingPublicationRequirements(loaded!)).toContainEqual(expect.stringMatching(/2 archivo/i))
  })
})

describe("publishContentEntry", () => {
  itDb("rechaza publicar una ficha incompleta y no cambia su estado", async () => {
    const entry = await createContentEntry({
      type: "REAL_WEDDING",
      slug: uniqueSlug("incompleta"),
      translations: { es: { title: "Incompleta" } },
    })
    createdIds.push(entry.id)

    await expect(publishContentEntry(entry.id)).rejects.toBeInstanceOf(IncompletePublicationError)

    const after = await prisma.contentEntry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(after.status).toBe("DRAFT")
    expect(after.publishedAt).toBeNull()
  })

  itDb("publica una ficha completa y registra el AuditEvent", async () => {
    const entry = await createPublishableEntry()
    const published = await publishContentEntry(entry.id)

    expect(published.status).toBe("PUBLISHED")
    expect(published.publishedAt).not.toBeNull()

    const audit = await prisma.auditEvent.findFirst({
      where: { entityType: "ContentEntry", entityId: entry.id, action: "content.publish" },
    })
    expect(audit).not.toBeNull()
    expect(audit?.metadata).toMatchObject({ slug: entry.slug, previousStatus: "DRAFT" })
  })

  itDb("al republicar conserva la fecha de publicación original", async () => {
    const entry = await createPublishableEntry()
    const first = await publishContentEntry(entry.id)
    await unpublishContentEntry(entry.id)
    const second = await publishContentEntry(entry.id)

    expect(second.publishedAt?.toISOString()).toBe(first.publishedAt?.toISOString())
  })

  itDb("publicar una ficha archivada limpia archivedAt", async () => {
    const entry = await createPublishableEntry()
    await archiveContentEntry(entry.id)
    const republished = await publishContentEntry(entry.id)

    expect(republished.status).toBe("PUBLISHED")
    expect(republished.archivedAt).toBeNull()
  })
})

describe("unpublish / archive", () => {
  itDb("despublicar devuelve a borrador y audita", async () => {
    const entry = await createPublishableEntry()
    await publishContentEntry(entry.id)
    const unpublished = await unpublishContentEntry(entry.id)

    expect(unpublished.status).toBe("DRAFT")
    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: entry.id, action: "content.unpublish" },
    })
    expect(audit?.metadata).toMatchObject({ previousStatus: "PUBLISHED" })
  })

  itDb("archivar marca archivedAt, audita y no borra la fila", async () => {
    const entry = await createPublishableEntry()
    const archived = await archiveContentEntry(entry.id)

    expect(archived.status).toBe("ARCHIVED")
    expect(archived.archivedAt).not.toBeNull()
    // Requisito explícito: nunca se borra físicamente desde la UI.
    expect(await prisma.contentEntry.count({ where: { id: entry.id } })).toBe(1)

    const audit = await prisma.auditEvent.findFirst({ where: { entityId: entry.id, action: "content.archive" } })
    expect(audit).not.toBeNull()
  })
})

describe("saveContentEntry — concurrencia", () => {
  itDb("guarda cuando el updatedAt esperado coincide", async () => {
    const entry = await createPublishableEntry()
    const input = await buildSaveInput(entry.id, { translations: { es: { title: "Título nuevo" } } })

    const saved = await saveContentEntry(input)
    expect(saved.updatedAt.getTime()).toBeGreaterThanOrEqual(entry.updatedAt.getTime())

    const translation = await prisma.contentTranslation.findFirstOrThrow({
      where: { contentEntryId: entry.id, locale: "ES" },
    })
    expect(translation.title).toBe("Título nuevo")
  })

  itDb("rechaza el guardado si otra persona ya guardó (updatedAt obsoleto)", async () => {
    const entry = await createPublishableEntry()
    const staleInput = await buildSaveInput(entry.id, { translations: { es: { title: "Mi versión" } } })

    // Simula el guardado de otra persona entre la carga del editor y el envío.
    await saveContentEntry(await buildSaveInput(entry.id, { translations: { es: { title: "Versión ajena" } } }))

    await expect(saveContentEntry(staleInput)).rejects.toBeInstanceOf(ConcurrentUpdateError)

    // Lo importante: el trabajo ajeno sigue intacto.
    const translation = await prisma.contentTranslation.findFirstOrThrow({
      where: { contentEntryId: entry.id, locale: "ES" },
    })
    expect(translation.title).toBe("Versión ajena")
  })

  itDb("rechaza un slug ya usado por otra ficha del mismo tipo", async () => {
    const first = await createPublishableEntry()
    const second = await createPublishableEntry()

    await expect(saveContentEntry(await buildSaveInput(second.id, { slug: first.slug }))).rejects.toBeInstanceOf(
      DuplicateSlugError
    )
  })
})

describe("saveContentEntry — colecciones", () => {
  itDb("guarda minuta, cronología, momentos y proveedores conservando el orden", async () => {
    const entry = await createPublishableEntry()

    await saveContentEntry(
      await buildSaveInput(entry.id, {
        menuSections: [
          { course: "Cóctel", items: ["Jamón", "Croquetas"] },
          { course: "Postre", items: ["Tarta"] },
        ],
        timeline: [
          { time: "18:00", moment: "Ceremonia" },
          { time: "20:30", moment: "Banquete" },
        ],
        highlights: ["Sorpresa musical", "Suelta de farolillos"],
        providers: [
          { category: "Floristería", name: "Flor Ejemplo" },
          { category: "Música", name: "DJ Ejemplo" },
        ],
      })
    )

    const loaded = await getContentEntryForAdmin(entry.id)
    expect(loaded!.menuSections.map((section) => section.course)).toEqual(["Cóctel", "Postre"])
    expect(loaded!.menuSections[0].items.map((item) => item.label)).toEqual(["Jamón", "Croquetas"])
    expect(loaded!.timeline.map((item) => item.time)).toEqual(["18:00", "20:30"])
    expect(loaded!.highlights.map((item) => item.label)).toEqual(["Sorpresa musical", "Suelta de farolillos"])
    expect(loaded!.providers.map((provider) => provider.name)).toEqual(["Flor Ejemplo", "DJ Ejemplo"])
  })

  itDb("reescribir las colecciones no deja filas huérfanas de la versión anterior", async () => {
    const entry = await createPublishableEntry()
    await saveContentEntry(
      await buildSaveInput(entry.id, { highlights: ["A", "B", "C"], timeline: [{ time: "10:00", moment: "X" }] })
    )
    await saveContentEntry(await buildSaveInput(entry.id, { highlights: ["Solo uno"], timeline: [] }))

    expect(await prisma.contentHighlight.count({ where: { contentEntryId: entry.id } })).toBe(1)
    expect(await prisma.contentTimelineItem.count({ where: { contentEntryId: entry.id } })).toBe(0)
  })

  itDb("elimina la traducción inglesa cuando se envía vacía", async () => {
    const entry = await createContentEntry({
      type: "REAL_WEDDING",
      slug: uniqueSlug("con-ingles"),
      translations: { es: { title: "Con inglés" }, en: { title: "With English" } },
    })
    createdIds.push(entry.id)
    expect(await prisma.contentTranslation.count({ where: { contentEntryId: entry.id } })).toBe(2)

    await saveContentEntry(await buildSaveInput(entry.id, { translations: { es: { title: "Con inglés" }, en: null } }))

    const locales = await prisma.contentTranslation.findMany({ where: { contentEntryId: entry.id } })
    expect(locales.map((item) => item.locale)).toEqual(["ES"])
  })

  itDb("ignora un mediaId de proveedor que no pertenece a la ficha", async () => {
    const entry = await createPublishableEntry()
    const otherEntry = await createPublishableEntry()
    const foreignMedia = await prisma.contentMedia.findFirstOrThrow({ where: { contentEntryId: otherEntry.id } })

    await saveContentEntry(
      await buildSaveInput(entry.id, {
        providers: [{ category: "Fotografía", name: "Ajeno", mediaId: foreignMedia.id }],
      })
    )

    const provider = await prisma.contentProvider.findFirstOrThrow({ where: { contentEntryId: entry.id } })
    expect(provider.mediaId).toBeNull()
  })

  itDb("no modifica la media de otra ficha aunque se envíe su id", async () => {
    const entry = await createPublishableEntry()
    const otherEntry = await createPublishableEntry()
    const foreignMedia = await prisma.contentMedia.findFirstOrThrow({ where: { contentEntryId: otherEntry.id } })

    await saveContentEntry(
      await buildSaveInput(entry.id, {
        media: [{ id: foreignMedia.id, alt: "Alt inyectado", sortOrder: 0, isHero: true, inGallery: true }],
      })
    )

    const unchanged = await prisma.contentMedia.findUniqueOrThrow({ where: { id: foreignMedia.id } })
    expect(unchanged.alt).toBe("Hero de prueba")
  })

  itDb("registra un AuditEvent content.update en cada guardado", async () => {
    const entry = await createPublishableEntry()
    await saveContentEntry(await buildSaveInput(entry.id))

    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: entry.id, action: "content.update" },
    })
    expect(audit).not.toBeNull()
  })
})

describe("duplicateContentEntryAsDraft", () => {
  itDb("copia la ficha como borrador con un slug libre y reutiliza el objeto de Storage", async () => {
    const entry = await createContentEntry({
      type: "REAL_WEDDING",
      slug: uniqueSlug("original"),
      status: "PUBLISHED",
      translations: { es: { title: "Original" }, en: { title: "Original EN" } },
      media: [{ type: "IMAGE", storagePath: "carpeta/objeto-compartido.jpg", alt: "Hero", isHero: true }],
      menuSections: [{ course: "Entrantes", items: [{ label: "Ensalada" }] }],
      timeline: [{ time: "18:00", moment: "Ceremonia" }],
      highlights: [{ label: "Sorpresa" }],
      providers: [{ category: "Flores", name: "Floristería Ejemplo", mediaIndex: 0 }],
    })
    createdIds.push(entry.id)

    const copy = await duplicateContentEntryAsDraft(entry.id)
    createdIds.push(copy.id)

    expect(copy.id).not.toBe(entry.id)
    expect(copy.status).toBe("DRAFT")
    expect(copy.slug).toBe(`${entry.slug}-copia`)
    // Duplicar no debe arrastrar el destacado del original.
    expect(copy.featured).toBe(false)

    const loaded = await getContentEntryForAdmin(copy.id)
    expect(loaded!.translations.map((item) => item.locale).sort()).toEqual(["EN", "ES"])
    expect(loaded!.menuSections[0].items[0].label).toBe("Ensalada")
    expect(loaded!.timeline[0].moment).toBe("Ceremonia")
    expect(loaded!.highlights[0].label).toBe("Sorpresa")

    // El objeto del bucket NO se copia: ambas filas apuntan al mismo path.
    expect(loaded!.media[0].storagePath).toBe("carpeta/objeto-compartido.jpg")
    expect(loaded!.media[0].id).not.toBe(entry.id)

    // El proveedor apunta a la media de la copia, no a la del original.
    const originalMediaIds = new Set((await getContentEntryForAdmin(entry.id))!.media.map((media) => media.id))
    expect(loaded!.providers[0].mediaId).not.toBeNull()
    expect(originalMediaIds.has(loaded!.providers[0].mediaId!)).toBe(false)
  })

  itDb("al duplicar dos veces busca el siguiente slug libre", async () => {
    const entry = await createPublishableEntry()

    const first = await duplicateContentEntryAsDraft(entry.id)
    createdIds.push(first.id)
    const second = await duplicateContentEntryAsDraft(entry.id)
    createdIds.push(second.id)

    expect(first.slug).toBe(`${entry.slug}-copia`)
    expect(second.slug).toBe(`${entry.slug}-copia-2`)
  })

  itDb("registra un AuditEvent content.duplicate con la ficha de origen", async () => {
    const entry = await createPublishableEntry()
    const copy = await duplicateContentEntryAsDraft(entry.id)
    createdIds.push(copy.id)

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityId: copy.id, action: "content.duplicate" },
    })
    expect(audit.metadata).toMatchObject({ sourceId: entry.id, sourceSlug: entry.slug })
  })
})

describe("isSlugAvailable", () => {
  itDb("es false si ya existe otra ficha con ese slug y tipo", async () => {
    const entry = await createPublishableEntry()
    expect(await isSlugAvailable("REAL_WEDDING", entry.slug)).toBe(false)
  })

  itDb("es true para la propia ficha (permite guardar sin cambiar el slug)", async () => {
    const entry = await createPublishableEntry()
    expect(await isSlugAvailable("REAL_WEDDING", entry.slug, entry.id)).toBe(true)
  })

  itDb("es true si el mismo slug se usa en otro tipo de contenido", async () => {
    const entry = await createPublishableEntry()
    expect(await isSlugAvailable("CATERING_EVENT", entry.slug)).toBe(true)
  })
})

describe("listContentEntriesForAdmin", () => {
  itDb("incluye borradores y archivados, al contrario que el listado público", async () => {
    const draft = await createPublishableEntry()
    const archived = await createPublishableEntry()
    await archiveContentEntry(archived.id)

    const { entries } = await listContentEntriesForAdmin({ search: draft.slug })
    expect(entries.map((entry) => entry.id)).toContain(draft.id)

    const archivedResult = await listContentEntriesForAdmin({ search: archived.slug, status: "ARCHIVED" })
    expect(archivedResult.entries.map((entry) => entry.id)).toContain(archived.id)
  })

  itDb("busca por slug, por título y por espacio", async () => {
    const marker = uniqueSlug("busqueda")
    const entry = await createContentEntry({
      type: "CATERING_EVENT",
      slug: marker,
      space: `Salón ${marker}`,
      translations: { es: { title: `Título ${marker}` } },
    })
    createdIds.push(entry.id)

    for (const query of [marker, `Título ${marker}`, `Salón ${marker}`]) {
      const { entries } = await listContentEntriesForAdmin({ search: query })
      expect(entries.map((item) => item.id)).toContain(entry.id)
    }
  })

  itDb("la búsqueda no distingue mayúsculas de minúsculas", async () => {
    const marker = uniqueSlug("mayusculas")
    const entry = await createContentEntry({
      type: "REAL_WEDDING",
      slug: marker,
      translations: { es: { title: `Boda ${marker}` } },
    })
    createdIds.push(entry.id)

    const { entries } = await listContentEntriesForAdmin({ search: marker.toUpperCase() })
    expect(entries.map((item) => item.id)).toContain(entry.id)
  })

  itDb("filtra por tipo, estado, demo y destacado", async () => {
    const marker = uniqueSlug("filtros")
    const entry = await createContentEntry({
      type: "CATERING_EVENT",
      slug: marker,
      isDemo: true,
      featured: true,
      translations: { es: { title: `Filtros ${marker}` } },
    })
    createdIds.push(entry.id)

    const match = await listContentEntriesForAdmin({
      search: marker,
      type: "CATERING_EVENT",
      status: "DRAFT",
      isDemo: true,
      featured: true,
    })
    expect(match.entries.map((item) => item.id)).toContain(entry.id)

    const mismatch = await listContentEntriesForAdmin({ search: marker, type: "REAL_WEDDING" })
    expect(mismatch.entries).toHaveLength(0)

    const notDemo = await listContentEntriesForAdmin({ search: marker, isDemo: false })
    expect(notDemo.entries).toHaveLength(0)
  })

  itDb("filtra por rango de fecha del evento", async () => {
    const marker = uniqueSlug("fechas")
    const entry = await createContentEntry({
      type: "REAL_WEDDING",
      slug: marker,
      eventDate: new Date("2025-06-15T00:00:00.000Z"),
      translations: { es: { title: `Fechas ${marker}` } },
    })
    createdIds.push(entry.id)

    const inRange = await listContentEntriesForAdmin({
      search: marker,
      eventDateFrom: new Date("2025-01-01T00:00:00.000Z"),
      eventDateTo: new Date("2025-12-31T00:00:00.000Z"),
    })
    expect(inRange.entries.map((item) => item.id)).toContain(entry.id)

    const outOfRange = await listContentEntriesForAdmin({
      search: marker,
      eventDateFrom: new Date("2026-01-01T00:00:00.000Z"),
    })
    expect(outOfRange.entries).toHaveLength(0)
  })

  itDb("ordena por sortOrder ascendente", async () => {
    const marker = uniqueSlug("orden")
    const third = await createContentEntry({
      type: "REAL_WEDDING",
      slug: `${marker}-c`,
      sortOrder: 30,
      translations: { es: { title: `Orden ${marker} C` } },
    })
    const first = await createContentEntry({
      type: "REAL_WEDDING",
      slug: `${marker}-a`,
      sortOrder: 10,
      translations: { es: { title: `Orden ${marker} A` } },
    })
    const second = await createContentEntry({
      type: "REAL_WEDDING",
      slug: `${marker}-b`,
      sortOrder: 20,
      translations: { es: { title: `Orden ${marker} B` } },
    })
    createdIds.push(third.id, first.id, second.id)

    const { entries } = await listContentEntriesForAdmin({ search: marker })
    expect(entries.map((entry) => entry.id)).toEqual([first.id, second.id, third.id])
  })

  itDb("pagina en servidor: cada página trae solo su porción", async () => {
    const marker = uniqueSlug("paginacion")
    for (let index = 0; index < 5; index += 1) {
      const entry = await createContentEntry({
        type: "REAL_WEDDING",
        slug: `${marker}-${index}`,
        sortOrder: index,
        translations: { es: { title: `Página ${marker} ${index}` } },
      })
      createdIds.push(entry.id)
    }

    const page1 = await listContentEntriesForAdmin({ search: marker, page: 1, pageSize: 2 })
    const page2 = await listContentEntriesForAdmin({ search: marker, page: 2, pageSize: 2 })
    const page3 = await listContentEntriesForAdmin({ search: marker, page: 3, pageSize: 2 })

    expect(page1.total).toBe(5)
    expect(page1.totalPages).toBe(3)
    expect(page1.entries).toHaveLength(2)
    expect(page2.entries).toHaveLength(2)
    expect(page3.entries).toHaveLength(1)

    // Las páginas no se solapan: 5 fichas distintas repartidas en 3 páginas.
    const ids = new Set([...page1.entries, ...page2.entries, ...page3.entries].map((entry) => entry.id))
    expect(ids.size).toBe(5)
  })

  itDb("devuelve la hero y el número total de archivos de cada ficha", async () => {
    const marker = uniqueSlug("conteo-media")
    const entry = await createContentEntry({
      type: "REAL_WEDDING",
      slug: marker,
      translations: { es: { title: `Media ${marker}` } },
      media: [
        { type: "IMAGE", url: "/hero.jpg", alt: "Hero", isHero: true },
        { type: "IMAGE", url: "/a.jpg", alt: "A" },
        { type: "IMAGE", url: "/b.jpg", alt: "B" },
      ],
    })
    createdIds.push(entry.id)

    const { entries } = await listContentEntriesForAdmin({ search: marker })
    const found = entries.find((item) => item.id === entry.id)
    expect(found?._count.media).toBe(3)
    expect(found?.media).toHaveLength(1)
    expect(found?.media[0].isHero).toBe(true)
  })
})

describe("countContentEntriesByStatus", () => {
  itDb("cuadra el total con la suma por estado", async () => {
    const counts = await countContentEntriesByStatus()
    expect(counts.ALL).toBe(counts.DRAFT + counts.PUBLISHED + counts.ARCHIVED)
  })
})

describe("createContentEntry — auditoría", () => {
  itDb("registra content.create sin volcar el cuerpo del contenido", async () => {
    const entry = await createPublishableEntry()
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityId: entry.id, action: "content.create" },
    })

    expect(audit.metadata).toMatchObject({ type: "REAL_WEDDING", slug: entry.slug, mediaCount: 1 })
    // Solo identificadores y contadores: nada de textos de la ficha.
    expect(JSON.stringify(audit.metadata)).not.toContain("Ficha de prueba")
  })
})
