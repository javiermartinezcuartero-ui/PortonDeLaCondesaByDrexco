import { describe, expect } from "vitest"
import type { ContentType } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getContentEntryForAdmin } from "@/lib/domain/content"
import { toStoryDetailData } from "@/lib/content/to-story-detail"
import { cateringStories, weddingStories, type VipStory } from "@/data/vip-stories"
import { itDb } from "@/lib/domain/test-helpers"

/**
 * Comprueba que los 6 casos de ejemplo sembrados en `ContentEntry`
 * (prisma/seed.ts) equivalen a la fuente estática `data/vip-stories.ts`.
 *
 * Es la condición explícita para poder retirar la fuente estática en una fase
 * posterior: mientras este test no exista y esté en verde, borrarla sería
 * asumir sin comprobar que la migración fue fiel. Si el seed no se ha
 * ejecutado en esta base, los tests se saltan con un aviso en vez de fallar.
 */

const ALL_STORIES: Array<{ story: VipStory; type: ContentType }> = [
  ...weddingStories.map((story) => ({ story, type: "REAL_WEDDING" as const })),
  ...cateringStories.map((story) => ({ story, type: "CATERING_EVENT" as const })),
]

async function loadSeeded(type: ContentType, slug: string) {
  const entry = await prisma.contentEntry.findUnique({ where: { type_slug: { type, slug } } })
  if (!entry) return null
  return getContentEntryForAdmin(entry.id)
}

describe("equivalencia de datos entre data/vip-stories.ts y ContentEntry", () => {
  itDb("los 6 casos de ejemplo están sembrados y marcados como demo", async () => {
    const missing: string[] = []
    for (const { story, type } of ALL_STORIES) {
      const seeded = await loadSeeded(type, story.slug)
      if (!seeded) {
        missing.push(`${type}/${story.slug}`)
        continue
      }
      expect(seeded.isDemo, `${story.slug} debe estar marcada como contenido de ejemplo`).toBe(true)
      expect(seeded.status).toBe("PUBLISHED")
    }

    if (missing.length === ALL_STORIES.length) {
      console.warn("El seed no se ha ejecutado en esta base (npm run db:seed); se omite la comparación.")
      return
    }
    expect(missing, "faltan casos por sembrar: ejecuta npm run db:seed").toEqual([])
  })

  itDb.each(ALL_STORIES)("$story.slug conserva todos sus datos", async ({ story, type }) => {
    const seeded = await loadSeeded(type, story.slug)
    if (!seeded) {
      console.warn(`${type}/${story.slug} no está sembrado; se omite (ejecuta npm run db:seed).`)
      return
    }

    const spanish = seeded.translations.find((translation) => translation.locale === "ES")
    expect(spanish?.title).toBe(story.title)
    expect(spanish?.subtitle).toBe(story.subtitle)

    expect(seeded.season).toBe(story.season)
    expect(seeded.space).toBe(story.space)
    expect(seeded.decor).toBe(story.decor)
    expect(seeded.photocall).toBe(story.photocall)
    expect(seeded.weather).toBe(story.weather)
    expect(seeded.restaurantSolutions).toBe(story.restaurantSolutions)
    expect(seeded.testimonialQuote).toBe(story.testimonialQuote)
    expect(seeded.testimonialAuthor).toBe(story.testimonialAuthor)

    expect(seeded.priceFrom).toBe(story.priceRange.from)
    expect(seeded.priceTo).toBe(story.priceRange.to)
    expect(seeded.priceCurrency).toBe(story.priceRange.currency)
    expect(seeded.priceNote).toBe(story.priceRange.note)

    // Minuta: mismos pases, en el mismo orden, con los mismos platos.
    expect(seeded.menuSections.map((section) => section.course)).toEqual(story.menu.map((course) => course.course))
    expect(seeded.menuSections.map((section) => section.items.map((item) => item.label))).toEqual(
      story.menu.map((course) => course.items)
    )

    expect(seeded.timeline.map((item) => ({ time: item.time, moment: item.moment }))).toEqual(story.timing)
    expect(seeded.highlights.map((item) => item.label)).toEqual(story.surprises)

    expect(seeded.providers.map((provider) => ({ category: provider.category, name: provider.name }))).toEqual(
      story.providers.map((provider) => ({ category: provider.category, name: provider.name }))
    )

    // Hero + galería: una media por cada imagen del caso original.
    const hero = seeded.media.find((media) => media.isHero)
    expect(hero?.url).toBe(story.heroImage.src)
    expect(hero?.alt).toBe(story.heroImage.alt)
  })

  itDb.each(ALL_STORIES)("$story.slug se renderiza igual al pasar por el mapeador", async ({ story, type }) => {
    const seeded = await loadSeeded(type, story.slug)
    if (!seeded) {
      console.warn(`${type}/${story.slug} no está sembrado; se omite.`)
      return
    }

    // Los ejemplos usan rutas públicas de /images, no objetos del bucket, así
    // que la URL resoluble es la propia `url` de cada media.
    const urls = new Map(seeded.media.map((media) => [media.id, media.url]))
    const rendered = toStoryDetailData(seeded, urls)

    // Equivalencia visual: lo que StoryDetail recibiría desde la base de datos
    // frente a lo que recibe hoy desde la fuente estática.
    expect(rendered.title).toBe(story.title)
    expect(rendered.subtitle).toBe(story.subtitle)
    expect(rendered.season).toBe(story.season)
    expect(rendered.space).toBe(story.space)
    expect(rendered.isExample).toBe(true)
    expect(rendered.heroImage?.src).toBe(story.heroImage.src)
    expect(rendered.gallery?.map((item) => item.src)).toEqual(story.gallery.map((item) => item.src))
    expect(rendered.gallery?.map((item) => item.isVideo === true)).toEqual(
      story.gallery.map((item) => item.isVideo === true)
    )
    expect(rendered.menu).toEqual(story.menu)
    expect(rendered.timing).toEqual(story.timing)
    expect(rendered.surprises).toEqual(story.surprises)
    expect(rendered.priceRange).toEqual(story.priceRange)
    expect(rendered.providers?.map((provider) => provider.name)).toEqual(
      story.providers.map((provider) => provider.name)
    )
    expect(rendered.providers?.map((provider) => provider.image?.src)).toEqual(
      story.providers.map((provider) => provider.image.src)
    )
  })
})
