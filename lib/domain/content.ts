import { prisma } from "@/lib/db"
import {
  ConcurrentUpdateError,
  DuplicateSlugError,
  IncompletePublicationError,
  MissingTranslationError,
} from "@/lib/domain/errors"
import { recordAuditEvent } from "@/lib/domain/audit"
import type { ContentEntry, ContentStatus, ContentType, MediaType, Prisma } from "@prisma/client"

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "P2002"

export type ContentTranslationInput = {
  title: string
  subtitle?: string
  intro?: string
  seoTitle?: string
  seoDescription?: string
}

export type ContentMediaInput = {
  type: MediaType
  storagePath?: string
  url?: string
  thumbnailUrl?: string
  alt?: string
  caption?: string
  sortOrder?: number
  isHero?: boolean
  inGallery?: boolean
  mimeType?: string
  sizeBytes?: number
  width?: number
  height?: number
}

export type ContentProviderInput = {
  category: string
  name: string
  sortOrder?: number
  /** Índice dentro del array `media` de este mismo payload, si el proveedor tiene foto/vídeo asociado. */
  mediaIndex?: number
}

export type ContentMenuSectionInput = {
  course: string
  sortOrder?: number
  items: { label: string; sortOrder?: number }[]
}

export type ContentTimelineItemInput = { time: string; moment: string; sortOrder?: number }
export type ContentHighlightInput = { label: string; sortOrder?: number }

export type CreateContentEntryInput = {
  type: ContentType
  slug: string
  status?: ContentStatus
  isDemo?: boolean
  featured?: boolean
  sortOrder?: number
  eventDate?: Date
  season?: string
  space?: string
  decor?: string
  photocall?: string
  weather?: string
  restaurantSolutions?: string
  testimonialQuote?: string
  testimonialAuthor?: string
  priceFrom?: number
  priceTo?: number
  priceCurrency?: string
  priceNote?: string
  ctaLabel?: string
  ctaHref?: string
  seoNoindex?: boolean
  createdById?: string
  translations: { es: ContentTranslationInput; en?: ContentTranslationInput }
  media?: ContentMediaInput[]
  providers?: ContentProviderInput[]
  menuSections?: ContentMenuSectionInput[]
  timeline?: ContentTimelineItemInput[]
  highlights?: ContentHighlightInput[]
}

function toTranslationData(input: ContentTranslationInput) {
  return {
    title: input.title,
    subtitle: input.subtitle,
    intro: input.intro,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
  }
}

/**
 * Crea una ficha de contenido completa (traducciones, media, proveedores,
 * minuta, timeline y highlights) en una única transacción. La traducción
 * `es` es obligatoria; `en` es opcional (invariante de negocio, no del
 * esquema — ver prisma/schema.prisma).
 */
export async function createContentEntry(input: CreateContentEntryInput): Promise<ContentEntry> {
  if (!input.translations.es?.title) {
    throw new MissingTranslationError("es")
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const entry = await tx.contentEntry.create({
        data: {
          type: input.type,
          slug: input.slug,
          status: input.status,
          isDemo: input.isDemo ?? false,
          featured: input.featured ?? false,
          sortOrder: input.sortOrder ?? 0,
          eventDate: input.eventDate,
          season: input.season,
          space: input.space,
          decor: input.decor,
          photocall: input.photocall,
          weather: input.weather,
          restaurantSolutions: input.restaurantSolutions,
          testimonialQuote: input.testimonialQuote,
          testimonialAuthor: input.testimonialAuthor,
          priceFrom: input.priceFrom,
          priceTo: input.priceTo,
          priceCurrency: input.priceCurrency,
          priceNote: input.priceNote,
          ctaLabel: input.ctaLabel,
          ctaHref: input.ctaHref,
          seoNoindex: input.seoNoindex ?? true,
          createdById: input.createdById,
          updatedById: input.createdById,
          translations: {
            create: [
              { locale: "ES", ...toTranslationData(input.translations.es) },
              ...(input.translations.en ? [{ locale: "EN" as const, ...toTranslationData(input.translations.en) }] : []),
            ],
          },
        },
      })

      const mediaIds: string[] = []
      for (const media of input.media ?? []) {
        const created = await tx.contentMedia.create({ data: { ...media, contentEntryId: entry.id } })
        mediaIds.push(created.id)
      }

      for (const provider of input.providers ?? []) {
        await tx.contentProvider.create({
          data: {
            contentEntryId: entry.id,
            category: provider.category,
            name: provider.name,
            sortOrder: provider.sortOrder ?? 0,
            mediaId: provider.mediaIndex !== undefined ? mediaIds[provider.mediaIndex] : undefined,
          },
        })
      }

      for (const section of input.menuSections ?? []) {
        await tx.contentMenuSection.create({
          data: {
            contentEntryId: entry.id,
            course: section.course,
            sortOrder: section.sortOrder ?? 0,
            items: { create: section.items.map((item, index) => ({ label: item.label, sortOrder: item.sortOrder ?? index })) },
          },
        })
      }

      if (input.timeline?.length) {
        await tx.contentTimelineItem.createMany({
          data: input.timeline.map((item, index) => ({ ...item, sortOrder: item.sortOrder ?? index, contentEntryId: entry.id })),
        })
      }

      if (input.highlights?.length) {
        await tx.contentHighlight.createMany({
          data: input.highlights.map((item, index) => ({ ...item, sortOrder: item.sortOrder ?? index, contentEntryId: entry.id })),
        })
      }

      await tx.auditEvent.create({
        data: {
          entityType: "ContentEntry",
          entityId: entry.id,
          action: "content.create",
          actorId: input.createdById,
          // Solo identificadores y contadores: nunca el cuerpo del contenido.
          metadata: {
            type: entry.type,
            slug: entry.slug,
            status: entry.status,
            isDemo: entry.isDemo,
            mediaCount: input.media?.length ?? 0,
          },
        },
      })

      return entry
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateSlugError(input.type, input.slug)
    }
    throw error
  }
}

