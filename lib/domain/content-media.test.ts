import { afterEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { createContentEntry } from "@/lib/domain/content"
import {
  addExternalMedia,
  deleteContentMedia,
  resolveMediaUrls,
  uploadContentImage,
} from "@/lib/domain/content-media"
import { InvalidExternalUrlError } from "@/lib/storage/external-url"
import { InvalidImageError } from "@/lib/storage/validate-image"
import { getStorageClient, isStorageConfigured, VIP_CONTENT_BUCKET } from "@/lib/storage/supabase"
import { itDb, uniqueSlug } from "@/lib/domain/test-helpers"

/** Tests que necesitan además Supabase Storage configurado. */
const itStorage = isStorageConfigured() && process.env.DATABASE_URL ? it : it.skip

const createdIds: string[] = []
const uploadedPaths: string[] = []

afterEach(async () => {
  if (createdIds.length) {
    await prisma.contentEntry.deleteMany({ where: { id: { in: createdIds } } })
    createdIds.length = 0
  }
  // Red de seguridad: si un test falla a medias, no deja objetos en el bucket.
  if (uploadedPaths.length && isStorageConfigured()) {
    await getStorageClient()
      .storage.from(VIP_CONTENT_BUCKET)
      .remove([...uploadedPaths])
      .catch(() => undefined)
    uploadedPaths.length = 0
  }
})

async function createEntry() {
  const entry = await createContentEntry({
    type: "REAL_WEDDING",
    slug: uniqueSlug("media"),
    translations: { es: { title: "Ficha de media" } },
  })
  createdIds.push(entry.id)
  return entry
}

/** PNG mínimo válido de 1200×800 (solo cabecera IHDR; suficiente y real). */
function pngBytes(): Uint8Array {
  const bytes = new Uint8Array(128)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  const view = new DataView(bytes.buffer)
  view.setUint32(16, 1200)
  view.setUint32(20, 800)
  return bytes
}

describe("uploadContentImage", () => {
  itDb("rechaza el archivo antes de tocar Storage si no pasa la validación", async () => {
    const entry = await createEntry()

    await expect(
      uploadContentImage({
        contentEntryId: entry.id,
        file: { bytes: new Uint8Array([1, 2, 3, 4]), declaredMimeType: "image/png", declaredFileName: "x.png" },
      })
    ).rejects.toBeInstanceOf(InvalidImageError)

    // Ninguna fila creada: la validación ocurre antes de la subida.
    expect(await prisma.contentMedia.count({ where: { contentEntryId: entry.id } })).toBe(0)
  })

  itStorage("sube la imagen con un nombre generado en servidor y guarda sus metadatos reales", async () => {
    const entry = await createEntry()

    const media = await uploadContentImage({
      contentEntryId: entry.id,
      alt: "Alt de prueba",
      file: { bytes: pngBytes(), declaredMimeType: "image/png", declaredFileName: "MI foto ORIGINAL.png" },
    })
    if (media.storagePath) uploadedPaths.push(media.storagePath)

    expect(media.mimeType).toBe("image/png")
    expect(media.width).toBe(1200)
    expect(media.height).toBe(800)
    expect(media.alt).toBe("Alt de prueba")

    // El nombre del objeto no contiene el nombre aportado por el usuario.
    expect(media.storagePath).toMatch(new RegExp(`^${entry.id}/[0-9a-f-]{36}\\.png$`))
    expect(media.storagePath).not.toContain("ORIGINAL")

    // El objeto existe de verdad en el bucket.
    const { data } = await getStorageClient()
      .storage.from(VIP_CONTENT_BUCKET)
      .list(entry.id)
    expect(data?.some((item) => media.storagePath?.endsWith(item.name))).toBe(true)
  })

  itStorage("registra un AuditEvent media.upload con metadatos técnicos, sin el archivo", async () => {
    const entry = await createEntry()
    const media = await uploadContentImage({
      contentEntryId: entry.id,
      file: { bytes: pngBytes(), declaredMimeType: "image/png", declaredFileName: "foto.png" },
    })
    if (media.storagePath) uploadedPaths.push(media.storagePath)

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityType: "ContentMedia", entityId: media.id, action: "media.upload" },
    })
    expect(audit.metadata).toMatchObject({ contentEntryId: entry.id, mimeType: "image/png", width: 1200 })
    // Nunca la ruta del objeto ni una URL firmada.
    expect(JSON.stringify(audit.metadata)).not.toContain(media.storagePath ?? "___")
  })

  itStorage("asigna sortOrder incremental a cada archivo nuevo", async () => {
    const entry = await createEntry()

    const first = await uploadContentImage({
      contentEntryId: entry.id,
      file: { bytes: pngBytes(), declaredMimeType: "image/png", declaredFileName: "a.png" },
    })
    const second = await uploadContentImage({
      contentEntryId: entry.id,
      file: { bytes: pngBytes(), declaredMimeType: "image/png", declaredFileName: "b.png" },
    })
    for (const media of [first, second]) if (media.storagePath) uploadedPaths.push(media.storagePath)

    expect(first.sortOrder).toBe(0)
    expect(second.sortOrder).toBe(1)
  })
})

