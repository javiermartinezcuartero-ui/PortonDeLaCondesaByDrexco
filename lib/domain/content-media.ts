import "server-only"

import type { ContentMedia, MediaType } from "@prisma/client"
import { prisma } from "@/lib/db"
import { recordAuditEvent } from "@/lib/domain/audit"
import { DomainError } from "@/lib/domain/errors"
import { getStorageClient, isStorageConfigured, VIP_CONTENT_BUCKET } from "@/lib/storage/supabase"
import { buildStorageObjectPath } from "@/lib/storage/object-name"
import { validateImage, type ImageCandidate } from "@/lib/storage/validate-image"
import { validateVideoUrl, validateExternalUrl } from "@/lib/storage/external-url"

/** Validez de las URLs firmadas que se devuelven al panel de administración. */
export const SIGNED_URL_TTL_SECONDS = 60 * 10

/**
 * Validez de las URLs firmadas de las páginas públicas. Es más larga que la
 * del panel a propósito: `next/image` cachea la imagen optimizada por URL
 * completa, así que rotar la firma cada pocos minutos obligaría a volver a
 * optimizar la misma foto constantemente. Una hora limita ese trabajo sin que
 * un enlace filtrado quede utilizable indefinidamente.
 */
export const PUBLIC_SIGNED_URL_TTL_SECONDS = 60 * 60

export class StorageOperationError extends DomainError {
  constructor(message: string) {
    super(message)
    this.name = "StorageOperationError"
  }
}

export class MediaStillReferencedError extends DomainError {
  constructor(storagePath: string, references: number) {
    super(
      `El objeto "${storagePath}" sigue referenciado por ${references} ficha(s) más; no se borra del bucket.`
    )
    this.name = "MediaStillReferencedError"
  }
}

// ---------------------------------------------------------------------------
// Subida de imágenes
// ---------------------------------------------------------------------------

export type UploadContentImageInput = {
  contentEntryId: string
  file: ImageCandidate
  alt?: string
  caption?: string
  isHero?: boolean
  actorId?: string
}

/**
 * Valida los bytes reales, sube el objeto al bucket privado con un nombre
 * generado en servidor y crea la fila `ContentMedia`. Si la escritura en base
 * de datos falla después de subir, el objeto se elimina del bucket para no
 * dejar huérfanos.
 */
export async function uploadContentImage(input: UploadContentImageInput): Promise<ContentMedia> {
  const validated = validateImage(input.file)
  const storagePath = buildStorageObjectPath(input.contentEntryId, validated.extension)

  const storage = getStorageClient()
  const { error: uploadError } = await storage.storage.from(VIP_CONTENT_BUCKET).upload(storagePath, input.file.bytes, {
    contentType: validated.mimeType,
    // Nunca sobrescribir: el nombre es aleatorio, así que un conflicto
    // indicaría un problema real, no una re-subida legítima.
    upsert: false,
  })
  if (uploadError) {
    throw new StorageOperationError(`No se ha podido subir el archivo: ${uploadError.message}`)
  }

  try {
    const nextSortOrder = await getNextSortOrder(input.contentEntryId)
    const media = await prisma.contentMedia.create({
      data: {
        contentEntryId: input.contentEntryId,
        type: "IMAGE",
        storagePath,
        alt: input.alt,
        caption: input.caption,
        isHero: input.isHero ?? false,
        sortOrder: nextSortOrder,
        mimeType: validated.mimeType,
        sizeBytes: validated.sizeBytes,
        width: validated.width,
        height: validated.height,
      },
    })

    await recordAuditEvent({
      entityType: "ContentMedia",
      entityId: media.id,
      action: "media.upload",
      actorId: input.actorId,
      // Se registran metadatos técnicos, nunca el archivo ni una URL firmada.
      metadata: {
        contentEntryId: input.contentEntryId,
        mimeType: validated.mimeType,
        sizeBytes: validated.sizeBytes,
        width: validated.width,
        height: validated.height,
      },
    })

    return media
  } catch (error) {
    await storage.storage
      .from(VIP_CONTENT_BUCKET)
      .remove([storagePath])
      .catch(() => undefined)
    throw error
  }
}