export type UpdateContentEntryInput = Partial<
  Omit<CreateContentEntryInput, "translations" | "media" | "providers" | "menuSections" | "timeline" | "highlights">
> & { updatedById?: string }

export async function updateContentEntry(id: string, input: UpdateContentEntryInput): Promise<ContentEntry> {
  return prisma.contentEntry.update({ where: { id }, data: input })
}

/**
 * Requisitos mínimos para publicar (enunciado de la Fase 4): título, slug,
 * traducción española, imagen hero y `alt` de esa hero. Devuelve la lista de
 * lo que falta en lenguaje natural, en vez de un booleano, para que la UI
 * pueda decir exactamente qué corregir.
 */
export function getMissingPublicationRequirements(entry: {
  slug: string
  translations: readonly { locale: string; title: string }[]
  media: readonly { isHero: boolean; alt: string | null }[]
}): string[] {
  const missing: string[] = []

  const spanish = entry.translations.find((translation) => translation.locale === "ES")
  if (!spanish) {
    missing.push("la traducción española")
  } else if (!spanish.title.trim()) {
    missing.push("el título en español")
  }

  if (!entry.slug.trim()) missing.push("el slug")

  const hero = entry.media.find((media) => media.isHero)
  if (!hero) {
    missing.push("la imagen principal (hero)")
  } else if (!hero.alt?.trim()) {
    missing.push("el texto alternativo (alt) de la imagen principal")
  }

  // "alt obligatorio para imágenes publicadas": no solo la hero.
  const imagesWithoutAlt = entry.media.filter((media) => !media.isHero && !media.alt?.trim()).length
  if (imagesWithoutAlt > 0) {
    missing.push(`el texto alternativo (alt) de ${imagesWithoutAlt} archivo(s) de la galería`)
  }

  return missing
}

/**
 * Publica la ficha dentro de una transacción que incluye el `AuditEvent`: si
 * la auditoría falla, la publicación no queda registrada a medias.
 */
export async function publishContentEntry(id: string, updatedById?: string): Promise<ContentEntry> {
  const existing = await prisma.contentEntry.findUniqueOrThrow({
    where: { id },
    include: { translations: true, media: true },
  })

  const missing = getMissingPublicationRequirements(existing)
  if (missing.length) {
    // Si lo único que falta es la traducción española, se usa el error
    // específico ya existente para no romper a quien lo capture por tipo.
    if (missing.length === 1 && missing[0] === "la traducción española") {
      throw new MissingTranslationError("es")
    }
    throw new IncompletePublicationError(missing)
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.contentEntry.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        // Se conserva la primera fecha de publicación al republicar.
        publishedAt: existing.publishedAt ?? new Date(),
        archivedAt: null,
        updatedById,
      },
    })
    await tx.auditEvent.create({
      data: {
        entityType: "ContentEntry",
        entityId: id,
        action: "content.publish",
        actorId: updatedById,
        metadata: { type: updated.type, slug: updated.slug, previousStatus: existing.status },
      },
    })
    return updated
  })
}

