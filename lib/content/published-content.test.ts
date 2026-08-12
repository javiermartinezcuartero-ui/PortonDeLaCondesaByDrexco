import { afterEach, describe, expect } from "vitest"
import { prisma } from "@/lib/db"
import {
  archiveContentEntry,
  createContentEntry,
  getPublishedContentBySlug,
  listPublishedContent,
  publishContentEntry,
} from "@/lib/domain/content"
import { toStoryCardData } from "@/lib/content/to-story-card"
import { itDb, uniqueSlug } from "@/lib/domain/test-helpers"

/**
 * Lo que ven las rutas públicas. Comprueba la frontera entre "publicado" y
 * "no publicado", que es la garantía de que un borrador nunca llega a un
 * visitante aunque tenga acceso VIP.
 */

const createdIds: string[] = []
afterEach(async () => {
  if (createdIds.length) {
    await prisma.contentEntry.deleteMany({ where: { id: { in: createdIds } } })
    createdIds.length = 0
  }
})

async function createEntry(overrides: Partial<Parameters<typeof createContentEntry>[0]> = {}) {
  const entry = await createContentEntry({
    type: "REAL_WEDDING",
    slug: uniqueSlug("publico"),
    translations: { es: { title: "Ficha pública" } },
    media: [{ type: "IMAGE", url: "/images/porton/01-boda-civil-jardin.jpg", alt: "Hero", isHero: true }],
    ...overrides,
  })
  createdIds.push(entry.id)
  return entry
}

describe("listPublishedContent", () => {
  itDb("no incluye borradores", async () => {
    const draft = await createEntry()
    const { id } = draft

    const entries = await listPublishedContent("REAL_WEDDING")
    expect(entries.map((entry) => entry.id)).not.toContain(id)
  })

  itDb("no incluye fichas archivadas", async () => {
    const entry = await createEntry()
    await publishContentEntry(entry.id)
    await archiveContentEntry(entry.id)

    const entries = await listPublishedContent("REAL_WEDDING")
    expect(entries.map((item) => item.id)).not.toContain(entry.id)
  })

  itDb("incluye las publicadas del tipo correcto y excluye las del otro tipo", async () => {
    const wedding = await createEntry()
    await publishContentEntry(wedding.id)

    const catering = await createEntry({
      type: "CATERING_EVENT",
      slug: uniqueSlug("publico-catering"),
      translations: { es: { title: "Catering público" } },
    })
    await publishContentEntry(catering.id)

    const weddings = await listPublishedContent("REAL_WEDDING")
    expect(weddings.map((entry) => entry.id)).toContain(wedding.id)
    expect(weddings.map((entry) => entry.id)).not.toContain(catering.id)

    const caterings = await listPublishedContent("CATERING_EVENT")
    expect(caterings.map((entry) => entry.id)).toContain(catering.id)
  })

  itDb("ordena destacados primero y luego por sortOrder", async () => {
    const marker = uniqueSlug("orden-publico")

    const normalLater = await createEntry({ slug: `${marker}-c`, sortOrder: 30, translations: { es: { title: "C" } } })
    const normalFirst = await createEntry({ slug: `${marker}-a`, sortOrder: 10, translations: { es: { title: "A" } } })
    const featured = await createEntry({
      slug: `${marker}-f`,
      sortOrder: 99,
      featured: true,
      translations: { es: { title: "Destacada" } },
    })

    for (const entry of [normalLater, normalFirst, featured]) await publishContentEntry(entry.id)

    const entries = await listPublishedContent("REAL_WEDDING")
    const positions = entries.map((entry) => entry.id)
    const own = positions.filter((id) => [featured.id, normalFirst.id, normalLater.id].includes(id))

    // La destacada va primero pese a tener el sortOrder más alto.
    expect(own).toEqual([featured.id, normalFirst.id, normalLater.id])
  })

  itDb("devuelve solo la imagen principal de cada ficha", async () => {
    const entry = await createEntry({
      slug: uniqueSlug("hero-unico"),
      translations: { es: { title: "Con galería" } },
      media: [
        { type: "IMAGE", url: "/hero.jpg", alt: "Hero", isHero: true },
        { type: "IMAGE", url: "/a.jpg", alt: "A" },
        { type: "IMAGE", url: "/b.jpg", alt: "B" },
      ],
    })
    await publishContentEntry(entry.id)

    const found = (await listPublishedContent("REAL_WEDDING")).find((item) => item.id === entry.id)
    expect(found?.media).toHaveLength(1)
    expect(found?.media[0].isHero).toBe(true)
  })
})

describe("getPublishedContentBySlug", () => {
  itDb("un borrador devuelve null aunque se conozca su slug", async () => {
    const draft = await createEntry()
    expect(await getPublishedContentBySlug("REAL_WEDDING", draft.slug)).toBeNull()
  })

  itDb("una ficha archivada devuelve null", async () => {
    const entry = await createEntry()
    await publishContentEntry(entry.id)
    await archiveContentEntry(entry.id)

    expect(await getPublishedContentBySlug("REAL_WEDDING", entry.slug)).toBeNull()
  })

  itDb("despublicar retira la ficha de la ruta pública de inmediato", async () => {
    const entry = await createEntry()
    await publishContentEntry(entry.id)
    expect(await getPublishedContentBySlug("REAL_WEDDING", entry.slug)).not.toBeNull()

    await prisma.contentEntry.update({ where: { id: entry.id }, data: { status: "DRAFT" } })
    expect(await getPublishedContentBySlug("REAL_WEDDING", entry.slug)).toBeNull()
  })

  itDb("no cruza tipos: el slug de una boda no resuelve como catering", async () => {
    const entry = await createEntry()
    await publishContentEntry(entry.id)

    expect(await getPublishedContentBySlug("CATERING_EVENT", entry.slug)).toBeNull()
  })
})

describe("toStoryCardData", () => {
  itDb("adapta la ficha a props planas de presentación, sin tipos de Prisma", async () => {
    const entry = await createEntry({
      slug: uniqueSlug("tarjeta"),
      season: "Otoño 2025",
      space: "Salón Portón",
      isDemo: true,
      translations: { es: { title: "Boda de ejemplo", subtitle: "Boda civil de otoño" } },
    })
    await publishContentEntry(entry.id)

    const listed = (await listPublishedContent("REAL_WEDDING")).find((item) => item.id === entry.id)!
    const card = toStoryCardData(listed, "https://firmada.example.com/hero.jpg")

    expect(card).toEqual({
      slug: entry.slug,
      title: "Boda de ejemplo",
      subtitle: "Boda civil de otoño",
      season: "Otoño 2025",
      space: "Salón Portón",
      heroImage: { src: "https://firmada.example.com/hero.jpg", alt: "Hero" },
      isExample: true,
    })
  })

  itDb("sin URL de hero resoluble no inventa una imagen", async () => {
    const entry = await createEntry({ slug: uniqueSlug("sin-hero-url") })
    await publishContentEntry(entry.id)

    const listed = (await listPublishedContent("REAL_WEDDING")).find((item) => item.id === entry.id)!
    expect(toStoryCardData(listed, null).heroImage).toBeUndefined()
  })
})