describe("addExternalMedia", () => {
  itDb("acepta un vídeo de un host permitido con su miniatura", async () => {
    const entry = await createEntry()

    const media = await addExternalMedia({
      contentEntryId: entry.id,
      type: "EXTERNAL_VIDEO",
      url: "https://youtu.be/abc123",
      thumbnailUrl: "https://cdn.example.com/thumb.jpg",
      alt: "Vídeo de agradecimiento",
    })

    expect(media.type).toBe("EXTERNAL_VIDEO")
    expect(media.url).toContain("youtu.be")
    expect(media.thumbnailUrl).toContain("cdn.example.com")
    // Es media externa: no ocupa nada en el bucket.
    expect(media.storagePath).toBeNull()
  })

  itDb("rechaza una URL que apunta a una dirección interna (SSRF) sin crear la fila", async () => {
    const entry = await createEntry()

    await expect(
      addExternalMedia({
        contentEntryId: entry.id,
        type: "EXTERNAL_VIDEO",
        url: "https://169.254.169.254/latest/meta-data/",
        thumbnailUrl: "https://cdn.example.com/thumb.jpg",
      })
    ).rejects.toBeInstanceOf(InvalidExternalUrlError)

    expect(await prisma.contentMedia.count({ where: { contentEntryId: entry.id } })).toBe(0)
  })

  itDb("rechaza una miniatura con esquema no seguro", async () => {
    const entry = await createEntry()

    await expect(
      addExternalMedia({
        contentEntryId: entry.id,
        type: "REEL",
        url: "https://www.instagram.com/reel/abc/",
        thumbnailUrl: "javascript:alert(1)",
      })
    ).rejects.toBeInstanceOf(InvalidExternalUrlError)
  })
})

describe("deleteContentMedia — objeto compartido", () => {
  itDb("no borra del bucket un objeto todavía referenciado por otra ficha", async () => {
    const sharedPath = `compartido/${uniqueSlug("objeto")}.jpg`

    const first = await createContentEntry({
      type: "REAL_WEDDING",
      slug: uniqueSlug("comparte-a"),
      translations: { es: { title: "Comparte A" } },
      media: [{ type: "IMAGE", storagePath: sharedPath, alt: "Compartida" }],
    })
    const second = await createContentEntry({
      type: "REAL_WEDDING",
      slug: uniqueSlug("comparte-b"),
      translations: { es: { title: "Comparte B" } },
      media: [{ type: "IMAGE", storagePath: sharedPath, alt: "Compartida" }],
    })
    createdIds.push(first.id, second.id)

    const firstMedia = await prisma.contentMedia.findFirstOrThrow({ where: { contentEntryId: first.id } })
    await deleteContentMedia(firstMedia.id)

    // La fila desaparece...
    expect(await prisma.contentMedia.count({ where: { id: firstMedia.id } })).toBe(0)
    // ...pero la de la otra ficha sigue apuntando al objeto.
    expect(await prisma.contentMedia.count({ where: { storagePath: sharedPath } })).toBe(1)

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityId: firstMedia.id, action: "media.delete" },
    })
    expect(audit.metadata).toMatchObject({ objectRemovedFromBucket: false })
  })

  itDb("devuelve la ficha a la que pertenecía la media borrada", async () => {
    const entry = await createContentEntry({
      type: "REAL_WEDDING",
      slug: uniqueSlug("externa-borrada"),
      translations: { es: { title: "Externa" } },
      // Media externa: no toca el bucket, así que se puede borrar sin Storage.
      media: [{ type: "EXTERNAL_VIDEO", url: "https://youtu.be/abc123", alt: "Vídeo" }],
    })
    createdIds.push(entry.id)

    const media = await prisma.contentMedia.findFirstOrThrow({ where: { contentEntryId: entry.id } })
    const result = await deleteContentMedia(media.id)
    expect(result.contentEntryId).toBe(entry.id)
  })

  itStorage("borra el objeto del bucket cuando ya no queda ninguna referencia", async () => {
    const entry = await createEntry()
    const media = await uploadContentImage({
      contentEntryId: entry.id,
      file: { bytes: pngBytes(), declaredMimeType: "image/png", declaredFileName: "borrar.png" },
    })
    const storagePath = media.storagePath as string

    await deleteContentMedia(media.id)

    const { data } = await getStorageClient().storage.from(VIP_CONTENT_BUCKET).list(entry.id)
    expect(data?.some((item) => storagePath.endsWith(item.name))).toBe(false)

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityId: media.id, action: "media.delete" },
    })
    expect(audit.metadata).toMatchObject({ objectRemovedFromBucket: true })
  })
})

describe("resolveMediaUrls", () => {
  itDb("devuelve la URL externa tal cual para media que no está en el bucket", async () => {
    const mediaList = [{ storagePath: null, url: "https://youtu.be/abc123" }]
    const resolved = await resolveMediaUrls(mediaList)
    expect(resolved.get(mediaList[0])).toBe("https://youtu.be/abc123")
  })

  itStorage("firma temporalmente los objetos del bucket privado", async () => {
    const entry = await createEntry()
    const media = await uploadContentImage({
      contentEntryId: entry.id,
      file: { bytes: pngBytes(), declaredMimeType: "image/png", declaredFileName: "firmar.png" },
    })
    if (media.storagePath) uploadedPaths.push(media.storagePath)

    const resolved = await resolveMediaUrls([media])
    const signedUrl = resolved.get(media)

    expect(signedUrl).toBeTruthy()
    // Una URL firmada de Supabase incluye el token de firma como query param.
    expect(signedUrl).toContain("token=")
    expect(signedUrl).toContain(VIP_CONTENT_BUCKET)
  })
})
