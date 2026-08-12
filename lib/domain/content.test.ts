import { afterEach, describe, expect } from "vitest"
import { prisma } from "@/lib/db"
import {
  createContentEntry,
  publishContentEntry,
  unpublishContentEntry,
  getPublishedContentBySlug,
} from "@/lib/domain/content"
import { DuplicateSlugError } from "@/lib/domain/errors"
import { itDb } from "@/lib/domain/test-helpers"

const createdEntryIds: string[] = []
afterEach(async () => {
  if (createdEntryIds.length) {
    await prisma.contentEntry.deleteMany({ where: { id: { in: createdEntryIds } } })
    createdEntryIds.length = 0
  }
})

function uniqueSlug(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

describe("createContentEntry / publishContentEntry", () => {
  itDb("publica una ficha y conserva publishedAt al republicar", async () => {
    const slug = uniqueSlug("boda-test")
    const entry = await createContentEntry({
      type: "REAL_WEDDING",
      slug,
      translations: { es: { title: "Boda de prueba" } },
      // Desde la Fase 4, publicar exige imagen principal con texto
      // alternativo (ver getMissingPublicationRequirements).
      media: [{ type: "IMAGE", url: "/images/porton/01-boda-civil-jardin.jpg", alt: "Hero de prueba", isHero: true }],
    })
    createdEntryIds.push(entry.id)
    expect(entry.status).toBe("DRAFT")

    const published = await publishContentEntry(entry.id)
    expect(published.status).toBe("PUBLISHED")
    expect(published.publishedAt).not.toBeNull()

    const found = await getPublishedContentBySlug("REAL_WEDDING", slug)
    expect(found?.id).toBe(entry.id)
    expect(found?.translations.some((t) => t.locale === "ES" && t.title === "Boda de prueba")).toBe(true)

    await unpublishContentEntry(entry.id)
    const firstPublishedAt = published.publishedAt

    const republished = await publishContentEntry(entry.id)
    expect(republished.publishedAt?.getTime()).toBe(firstPublishedAt?.getTime())
  })

  itDb("rechaza un slug duplicado para el mismo tipo", async () => {
    const slug = uniqueSlug("catering-test")
    const entry = await createContentEntry({
      type: "CATERING_EVENT",
      slug,
      translations: { es: { title: "Catering de prueba" } },
    })
    createdEntryIds.push(entry.id)

    await expect(
      createContentEntry({ type: "CATERING_EVENT", slug, translations: { es: { title: "Otra ficha" } } })
    ).rejects.toBeInstanceOf(DuplicateSlugError)
  })

  itDb("permite el mismo slug en dos tipos distintos", async () => {
    const slug = uniqueSlug("mismo-slug")
    const wedding = await createContentEntry({
      type: "REAL_WEDDING",
      slug,
      translations: { es: { title: "Boda" } },
    })
    const catering = await createContentEntry({
      type: "CATERING_EVENT",
      slug,
      translations: { es: { title: "Catering" } },
    })
    createdEntryIds.push(wedding.id, catering.id)

    expect(wedding.id).not.toBe(catering.id)
  })
})
