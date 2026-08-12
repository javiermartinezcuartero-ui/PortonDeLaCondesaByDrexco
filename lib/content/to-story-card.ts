import type { Locale } from "@prisma/client"
import type { PublishedContentListItem } from "@/lib/domain/content"
import type { StoryCardData } from "@/components/vip/story-card"

/**
 * Adapta una fila de `ContentEntry` a las props de presentación de
 * `StoryCard`. Los componentes de UI no conocen Prisma: reciben este tipo
 * plano, lo que permite cambiar el ORM sin tocar la capa visual (y hace que
 * los tests de componentes no necesiten base de datos).
 *
 * @param heroUrl URL ya resuelta de la imagen principal (firmada si vive en el
 *   bucket privado). Se pasa desde fuera porque firmar es una operación de
 *   servidor con I/O, no una transformación de datos.
 */
export function toStoryCardData(
  entry: PublishedContentListItem,
  heroUrl: string | null,
  locale: Locale = "ES"
): StoryCardData {
  const translation =
    entry.translations.find((item) => item.locale === locale) ??
    entry.translations.find((item) => item.locale === "ES") ??
    entry.translations[0]

  const hero = entry.media[0]

  return {
    slug: entry.slug,
    title: translation?.title ?? entry.slug,
    subtitle: translation?.subtitle ?? undefined,
    season: entry.season ?? undefined,
    space: entry.space ?? undefined,
    heroImage: heroUrl ? { src: heroUrl, alt: hero?.alt ?? "" } : undefined,
    isExample: entry.isDemo,
  }
}
