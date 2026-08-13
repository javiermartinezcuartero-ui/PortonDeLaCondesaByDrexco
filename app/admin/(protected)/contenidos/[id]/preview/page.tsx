import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { requireCmsAccess } from "../../../guards"
import { getContentEntryForAdmin } from "@/lib/domain/content"
import { resolveMediaUrls } from "@/lib/domain/content-media"
import { toStoryDetailData } from "@/lib/content/to-story-detail"
import { StoryDetail } from "@/components/vip/story-detail"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Previsualización de ficha",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

/**
 * Previsualización de una ficha tal como se verá públicamente, **incluidos
 * borradores y archivados**. Es una ruta de /admin: la protege el middleware,
 * el layout protegido y además `requireCmsAccess()` aquí mismo.
 * Un visitante anónimo nunca llega a ver contenido no publicado por esta vía.
 */
export default async function ContentPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCmsAccess()

  const { id } = await params
  const entry = await getContentEntryForAdmin(id)
  if (!entry) notFound()

  const signedUrls = await resolveMediaUrls(entry.media)
  const urlsByMediaId = new Map(entry.media.map((media) => [media.id, signedUrls.get(media) ?? null]))
  const story = toStoryDetailData(entry, urlsByMediaId)

  const statusLabel =
    entry.status === "PUBLISHED" ? "Publicado" : entry.status === "ARCHIVED" ? "Archivado" : "Borrador"

  return (
    <div className="-mx-6 -my-12">
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/80 px-6 py-3 backdrop-blur">
        <p className="text-xs tracking-[0.15em] uppercase text-muted-foreground">
          Previsualización · {statusLabel}
          {entry.isDemo && " · Contenido de ejemplo"}
        </p>
        <Link
          href={`/admin/contenidos/${entry.id}`}
          className="text-xs tracking-[0.15em] uppercase text-muted-foreground hover:text-foreground transition-colors duration-300"
        >
          ← Volver al editor
        </Link>
      </div>

      <StoryDetail
        story={story}
        backHref={`/admin/contenidos/${entry.id}`}
        kind={entry.type === "REAL_WEDDING" ? "bodas" : "catering"}
      />
    </div>
  )
}