export async function unpublishContentEntry(id: string, updatedById?: string): Promise<ContentEntry> {
  const existing = await prisma.contentEntry.findUniqueOrThrow({ where: { id } })

  return prisma.$transaction(async (tx) => {
    const updated = await tx.contentEntry.update({ where: { id }, data: { status: "DRAFT", updatedById } })
    await tx.auditEvent.create({
      data: {
        entityType: "ContentEntry",
        entityId: id,
        action: "content.unpublish",
        actorId: updatedById,
        metadata: { type: updated.type, slug: updated.slug, previousStatus: existing.status },
      },
    })
    return updated
  })
}

export async function archiveContentEntry(id: string, updatedById?: string): Promise<ContentEntry> {
  const existing = await prisma.contentEntry.findUniqueOrThrow({ where: { id } })

  return prisma.$transaction(async (tx) => {
    const updated = await tx.contentEntry.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), updatedById },
    })
    await tx.auditEvent.create({
      data: {
        entityType: "ContentEntry",
        entityId: id,
        action: "content.archive",
        actorId: updatedById,
        metadata: { type: updated.type, slug: updated.slug, previousStatus: existing.status },
      },
    })
    return updated
  })
}

/** El contenido de ejemplo (`isDemo`) solo se lista si ENABLE_DEMO_CONTENT=true. */
function demoFilter(): Prisma.ContentEntryWhereInput {
  return process.env.ENABLE_DEMO_CONTENT === "true" ? {} : { isDemo: false }
}

/**
 * Listado público de una sección. Solo `PUBLISHED`: un `DRAFT` o un `ARCHIVED`
 * no puede aparecer nunca por esta vía (la preview de borradores va por la ruta
 * protegida `/admin/contenidos/[id]/preview`).
 *
 * Orden: destacados primero, luego `sortOrder` manual y, a igualdad, lo más
 * recién publicado antes.
 */
export async function listPublishedContent(type: ContentType) {
  return prisma.contentEntry.findMany({
    where: { type, status: "PUBLISHED", ...demoFilter() },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { publishedAt: "desc" }],
    include: {
      translations: true,
      // Para una tarjeta solo hace falta la imagen principal.
      media: { where: { isHero: true }, take: 1 },
    },
  })
}

export type PublishedContentListItem = Awaited<ReturnType<typeof listPublishedContent>>[number]

export async function getPublishedContentBySlug(type: ContentType, slug: string) {
  return prisma.contentEntry.findFirst({
    where: { type, slug, status: "PUBLISHED", ...demoFilter() },
    include: FULL_ENTRY_INCLUDE,
  })
}

// ---------------------------------------------------------------------------
// Operaciones del panel de administración (/admin/contenidos)
// ---------------------------------------------------------------------------

