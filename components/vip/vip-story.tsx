import { notFound } from "next/navigation"
import type { ContentType } from "@prisma/client"
import { getPublishedContentBySlug } from "@/lib/domain/content"
import { PUBLIC_SIGNED_URL_TTL_SECONDS, resolveMediaUrls } from "@/lib/domain/content-media"
import { toStoryDetailData } from "@/lib/content/to-story-detail"
import { getVipLead } from "@/lib/vip/session"
import { StoryDetail } from "@/components/vip/story-detail"
import { VipGate } from "@/components/vip/vip-gate"
import { TrackVipView } from "@/components/vip/track-vip-view"

/**
 * Ficha individual de una biblioteca VIP. Un único componente para bodas y
 * catering.
 *
 * Acceder directamente a un slug exige sesión igual que el listado: la
 * comprobación va **antes** de consultar la ficha, así que ni el título llega
 * al HTML de alguien sin acceso.
 */
export async function VipStory({ type, slug }: { type: ContentType; slug: string }) {
  const basePath = type === "REAL_WEDDING" ? "/bodas-reales" : "/catering"

  const lead = await getVipLead()

  if (!lead) {
    return (
      <main className="min-h-screen bg-background px-6 pt-32 pb-24 md:px-12 md:pt-40 lg:px-20">
        {/* `returnPath` devuelve al visitante a esta misma ficha tras acceder. */}
        <VipGate section={type} returnPath={`${basePath}/${slug}`} />
      </main>
    )
  }

  // `getPublishedContentBySlug` filtra por PUBLISHED: un borrador o una ficha
  // archivada devuelven 404 aunque el visitante tenga acceso.
  const entry = await getPublishedContentBySlug(type, slug)
  if (!entry) notFound()

  const signed = await resolveMediaUrls(entry.media, PUBLIC_SIGNED_URL_TTL_SECONDS)
  const urlsByMediaId = new Map(entry.media.map((media) => [media.id, signed.get(media) ?? null]))
  const story = toStoryDetailData(entry, urlsByMediaId)

  return (
    <main className="min-h-screen bg-background">
      <TrackVipView section={type} contentEntryId={entry.id} />
      <StoryDetail story={story} backHref={basePath} kind={type === "REAL_WEDDING" ? "bodas" : "catering"} />
    </main>
  )
}
