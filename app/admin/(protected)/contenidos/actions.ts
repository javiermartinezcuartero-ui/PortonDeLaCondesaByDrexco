"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { ContentType } from "@prisma/client"
import { ForbiddenError, UnauthenticatedError, requirePermission } from "@/lib/auth/session"
import {
  archiveContentEntry,
  createContentEntry,
  duplicateContentEntryAsDraft,
  isSlugAvailable,
  publishContentEntry,
  saveContentEntry,
  unpublishContentEntry,
} from "@/lib/domain/content"
import { addExternalMedia, deleteContentMedia, uploadContentImage } from "@/lib/domain/content-media"
import { DomainError } from "@/lib/domain/errors"
import { InvalidImageError, MAX_IMAGE_BYTES } from "@/lib/storage/validate-image"
import { InvalidExternalUrlError } from "@/lib/storage/external-url"
import {
  createContentEntrySchema,
  externalMediaSchema,
  saveContentEntrySchema,
  validateSaveConsistency,
} from "@/lib/validation/content"

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] }

/**
 * Rutas públicas afectadas por una ficha. Se revalidan tras publicar,
 * despublicar y archivar. Las rutas públicas todavía leen `data/vip-stories.ts`
 * (ver README §11), así que hoy esto solo purga la caché; queda conectado ya
 * para que al migrarlas no haya que recordar añadirlo.
 */
function publicPathsFor(type: ContentType, slug: string): string[] {
  const base = type === "REAL_WEDDING" ? "/bodas-reales" : "/catering"
  return [base, `${base}/${slug}`]
}

function revalidatePublicPaths(type: ContentType, slug: string): void {
  for (const path of publicPathsFor(type, slug)) {
    revalidatePath(path)
  }
}

/** Traduce los errores conocidos a mensajes para la UI; el resto se propaga. */
function toActionErrors(error: unknown): string[] {
  if (error instanceof UnauthenticatedError) return ["Tu sesión ha caducado. Vuelve a iniciar sesión."]
  if (error instanceof ForbiddenError) return ["No tienes permisos para esta operación."]
  if (error instanceof InvalidImageError) return [error.message]
  if (error instanceof InvalidExternalUrlError) return [error.message]
  if (error instanceof DomainError) return [error.message]
  throw error
}

async function requireContentAccess() {
  // CONTENT y ADMIN. SALES no gestiona contenido (ver docs/autenticacion.md §3).
  return requirePermission("cms:access")
}

// ---------------------------------------------------------------------------
// Ciclo de vida de la ficha
// ---------------------------------------------------------------------------

export async function createContentEntryAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  let id: string
  try {
    const user = await requireContentAccess()
    const parsed = createContentEntrySchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, errors: parsed.error.issues.map((issue) => issue.message) }
    }

    const { type, slug, title } = parsed.data
    if (!(await isSlugAvailable(type, slug))) {
      return { ok: false, errors: [`Ya existe una ficha de este tipo con el slug "${slug}".`] }
    }

    // Toda ficha nueva nace como DRAFT (por defecto del esquema).
    const entry = await createContentEntry({
      type,
      slug,
      createdById: user.id,
      translations: { es: { title } },
    })
    id = entry.id
  } catch (error) {
    return { ok: false, errors: toActionErrors(error) }
  }

  // `redirect` lanza internamente en Next: debe quedar fuera del try/catch.
  redirect(`/admin/contenidos/${id}`)
}

export async function saveContentEntryAction(input: unknown): Promise<ActionResult<{ updatedAt: string }>> {
  try {
    const user = await requireContentAccess()
    const parsed = saveContentEntrySchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) }
    }

    const consistencyErrors = validateSaveConsistency(parsed.data)
    if (consistencyErrors.length) {
      return { ok: false, errors: consistencyErrors }
    }

    const values = parsed.data
    if (!(await isSlugAvailable(values.type, values.slug, values.id))) {
      return { ok: false, errors: [`Ya existe otra ficha de este tipo con el slug "${values.slug}".`] }
    }

    const english = values.translations.en
    const saved = await saveContentEntry({
      ...values,
      expectedUpdatedAt: new Date(values.expectedUpdatedAt),
      updatedById: user.id,
      translations: {
        es: values.translations.es,
        // Sin título en inglés no hay traducción inglesa que guardar
        // (el esquema ya rechaza "con contenido pero sin título").
        en: english?.title ? { ...english, title: english.title } : null,
      },
      media: values.media,
      providers: values.providers,
      menuSections: values.menuSections,
      timeline: values.timeline,
      highlights: values.highlights,
    })

    revalidatePath(`/admin/contenidos/${values.id}`)
    // Guardar puede cambiar el contenido de una ficha ya publicada.
    if (saved.status === "PUBLISHED") {
      revalidatePublicPaths(saved.type, saved.slug)
    }

    return { ok: true, data: { updatedAt: saved.updatedAt.toISOString() } }
  } catch (error) {
    return { ok: false, errors: toActionErrors(error) }
  }
}

