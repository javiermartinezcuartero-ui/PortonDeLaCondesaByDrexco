import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { requirePermission } from "@/lib/auth/session"
import { getContentEntryForAdmin, getMissingPublicationRequirements } from "@/lib/domain/content"
import { resolveMediaUrls } from "@/lib/domain/content-media"
import { isStorageConfigured } from "@/lib/storage/supabase"
import { ContentEditor, type EditorMedia } from "./content-editor"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Editar ficha de contenido",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("cms:access")

  const { id } = await params
  const entry = await getContentEntryForAdmin(id)
  if (!entry) notFound()

  // Los objetos del bucket privado se firman en servidor; la URL firmada solo
  // viaja al navegador de quien ya está autorizado y caduca por sí sola.
  const signedUrls = await resolveMediaUrls(entry.media)

  const media: EditorMedia[] = entry.media.map((item) => ({
    id: item.id,
    type: item.type,
    previewUrl: signedUrls.get(item) ?? null,
    thumbnailUrl: item.thumbnailUrl,
    alt: item.alt ?? "",
    caption: item.caption ?? "",
    sortOrder: item.sortOrder,
    isHero: item.isHero,
    inGallery: item.inGallery,
    isExternal: !item.storagePath,
    dimensions: item.width && item.height ? `${item.width}×${item.height}` : null,
  }))

  const spanish = entry.translations.find((translation) => translation.locale === "ES")
  const english = entry.translations.find((translation) => translation.locale === "EN")

  return (
    <div className="max-w-4xl space-y-8">
      <div className="space-y-2">
        <Link
          href="/admin/contenidos"
          className="text-xs tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition-colors duration-300"
        >
          ← Contenidos
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-serif text-3xl font-light text-foreground">
            {spanish?.title ?? "(sin título)"}
          </h1>
          <Link
            href={`/admin/contenidos/${entry.id}/preview`}
            className="text-xs tracking-[0.15em] uppercase text-muted-foreground hover:text-foreground transition-colors duration-300"
          >
            Previsualizar →
          </Link>
        </div>
      </div>

      <ContentEditor
        entry={{
          id: entry.id,
          updatedAt: entry.updatedAt.toISOString(),
          status: entry.status,
          type: entry.type,
          slug: entry.slug,
          isDemo: entry.isDemo,
          featured: entry.featured,
          sortOrder: entry.sortOrder,
          seoNoindex: entry.seoNoindex,
          eventDate: entry.eventDate ? entry.eventDate.toISOString().slice(0, 10) : "",
          season: entry.season ?? "",
          space: entry.space ?? "",
          decor: entry.decor ?? "",
          photocall: entry.photocall ?? "",
          weather: entry.weather ?? "",
          restaurantSolutions: entry.restaurantSolutions ?? "",
          testimonialQuote: entry.testimonialQuote ?? "",
          testimonialAuthor: entry.testimonialAuthor ?? "",
          priceFrom: entry.priceFrom?.toString() ?? "",
          priceTo: entry.priceTo?.toString() ?? "",
          priceCurrency: entry.priceCurrency ?? "",
          priceNote: entry.priceNote ?? "",
          ctaLabel: entry.ctaLabel ?? "",
          ctaHref: entry.ctaHref ?? "",
          translations: {
            es: {
              title: spanish?.title ?? "",
              subtitle: spanish?.subtitle ?? "",
              intro: spanish?.intro ?? "",
              seoTitle: spanish?.seoTitle ?? "",
              seoDescription: spanish?.seoDescription ?? "",
            },
            en: {
              title: english?.title ?? "",
              subtitle: english?.subtitle ?? "",
              intro: english?.intro ?? "",
              seoTitle: english?.seoTitle ?? "",
              seoDescription: english?.seoDescription ?? "",
            },
          },
          media,
          providers: entry.providers.map((provider) => ({
            category: provider.category,
            name: provider.name,
            mediaId: provider.mediaId ?? "",
          })),
          menuSections: entry.menuSections.map((section) => ({
            course: section.course,
            items: section.items.map((item) => item.label),
          })),
          timeline: entry.timeline.map((item) => ({ time: item.time, moment: item.moment })),
          highlights: entry.highlights.map((item) => item.label),
        }}
        missingToPublish={getMissingPublicationRequirements(entry)}
        storageConfigured={isStorageConfigured()}
      />
    </div>
  )
}
