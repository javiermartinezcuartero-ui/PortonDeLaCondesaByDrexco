import type { ContentType } from "@prisma/client"
import { listPublishedContent } from "@/lib/domain/content"
import { PUBLIC_SIGNED_URL_TTL_SECONDS, resolveMediaUrls } from "@/lib/domain/content-media"
import { toStoryCardData } from "@/lib/content/to-story-card"
import { getVipLead } from "@/lib/vip/session"
import { StoryCard } from "@/components/vip/story-card"
import { VipListHeader } from "@/components/vip/list-header"
import { VipGate } from "@/components/vip/vip-gate"
import { TrackVipView } from "@/components/vip/track-vip-view"
import { VipEmptyLibrary } from "@/components/vip/vip-empty-library"

/**
 * Listado de una biblioteca VIP. Un único componente para bodas y catering: la
 * diferencia entre ambas es el `type` y la ruta base, no el comportamiento.
 *
 * **El orden importa**: primero se resuelve la sesión y, solo si existe, se
 * consulta el contenido. Sin acceso no se ejecuta ninguna consulta de fichas,
 * así que no hay nada que pueda filtrarse por el HTML ni por el payload RSC.
 */
export async function VipLibrary({ type }: { type: ContentType }) {
  const kind = type === "REAL_WEDDING" ? "bodas" : "catering"
  const basePath = type === "REAL_WEDDING" ? "/bodas-reales" : "/catering"

  const lead = await getVipLead()

  if (!lead) {
    return (
      <main className="min-h-screen bg-background px-6 pt-32 pb-24 md:px-12 md:pt-40 lg:px-20">
        <VipGate section={type} returnPath={basePath} />
      </main>
    )
  }

  const entries = await listPublishedContent(type)
  // Las URLs firmadas se generan aquí, después de haber validado el acceso.
  const heroMedia = entries.flatMap((entry) => entry.media)
  const signed = await resolveMediaUrls(heroMedia, PUBLIC_SIGNED_URL_TTL_SECONDS)

  const cards = entries.map((entry) => {
    const hero = entry.media[0]
    return toStoryCardData(entry, hero ? (signed.get(hero) ?? null) : null)
  })

  return (
    <main className="min-h-screen bg-background pt-32 md:pt-40 pb-24 md:pb-32">
      <TrackVipView section={type} />
      <div className="max-w-[1800px] mx-auto px-6 md:px-12 lg:px-20">
        <VipListHeader kind={kind} />

        {cards.length === 0 ? (
          <VipEmptyLibrary kind={kind} />
        ) : (
          <div className="grid md:grid-cols-3 gap-10 mt-16">
            {cards.map((card) => (
              <StoryCard key={card.slug} story={card} basePath={basePath} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