const FULL_ENTRY_INCLUDE = {
  translations: true,
  media: { orderBy: { sortOrder: "asc" } },
  providers: { orderBy: { sortOrder: "asc" }, include: { media: true } },
  menuSections: { orderBy: { sortOrder: "asc" }, include: { items: { orderBy: { sortOrder: "asc" } } } },
  timeline: { orderBy: { sortOrder: "asc" } },
  highlights: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.ContentEntryInclude

export type AdminContentEntry = Prisma.ContentEntryGetPayload<{ include: typeof FULL_ENTRY_INCLUDE }>

/**
 * Devuelve una ficha con todas sus colecciones, **sin** filtrar por estado ni
 * por `isDemo`: el panel debe poder ver borradores y archivados. La
 * autorización es responsabilidad de quien llama (ver lib/auth/session.ts).
 */
export async function getContentEntryForAdmin(id: string): Promise<AdminContentEntry | null> {
  return prisma.contentEntry.findUnique({ where: { id }, include: FULL_ENTRY_INCLUDE })
}

export const CONTENT_LIST_PAGE_SIZE = 10

export type ContentListFilters = {
  type?: ContentType
  status?: ContentStatus
  isDemo?: boolean
  featured?: boolean
  /** Busca en título (cualquier idioma), slug y espacio. */
  search?: string
  /** Filtra por `eventDate` (no por fecha de creación). */
  eventDateFrom?: Date
  eventDateTo?: Date
  page?: number
  pageSize?: number
}

export type ContentListResult = {
  entries: Prisma.ContentEntryGetPayload<{
    include: { translations: true; media: true; _count: { select: { media: true } } }
  }>[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function buildAdminWhere(filters: ContentListFilters): Prisma.ContentEntryWhereInput {
  const where: Prisma.ContentEntryWhereInput = {}

  if (filters.type) where.type = filters.type
  if (filters.status) where.status = filters.status
  if (filters.isDemo !== undefined) where.isDemo = filters.isDemo
  if (filters.featured !== undefined) where.featured = filters.featured

  if (filters.eventDateFrom || filters.eventDateTo) {
    where.eventDate = {
      ...(filters.eventDateFrom ? { gte: filters.eventDateFrom } : {}),
      ...(filters.eventDateTo ? { lte: filters.eventDateTo } : {}),
    }
  }

  const search = filters.search?.trim()
  if (search) {
    where.OR = [
      { slug: { contains: search, mode: "insensitive" } },
      { space: { contains: search, mode: "insensitive" } },
      { translations: { some: { title: { contains: search, mode: "insensitive" } } } },
    ]
  }

  return where
}

/** Listado paginado en servidor. Nunca carga la tabla completa en memoria. */
export async function listContentEntriesForAdmin(filters: ContentListFilters = {}): Promise<ContentListResult> {
  const pageSize = filters.pageSize ?? CONTENT_LIST_PAGE_SIZE
  const page = Math.max(1, filters.page ?? 1)
  const where = buildAdminWhere(filters)

  const [total, entries] = await Promise.all([
    prisma.contentEntry.count({ where }),
    prisma.contentEntry.findMany({
      where,
      // `sortOrder` lo fija a mano el equipo y se repite mucho (todo a 0 por
      // defecto), así que sin un tercer criterio único una ficha podía aparecer en
      // dos páginas del listado del CMS.
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        translations: true,
        media: { where: { isHero: true }, take: 1 },
        _count: { select: { media: true } },
      },
    }),
  ])

  return { entries, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

/** Cuenta por pestaña del listado, en una sola consulta agrupada. */
export async function countContentEntriesByStatus(): Promise<Record<ContentStatus | "ALL", number>> {
  const grouped = await prisma.contentEntry.groupBy({ by: ["status"], _count: { _all: true } })
  const counts = { ALL: 0, DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 }
  for (const row of grouped) {
    counts[row.status] = row._count._all
    counts.ALL += row._count._all
  }
  return counts
}

export type SaveContentEntryInput = {
  id: string
  /** `updatedAt` que tenía la ficha cuando se abrió el editor. */
  expectedUpdatedAt: Date
  updatedById?: string
  type: ContentType
  slug: string
  isDemo: boolean
  featured: boolean
  sortOrder: number
  seoNoindex: boolean
  eventDate?: Date | null
  season?: string | null
  space?: string | null
  decor?: string | null
  photocall?: string | null
  weather?: string | null
  restaurantSolutions?: string | null
  testimonialQuote?: string | null
  testimonialAuthor?: string | null
  priceFrom?: number | null
  priceTo?: number | null
  priceCurrency?: string | null
  priceNote?: string | null
  ctaLabel?: string | null
  ctaHref?: string | null
  translations: { es: ContentTranslationInput; en?: ContentTranslationInput | null }
  /** Orden, alt y caption de la media ya existente. Subir/borrar archivos son operaciones aparte. */
  media: {
    id: string
    alt?: string | null
    caption?: string | null
    sortOrder: number
    isHero: boolean
    inGallery: boolean
  }[]
  providers: { category: string; name: string; mediaId?: string | null }[]
  menuSections: { course: string; items: string[] }[]
  timeline: { time: string; moment: string }[]
  highlights: string[]
}

/**
 * Guarda la ficha completa en una transacción. Las colecciones sin identidad
 * propia relevante (minuta, cronología, momentos, proveedores) se reescriben:
 * son listas ordenadas que el editor envía completas, y reconciliar por id no
 * aportaría nada frente a borrar e insertar dentro de la misma transacción.
 * La media **no** se reescribe (sus filas apuntan a objetos del bucket): solo
 * se actualizan orden, alt, caption y cuál es la hero.
 */
export async function saveContentEntry(input: SaveContentEntryInput): Promise<ContentEntry> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Control de concurrencia optimista: si otra persona guardó entre la
      // carga del editor y este envío, `updatedAt` ya no coincide y no se
      // actualiza ninguna fila.
      const guard = await tx.contentEntry.updateMany({
        where: { id: input.id, updatedAt: input.expectedUpdatedAt },
        data: {
          type: input.type,
          slug: input.slug,
          isDemo: input.isDemo,
          featured: input.featured,
          sortOrder: input.sortOrder,
          seoNoindex: input.seoNoindex,
          eventDate: input.eventDate,
          season: input.season,
          space: input.space,
          decor: input.decor,
          photocall: input.photocall,
          weather: input.weather,
          restaurantSolutions: input.restaurantSolutions,
          testimonialQuote: input.testimonialQuote,
          testimonialAuthor: input.testimonialAuthor,
          priceFrom: input.priceFrom,
          priceTo: input.priceTo,
          priceCurrency: input.priceCurrency,
          priceNote: input.priceNote,
          ctaLabel: input.ctaLabel,
          ctaHref: input.ctaHref,
          updatedById: input.updatedById,
        },
      })
      if (guard.count === 0) {
        throw new ConcurrentUpdateError()
      }

      await tx.contentTranslation.upsert({
        where: { contentEntryId_locale: { contentEntryId: input.id, locale: "ES" } },
        create: { contentEntryId: input.id, locale: "ES", ...toTranslationData(input.translations.es) },
        update: toTranslationData(input.translations.es),
      })

      if (input.translations.en) {
        await tx.contentTranslation.upsert({
          where: { contentEntryId_locale: { contentEntryId: input.id, locale: "EN" } },
          create: { contentEntryId: input.id, locale: "EN", ...toTranslationData(input.translations.en) },
          update: toTranslationData(input.translations.en),
        })
      } else {
        // Quitar la traducción inglesa es una acción legítima; la española no
        // se puede borrar nunca (no hay rama que lo permita).
        await tx.contentTranslation.deleteMany({ where: { contentEntryId: input.id, locale: "EN" } })
      }

      for (const media of input.media) {
        await tx.contentMedia.updateMany({
          // `contentEntryId` en el where impide que un id de media ajeno,
          // enviado desde el cliente, modifique la media de otra ficha.
          where: { id: media.id, contentEntryId: input.id },
          data: {
            alt: media.alt,
            caption: media.caption,
            sortOrder: media.sortOrder,
            isHero: media.isHero,
            inGallery: media.inGallery,
          },
        })
      }

      await tx.contentProvider.deleteMany({ where: { contentEntryId: input.id } })
      const validMediaIds = new Set(input.media.map((media) => media.id))
      for (const [index, provider] of input.providers.entries()) {
        await tx.contentProvider.create({
          data: {
            contentEntryId: input.id,
            category: provider.category,
            name: provider.name,
            sortOrder: index,
            mediaId: provider.mediaId && validMediaIds.has(provider.mediaId) ? provider.mediaId : null,
          },
        })
      }

      await tx.contentMenuSection.deleteMany({ where: { contentEntryId: input.id } })
      for (const [index, section] of input.menuSections.entries()) {
        await tx.contentMenuSection.create({
          data: {
            contentEntryId: input.id,
            course: section.course,
            sortOrder: index,
            items: { create: section.items.map((label, itemIndex) => ({ label, sortOrder: itemIndex })) },
          },
        })
      }

      await tx.contentTimelineItem.deleteMany({ where: { contentEntryId: input.id } })
      if (input.timeline.length) {
        await tx.contentTimelineItem.createMany({
          data: input.timeline.map((item, index) => ({ ...item, sortOrder: index, contentEntryId: input.id })),
        })
      }

      await tx.contentHighlight.deleteMany({ where: { contentEntryId: input.id } })
      if (input.highlights.length) {
        await tx.contentHighlight.createMany({
          data: input.highlights.map((label, index) => ({ label, sortOrder: index, contentEntryId: input.id })),
        })
      }

      await tx.auditEvent.create({
        data: {
          entityType: "ContentEntry",
          entityId: input.id,
          action: "content.update",
          actorId: input.updatedById,
          metadata: {
            type: input.type,
            slug: input.slug,
            mediaCount: input.media.length,
            providerCount: input.providers.length,
            menuSectionCount: input.menuSections.length,
          },
        },
      })

      return tx.contentEntry.findUniqueOrThrow({ where: { id: input.id } })
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateSlugError(input.type, input.slug)
    }
    throw error
  }
}

/**
 * Copia una ficha como borrador nuevo. Las filas de `ContentMedia` se
 * duplican **reutilizando el mismo `storagePath`**: no se copia el objeto del
 * bucket. Por eso `deleteContentMedia` comprueba si un objeto sigue
 * referenciado antes de borrarlo (ver lib/domain/content-media.ts).
 */
export async function duplicateContentEntryAsDraft(id: string, actorId?: string): Promise<ContentEntry> {
  const source = await prisma.contentEntry.findUniqueOrThrow({ where: { id }, include: FULL_ENTRY_INCLUDE })
  const slug = await findAvailableSlug(source.type, source.slug)

  return prisma.$transaction(async (tx) => {
    const copy = await tx.contentEntry.create({
      data: {
        type: source.type,
        slug,
        status: "DRAFT",
        isDemo: source.isDemo,
        featured: false,
        sortOrder: source.sortOrder,
        seoNoindex: source.seoNoindex,
        eventDate: source.eventDate,
        season: source.season,
        space: source.space,
        decor: source.decor,
        photocall: source.photocall,
        weather: source.weather,
        restaurantSolutions: source.restaurantSolutions,
        testimonialQuote: source.testimonialQuote,
        testimonialAuthor: source.testimonialAuthor,
        priceFrom: source.priceFrom,
        priceTo: source.priceTo,
        priceCurrency: source.priceCurrency,
        priceNote: source.priceNote,
        ctaLabel: source.ctaLabel,
        ctaHref: source.ctaHref,
        createdById: actorId,
        updatedById: actorId,
        translations: {
          create: source.translations.map((translation) => ({
            locale: translation.locale,
            title: translation.title,
            subtitle: translation.subtitle,
            intro: translation.intro,
            seoTitle: translation.seoTitle,
            seoDescription: translation.seoDescription,
          })),
        },
      },
    })

    const mediaIdMap = new Map<string, string>()
    for (const media of source.media) {
      const created = await tx.contentMedia.create({
        data: {
          contentEntryId: copy.id,
          type: media.type,
          storagePath: media.storagePath,
          url: media.url,
          thumbnailUrl: media.thumbnailUrl,
          alt: media.alt,
          caption: media.caption,
          sortOrder: media.sortOrder,
          isHero: media.isHero,
          inGallery: media.inGallery,
          mimeType: media.mimeType,
          sizeBytes: media.sizeBytes,
          width: media.width,
          height: media.height,
        },
      })
      mediaIdMap.set(media.id, created.id)
    }

    for (const provider of source.providers) {
      await tx.contentProvider.create({
        data: {
          contentEntryId: copy.id,
          category: provider.category,
          name: provider.name,
          sortOrder: provider.sortOrder,
          mediaId: provider.mediaId ? mediaIdMap.get(provider.mediaId) : null,
        },
      })
    }

    for (const section of source.menuSections) {
      await tx.contentMenuSection.create({
        data: {
          contentEntryId: copy.id,
          course: section.course,
          sortOrder: section.sortOrder,
          items: { create: section.items.map((item) => ({ label: item.label, sortOrder: item.sortOrder })) },
        },
      })
    }

    if (source.timeline.length) {
      await tx.contentTimelineItem.createMany({
        data: source.timeline.map((item) => ({
          contentEntryId: copy.id,
          time: item.time,
          moment: item.moment,
          sortOrder: item.sortOrder,
        })),
      })
    }

    if (source.highlights.length) {
      await tx.contentHighlight.createMany({
        data: source.highlights.map((item) => ({
          contentEntryId: copy.id,
          label: item.label,
          sortOrder: item.sortOrder,
        })),
      })
    }

    await tx.auditEvent.create({
      data: {
        entityType: "ContentEntry",
        entityId: copy.id,
        action: "content.duplicate",
        actorId,
        metadata: { type: copy.type, slug: copy.slug, sourceId: source.id, sourceSlug: source.slug },
      },
    })

    return copy
  })
}

/** Busca el primer `slug-copia-N` libre para el tipo indicado. */
async function findAvailableSlug(type: ContentType, baseSlug: string): Promise<string> {
  const existing = await prisma.contentEntry.findMany({
    where: { type, slug: { startsWith: `${baseSlug}-copia` } },
    select: { slug: true },
  })
  const taken = new Set(existing.map((entry) => entry.slug))

  let candidate = `${baseSlug}-copia`
  let counter = 2
  while (taken.has(candidate)) {
    candidate = `${baseSlug}-copia-${counter}`
    counter += 1
  }
  return candidate
}

/** Comprueba en servidor si un slug está libre para ese tipo (validación del editor). */
export async function isSlugAvailable(type: ContentType, slug: string, excludeId?: string): Promise<boolean> {
  const existing = await prisma.contentEntry.findUnique({
    where: { type_slug: { type, slug } },
    select: { id: true },
  })
  return !existing || existing.id === excludeId
}