async function getNextSortOrder(contentEntryId: string): Promise<number> {
  const last = await prisma.contentMedia.findFirst({
    where: { contentEntryId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  })
  return (last?.sortOrder ?? -1) + 1
}

// ---------------------------------------------------------------------------
// Media externa (vídeos / Reels)
// ---------------------------------------------------------------------------

export type AddExternalMediaInput = {
  contentEntryId: string
  type: Extract<MediaType, "EXTERNAL_VIDEO" | "REEL">
  url: string
  /** Miniatura: obligatoria, porque un vídeo externo sin miniatura no se puede mostrar en la galería. */
  thumbnailUrl: string
  alt?: string
  caption?: string
  actorId?: string
}

export async function addExternalMedia(input: AddExternalMediaInput): Promise<ContentMedia> {
  const url = validateVideoUrl(input.url)
  // La miniatura no tiene por qué estar en un host de vídeo (puede ser un CDN
  // de imagen), pero sí debe pasar el mismo filtro anti-SSRF/anti-XSS.
  const thumbnailUrl = validateExternalUrl(input.thumbnailUrl)

  const media = await prisma.contentMedia.create({
    data: {
      contentEntryId: input.contentEntryId,
      type: input.type,
      url,
      thumbnailUrl,
      alt: input.alt,
      caption: input.caption,
      sortOrder: await getNextSortOrder(input.contentEntryId),
    },
  })

  await recordAuditEvent({
    entityType: "ContentMedia",
    entityId: media.id,
    action: "media.upload",
    actorId: input.actorId,
    metadata: { contentEntryId: input.contentEntryId, kind: input.type, host: new URL(url).hostname },
  })

  return media
}

// ---------------------------------------------------------------------------
// Borrado
// ---------------------------------------------------------------------------

/**
 * Borra una fila `ContentMedia` y, solo si ningún otro registro apunta al
 * mismo objeto, también el objeto del bucket (vía Storage API, nunca SQL).
 * Escenario real de objeto compartido: "duplicar como borrador" copia las
 * filas de media reutilizando el mismo `storagePath`.
 */
export async function deleteContentMedia(mediaId: string, actorId?: string): Promise<{ contentEntryId: string }> {
  const media = await prisma.contentMedia.findUniqueOrThrow({ where: { id: mediaId } })

  let removedObject = false
  if (media.storagePath) {
    const otherReferences = await prisma.contentMedia.count({
      where: { storagePath: media.storagePath, id: { not: mediaId } },
    })

    if (otherReferences === 0) {
      if (!isStorageConfigured()) {
        throw new StorageOperationError(
          "Supabase Storage no está configurado: no se puede borrar el objeto, así que tampoco se borra su registro."
        )
      }
      const { error } = await getStorageClient()
        .storage.from(VIP_CONTENT_BUCKET)
        .remove([media.storagePath])
      if (error) {
        // Se aborta antes de tocar la base de datos: es preferible una fila
        // con su objeto a una fila borrada y un objeto huérfano en el bucket.
        throw new StorageOperationError(`No se ha podido borrar el objeto del bucket: ${error.message}`)
      }
      removedObject = true
    }
  }

  await prisma.contentMedia.delete({ where: { id: mediaId } })

  await recordAuditEvent({
    entityType: "ContentMedia",
    entityId: mediaId,
    action: "media.delete",
    actorId,
    metadata: {
      contentEntryId: media.contentEntryId,
      // Si el objeto se conservó, quedó referenciado por otra ficha.
      objectRemovedFromBucket: removedObject,
      hadStorageObject: Boolean(media.storagePath),
    },
  })

  return { contentEntryId: media.contentEntryId }
}

// ---------------------------------------------------------------------------
// URLs firmadas
// ---------------------------------------------------------------------------

/**
 * Convierte una lista de media en URLs mostrables. Los objetos del bucket
 * privado se firman temporalmente en servidor; la media externa devuelve su
 * URL ya validada. Las URLs firmadas nunca se registran en auditoría.
 */
export async function resolveMediaUrls<T extends { storagePath: string | null; url: string | null }>(
  mediaList: readonly T[],
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS
): Promise<Map<T, string | null>> {
  const resolved = new Map<T, string | null>()
  const toSign = mediaList.filter((media) => media.storagePath)

  if (toSign.length && isStorageConfigured()) {
    // Una sola llamada para toda la lista: firmar es I/O y no hay motivo para
    // hacer una petición por archivo.
    const paths = toSign.map((media) => media.storagePath as string)
    const { data } = await getStorageClient()
      .storage.from(VIP_CONTENT_BUCKET)
      .createSignedUrls(paths, ttlSeconds)

    const byPath = new Map((data ?? []).map((item) => [item.path, item.signedUrl]))
    for (const media of toSign) {
      resolved.set(media, byPath.get(media.storagePath as string) ?? null)
    }
  }

  for (const media of mediaList) {
    if (!resolved.has(media)) {
      resolved.set(media, media.url ?? null)
    }
  }

  return resolved
}
