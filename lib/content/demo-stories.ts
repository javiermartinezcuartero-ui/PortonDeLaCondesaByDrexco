import type { ContentType } from "@prisma/client"
import type { ContentMediaInput, ContentProviderInput, CreateContentEntryInput } from "@/lib/domain/content"
import type { VipStory } from "@/data/vip-stories"

/**
 * Conversión de un caso de ejemplo de `data/vip-stories.ts` al payload de
 * `createContentEntry`.
 *
 * Vivía dentro de `prisma/seed.ts`. Se ha sacado aquí al separar el sembrado de
 * demostración del sembrado base (Fase 10): la demo la siembra
 * `scripts/demo-seed.ts` y el mapeo tenía que dejar de estar atado a un script
 * concreto para poder ejecutarse desde cualquiera de los dos.
 *
 * **Siempre `isDemo: true`.** No es un parámetro: estas fichas son ilustrativas y
 * el filtro de `lib/domain/content.ts` depende de esa marca para no publicarlas en
 * producción salvo que `ENABLE_DEMO_CONTENT` lo autorice expresamente. Dejarlo
 * configurable sería dejar abierta la puerta a publicar material de ejemplo como
 * si fuera real.
 */
export function demoStoryToContentEntry(story: VipStory, type: ContentType): CreateContentEntryInput {
  const media: ContentMediaInput[] = [
    { type: "IMAGE", url: story.heroImage.src, alt: story.heroImage.alt, isHero: true, sortOrder: 0 },
    ...story.gallery.map((item, index) => ({
      type: item.isVideo ? ("EXTERNAL_VIDEO" as const) : ("IMAGE" as const),
      url: item.src,
      alt: item.alt,
      sortOrder: index + 1,
    })),
  ]

  const providers: ContentProviderInput[] = story.providers.map((provider, index) => {
    const mediaIndex = media.length
    media.push({
      type: provider.isVideo ? "EXTERNAL_VIDEO" : "IMAGE",
      url: provider.image.src,
      alt: provider.image.alt,
      sortOrder: mediaIndex,
      // Solo ilustra al proveedor: no debe duplicarse en la galería pública.
      inGallery: false,
    })
    return { category: provider.category, name: provider.name, sortOrder: index, mediaIndex }
  })

  return {
    type,
    slug: story.slug,
    status: "PUBLISHED",
    isDemo: true,
    season: story.season,
    space: story.space,
    decor: story.decor,
    photocall: story.photocall,
    weather: story.weather,
    restaurantSolutions: story.restaurantSolutions,
    testimonialQuote: story.testimonialQuote,
    testimonialAuthor: story.testimonialAuthor,
    priceFrom: story.priceRange.from,
    priceTo: story.priceRange.to,
    priceCurrency: story.priceRange.currency,
    priceNote: story.priceRange.note,
    translations: { es: { title: story.title, subtitle: story.subtitle } },
    media,
    providers,
    menuSections: story.menu.map((course) => ({
      course: course.course,
      items: course.items.map((label) => ({ label })),
    })),
    timeline: story.timing,
    highlights: story.surprises.map((label) => ({ label })),
  }
}
