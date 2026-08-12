import type { Locale } from "@prisma/client"
import type { AdminContentEntry } from "@/lib/domain/content"
import type { StoryDetailData } from "@/components/vip/story-detail"

/**
 * Adapta un `ContentEntry` de la base de datos a la forma que ya renderiza
 * `StoryDetail`, para no duplicar el diseño de la ficha entre la preview del
 * panel y las páginas públicas.
 *
 * Se usa hoy en `/admin/contenidos/[id]/preview`. Cuando las rutas públicas
 * dejen de leer `data/vip-stories.ts` (Fase siguiente) reutilizarán este mismo
 * mapeador, así que aquí no hay nada específico del panel.
 *
 * @param resolvedUrls URL mostrable por cada media (firmada si el objeto vive
 *   en el bucket privado; ver lib/domain/content-media.ts). Las media sin URL
 *   resoluble se omiten en vez de renderizar una imagen rota.
 */
export function toStoryDetailData(
  entry: AdminContentEntry,
  resolvedUrls: Map<string, string | null>,
  locale: Locale = "ES"
): StoryDetailData {
  const translation =
    entry.translations.find((item) => item.locale === locale) ??
    entry.translations.find((item) => item.locale === "ES") ??
    entry.translations[0]

  const urlFor = (mediaId: string) => resolvedUrls.get(mediaId) ?? null
  const isVideo = (type: string) => type === "EXTERNAL_VIDEO" || type === "REEL"

  const heroMedia = entry.media.find((media) => media.isHero)
  const heroUrl = heroMedia ? urlFor(heroMedia.id) : null

  const gallery = entry.media
    // La hero se muestra aparte; `inGallery=false` son archivos que solo
    // ilustran a un proveedor y no deben repetirse en la cuadrícula.
    .filter((media) => !media.isHero && media.inGallery)
    .map((media) => {
      // En un vídeo/Reel lo que se muestra en la galería es su miniatura.
      const src = isVideo(media.type) ? media.thumbnailUrl ?? urlFor(media.id) : urlFor(media.id)
      return src ? { src, alt: media.alt ?? "", isVideo: isVideo(media.type) } : null
    })
    .filter((item): item is { src: string; alt: string; isVideo: boolean } => item !== null)

  const providers = entry.providers
    .map((provider) => {
      const media = provider.media
      const src = media ? (isVideo(media.type) ? media.thumbnailUrl ?? urlFor(media.id) : urlFor(media.id)) : null
      return {
        category: provider.category,
        name: provider.name,
        image: src ? { src, alt: media?.alt ?? "" } : undefined,
        isVideo: media ? isVideo(media.type) : false,
      }
    })

  const hasPrice = entry.priceFrom !== null && entry.priceTo !== null

  return {
    isExample: entry.isDemo,
    // Viaja al CTA para atribuir la solicitud comercial a esta ficha.
    contentId: entry.id,
    title: translation?.title ?? entry.slug,
    subtitle: translation?.subtitle ?? undefined,
    intro: translation?.intro ?? undefined,
    season: entry.season ?? undefined,
    space: entry.space ?? undefined,
    heroImage: heroUrl ? { src: heroUrl, alt: heroMedia?.alt ?? "" } : undefined,
    gallery,
    timing: entry.timeline.map((item) => ({ time: item.time, moment: item.moment })),
    menu: entry.menuSections.map((section) => ({
      course: section.course,
      items: section.items.map((item) => item.label),
    })),
    decor: entry.decor ?? undefined,
    photocall: entry.photocall ?? undefined,
    surprises: entry.highlights.map((item) => item.label),
    providers,
    weather: entry.weather ?? undefined,
    restaurantSolutions: entry.restaurantSolutions ?? undefined,
    testimonialQuote: entry.testimonialQuote ?? undefined,
    testimonialAuthor: entry.testimonialAuthor ?? undefined,
    priceRange: hasPrice
      ? {
          from: entry.priceFrom as number,
          to: entry.priceTo as number,
          currency: entry.priceCurrency ?? "€",
          note: entry.priceNote ?? "",
        }
      : undefined,
    ctaLabel: entry.ctaLabel ?? undefined,
    ctaHref: entry.ctaHref ?? undefined,
  }
}