export async function publishContentEntryAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireContentAccess()
    const entry = await publishContentEntry(id, user.id)
    revalidatePath("/admin/contenidos")
    revalidatePath(`/admin/contenidos/${id}`)
    revalidatePublicPaths(entry.type, entry.slug)
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, errors: toActionErrors(error) }
  }
}

export async function unpublishContentEntryAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireContentAccess()
    const entry = await unpublishContentEntry(id, user.id)
    revalidatePath("/admin/contenidos")
    revalidatePath(`/admin/contenidos/${id}`)
    revalidatePublicPaths(entry.type, entry.slug)
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, errors: toActionErrors(error) }
  }
}

export async function archiveContentEntryAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireContentAccess()
    const entry = await archiveContentEntry(id, user.id)
    revalidatePath("/admin/contenidos")
    revalidatePath(`/admin/contenidos/${id}`)
    revalidatePublicPaths(entry.type, entry.slug)
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, errors: toActionErrors(error) }
  }
}

export async function duplicateContentEntryAction(id: string): Promise<ActionResult<{ id: string }>> {
  let newId: string
  try {
    const user = await requireContentAccess()
    const copy = await duplicateContentEntryAsDraft(id, user.id)
    newId = copy.id
    revalidatePath("/admin/contenidos")
  } catch (error) {
    return { ok: false, errors: toActionErrors(error) }
  }

  redirect(`/admin/contenidos/${newId}`)
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export async function uploadContentImageAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireContentAccess()

    const contentEntryId = formData.get("contentEntryId")
    const file = formData.get("file")
    if (typeof contentEntryId !== "string" || !contentEntryId) {
      return { ok: false, errors: ["Falta la ficha de destino."] }
    }
    if (!(file instanceof File)) {
      return { ok: false, errors: ["No se ha recibido ningún archivo."] }
    }
    // Corte temprano por tamaño antes de leer el archivo completo en memoria.
    if (file.size > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        errors: [`El archivo supera el máximo de ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB por imagen.`],
      }
    }

    const alt = formData.get("alt")
    const media = await uploadContentImage({
      contentEntryId,
      actorId: user.id,
      alt: typeof alt === "string" && alt.trim() ? alt.trim() : undefined,
      file: {
        bytes: new Uint8Array(await file.arrayBuffer()),
        declaredMimeType: file.type,
        declaredFileName: file.name,
      },
    })

    revalidatePath(`/admin/contenidos/${contentEntryId}`)
    return { ok: true, data: { id: media.id } }
  } catch (error) {
    return { ok: false, errors: toActionErrors(error) }
  }
}

export async function addExternalMediaAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireContentAccess()
    const parsed = externalMediaSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, errors: parsed.error.issues.map((issue) => issue.message) }
    }

    const media = await addExternalMedia({ ...parsed.data, actorId: user.id })
    revalidatePath(`/admin/contenidos/${parsed.data.contentEntryId}`)
    return { ok: true, data: { id: media.id } }
  } catch (error) {
    return { ok: false, errors: toActionErrors(error) }
  }
}

export async function deleteContentMediaAction(mediaId: string): Promise<ActionResult> {
  try {
    const user = await requireContentAccess()
    // La ficha a revalidar se deriva de la propia media, no de un parámetro
    // del cliente que podría no corresponder.
    const { contentEntryId } = await deleteContentMedia(mediaId, user.id)
    revalidatePath(`/admin/contenidos/${contentEntryId}`)
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, errors: toActionErrors(error) }
  }
}
