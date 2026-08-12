import { afterEach, beforeEach, describe, expect, vi } from "vitest"
import { prisma } from "@/lib/db"
import { createAuthTestUser, signInHeaders } from "@/lib/auth/test-helpers"
import { createContentEntry } from "@/lib/domain/content"
import { itDb, uniqueSlug } from "@/lib/domain/test-helpers"

// Las Server Actions llaman a `requirePermission` sin headers, así que usan
// `headers()` de next/headers (el camino real dentro de una Server Action).
// Fuera del runtime de Next no hay scope de petición: se simula aquí.
let currentHeaders = new Headers()
vi.mock("next/headers", () => ({ headers: async () => currentHeaders }))

// `revalidatePath` solo funciona dentro del scope de renderizado de Next. Se
// espía para poder comprobar QUÉ rutas se revalidan (requisito de la fase),
// que es justo lo que interesa verificar aquí.
const revalidatePath = vi.fn()
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => revalidatePath(path) }))

// `redirect` lanza en Next para cortar la ejecución; se replica ese contrato
// para poder distinguir "redirigió" de "devolvió errores".
class RedirectError extends Error {
  constructor(readonly to: string) {
    super(`NEXT_REDIRECT:${to}`)
  }
}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectError(to)
  },
}))

// Import estático: Vitest eleva las llamadas a `vi.mock` por encima de los
// imports, así que las acciones ya reciben los módulos simulados de arriba.
import {
  archiveContentEntryAction,
  createContentEntryAction,
  duplicateContentEntryAction,
  publishContentEntryAction,
  saveContentEntryAction,
  unpublishContentEntryAction,
  uploadContentImageAction,
} from "./actions"

const createdEntryIds: string[] = []
const createdUserIds: string[] = []

beforeEach(() => {
  revalidatePath.mockClear()
})

afterEach(async () => {
  currentHeaders = new Headers()
  if (createdEntryIds.length) {
    await prisma.contentEntry.deleteMany({ where: { id: { in: createdEntryIds } } })
    createdEntryIds.length = 0
  }
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
    createdUserIds.length = 0
  }
})

async function signInAs(role: "ADMIN" | "SALES" | "CONTENT") {
  const user = await createAuthTestUser(role)
  createdUserIds.push(user.id)
  currentHeaders = await signInHeaders(user.email)
  return user
}

async function createPublishableEntry() {
  const entry = await createContentEntry({
    type: "REAL_WEDDING",
    slug: uniqueSlug("action"),
    translations: { es: { title: "Ficha de acciones" } },
    media: [{ type: "IMAGE", url: "/images/porton/01-boda-civil-jardin.jpg", alt: "Hero", isHero: true }],
  })
  createdEntryIds.push(entry.id)
  return entry
}

/** Ejecuta una acción que redirige en caso de éxito. */
async function runExpectingRedirect(operation: () => Promise<unknown>): Promise<string> {
  try {
    const result = await operation()
    throw new Error(`Se esperaba una redirección, pero devolvió: ${JSON.stringify(result)}`)
  } catch (error) {
    if (error instanceof RedirectError) return error.to
    throw error
  }
}

describe("permisos por rol", () => {
  itDb("un usuario anónimo no puede crear contenido", async () => {
    const result = await createContentEntryAction({
      type: "REAL_WEDDING",
      slug: uniqueSlug("anonimo"),
      title: "Intento anónimo",
    })
    expect(result).toMatchObject({ ok: false })
    expect(JSON.stringify(result)).toMatch(/sesión/i)
  })

  itDb("el rol SALES no puede crear contenido", async () => {
    await signInAs("SALES")
    const result = await createContentEntryAction({
      type: "REAL_WEDDING",
      slug: uniqueSlug("sales"),
      title: "Intento de SALES",
    })
    expect(result).toMatchObject({ ok: false, errors: ["No tienes permisos para esta operación."] })
  })

  itDb("el rol SALES no puede publicar ni archivar", async () => {
    const entry = await createPublishableEntry()
    await signInAs("SALES")

    expect(await publishContentEntryAction(entry.id)).toMatchObject({ ok: false })
    expect(await archiveContentEntryAction(entry.id)).toMatchObject({ ok: false })

    const unchanged = await prisma.contentEntry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(unchanged.status).toBe("DRAFT")
  })

  itDb("el rol SALES no puede subir media", async () => {
    const entry = await createPublishableEntry()
    await signInAs("SALES")

    const formData = new FormData()
    formData.set("contentEntryId", entry.id)
    formData.set("file", new File([new Uint8Array([1, 2, 3])], "x.png", { type: "image/png" }))

    expect(await uploadContentImageAction(formData)).toMatchObject({ ok: false })
  })

  itDb("el rol CONTENT sí puede crear contenido", async () => {
    await signInAs("CONTENT")
    const slug = uniqueSlug("content-role")

    const redirectedTo = await runExpectingRedirect(() =>
      createContentEntryAction({ type: "REAL_WEDDING", slug, title: "Creada por CONTENT" })
    )

    const entry = await prisma.contentEntry.findUniqueOrThrow({ where: { type_slug: { type: "REAL_WEDDING", slug } } })
    createdEntryIds.push(entry.id)

    expect(redirectedTo).toBe(`/admin/contenidos/${entry.id}`)
    // Toda ficha nueva nace como borrador.
    expect(entry.status).toBe("DRAFT")
  })

  itDb("el rol ADMIN también puede gestionar contenido", async () => {
    const entry = await createPublishableEntry()
    await signInAs("ADMIN")
    expect(await publishContentEntryAction(entry.id)).toMatchObject({ ok: true })
  })
})

describe("createContentEntryAction — validación", () => {
  itDb("rechaza un slug con formato inválido", async () => {
    await signInAs("CONTENT")
    const result = await createContentEntryAction({
      type: "REAL_WEDDING",
      slug: "Slug Con Mayúsculas",
      title: "Título",
    })
    expect(result).toMatchObject({ ok: false })
    expect(JSON.stringify(result)).toMatch(/minúsculas/i)
  })

  itDb("rechaza un slug ya usado en el mismo tipo", async () => {
    const existing = await createPublishableEntry()
    await signInAs("CONTENT")

    const result = await createContentEntryAction({
      type: "REAL_WEDDING",
      slug: existing.slug,
      title: "Duplicada",
    })
    expect(result).toMatchObject({ ok: false })
    expect(JSON.stringify(result)).toMatch(/ya existe/i)
  })

  itDb("acepta el mismo slug en el otro tipo de contenido", async () => {
    const existing = await createPublishableEntry()
    await signInAs("CONTENT")

    await runExpectingRedirect(() =>
      createContentEntryAction({ type: "CATERING_EVENT", slug: existing.slug, title: "Mismo slug, otro tipo" })
    )

    const created = await prisma.contentEntry.findUniqueOrThrow({
      where: { type_slug: { type: "CATERING_EVENT", slug: existing.slug } },
    })
    createdEntryIds.push(created.id)
    expect(created.type).toBe("CATERING_EVENT")
  })
})

describe("publicación incompleta", () => {
  itDb("no publica una ficha sin hero y explica qué falta", async () => {
    const entry = await createContentEntry({
      type: "REAL_WEDDING",
      slug: uniqueSlug("sin-hero-action"),
      translations: { es: { title: "Sin hero" } },
    })
    createdEntryIds.push(entry.id)
    await signInAs("CONTENT")

    const result = await publishContentEntryAction(entry.id)
    expect(result).toMatchObject({ ok: false })
    expect(JSON.stringify(result)).toMatch(/imagen principal/i)

    const unchanged = await prisma.contentEntry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(unchanged.status).toBe("DRAFT")
  })
})

describe("revalidación de rutas públicas", () => {
  itDb("publicar revalida el listado y la ficha de bodas reales", async () => {
    const entry = await createPublishableEntry()
    await signInAs("CONTENT")

    expect(await publishContentEntryAction(entry.id)).toMatchObject({ ok: true })

    const revalidated = revalidatePath.mock.calls.map(([path]) => path)
    expect(revalidated).toContain("/bodas-reales")
    expect(revalidated).toContain(`/bodas-reales/${entry.slug}`)
    expect(revalidated).toContain("/admin/contenidos")
  })

  itDb("despublicar también revalida las rutas públicas", async () => {
    const entry = await createPublishableEntry()
    await signInAs("CONTENT")
    await publishContentEntryAction(entry.id)
    revalidatePath.mockClear()

    expect(await unpublishContentEntryAction(entry.id)).toMatchObject({ ok: true })
    expect(revalidatePath.mock.calls.map(([path]) => path)).toContain(`/bodas-reales/${entry.slug}`)
  })

  itDb("una ficha de catering revalida /catering, no /bodas-reales", async () => {
    const entry = await createContentEntry({
      type: "CATERING_EVENT",
      slug: uniqueSlug("catering-action"),
      translations: { es: { title: "Catering" } },
      media: [{ type: "IMAGE", url: "/a.jpg", alt: "Hero", isHero: true }],
    })
    createdEntryIds.push(entry.id)
    await signInAs("CONTENT")

    await publishContentEntryAction(entry.id)

    const revalidated = revalidatePath.mock.calls.map(([path]) => path)
    expect(revalidated).toContain("/catering")
    expect(revalidated).toContain(`/catering/${entry.slug}`)
    expect(revalidated).not.toContain("/bodas-reales")
  })

  itDb("guardar una ficha ya publicada revalida su ruta pública", async () => {
    const entry = await createPublishableEntry()
    await signInAs("CONTENT")
    await publishContentEntryAction(entry.id)
    revalidatePath.mockClear()

    const current = await prisma.contentEntry.findUniqueOrThrow({ where: { id: entry.id } })
    const result = await saveContentEntryAction({
      id: entry.id,
      expectedUpdatedAt: current.updatedAt.toISOString(),
      type: "REAL_WEDDING",
      slug: entry.slug,
      isDemo: false,
      featured: false,
      sortOrder: 0,
      seoNoindex: true,
      translations: { es: { title: "Título actualizado" } },
      media: [],
      providers: [],
      menuSections: [],
      timeline: [],
      highlights: [],
    })

    expect(result).toMatchObject({ ok: true })
    expect(revalidatePath.mock.calls.map(([path]) => path)).toContain(`/bodas-reales/${entry.slug}`)
  })

  itDb("guardar un borrador no revalida ninguna ruta pública", async () => {
    const entry = await createPublishableEntry()
    await signInAs("CONTENT")

    const result = await saveContentEntryAction({
      id: entry.id,
      expectedUpdatedAt: entry.updatedAt.toISOString(),
      type: "REAL_WEDDING",
      slug: entry.slug,
      isDemo: false,
      featured: false,
      sortOrder: 0,
      seoNoindex: true,
      translations: { es: { title: "Borrador actualizado" } },
      media: [],
      providers: [],
      menuSections: [],
      timeline: [],
      highlights: [],
    })

    expect(result).toMatchObject({ ok: true })
    const revalidated = revalidatePath.mock.calls.map(([path]) => path)
    expect(revalidated).toContain(`/admin/contenidos/${entry.id}`)
    expect(revalidated).not.toContain("/bodas-reales")
  })
})

describe("saveContentEntryAction — concurrencia", () => {
  itDb("informa del conflicto si otra persona guardó antes", async () => {
    const entry = await createPublishableEntry()
    await signInAs("CONTENT")

    const payload = {
      id: entry.id,
      expectedUpdatedAt: entry.updatedAt.toISOString(),
      type: "REAL_WEDDING" as const,
      slug: entry.slug,
      isDemo: false,
      featured: false,
      sortOrder: 0,
      seoNoindex: true,
      translations: { es: { title: "Mi versión" } },
      media: [],
      providers: [],
      menuSections: [],
      timeline: [],
      highlights: [],
    }

    expect(await saveContentEntryAction(payload)).toMatchObject({ ok: true })
    // Reenviar el mismo payload equivale a guardar con un updatedAt obsoleto.
    const second = await saveContentEntryAction(payload)
    expect(second).toMatchObject({ ok: false })
    expect(JSON.stringify(second)).toMatch(/modificado esta ficha/i)
  })
})

describe("duplicateContentEntryAction", () => {
  itDb("duplica como borrador y redirige a la copia", async () => {
    const entry = await createPublishableEntry()
    await signInAs("CONTENT")
    await publishContentEntryAction(entry.id)

    const redirectedTo = await runExpectingRedirect(() => duplicateContentEntryAction(entry.id))

    const copyId = redirectedTo.replace("/admin/contenidos/", "")
    createdEntryIds.push(copyId)

    const copy = await prisma.contentEntry.findUniqueOrThrow({ where: { id: copyId } })
    expect(copy.status).toBe("DRAFT")
    expect(copy.slug).toBe(`${entry.slug}-copia`)
  })

  itDb("el rol SALES no puede duplicar", async () => {
    const entry = await createPublishableEntry()
    await signInAs("SALES")
    expect(await duplicateContentEntryAction(entry.id)).toMatchObject({ ok: false })
  })
})

describe("uploadContentImageAction — validación", () => {
  itDb("rechaza un archivo cuyo contenido no corresponde al tipo declarado", async () => {
    const entry = await createPublishableEntry()
    await signInAs("CONTENT")

    const formData = new FormData()
    formData.set("contentEntryId", entry.id)
    // Bytes de un JPEG declarados como PNG.
    formData.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], "trampa.png", { type: "image/png" }))

    const result = await uploadContentImageAction(formData)
    expect(result).toMatchObject({ ok: false })
    expect(JSON.stringify(result)).toMatch(/no corresponde/i)
  })

  itDb("rechaza la petición sin archivo", async () => {
    const entry = await createPublishableEntry()
    await signInAs("CONTENT")

    const formData = new FormData()
    formData.set("contentEntryId", entry.id)

    expect(await uploadContentImageAction(formData)).toMatchObject({
      ok: false,
      errors: ["No se ha recibido ningún archivo."],
    })
  })

  itDb("rechaza la petición sin ficha de destino", async () => {
    await signInAs("CONTENT")
    const formData = new FormData()
    formData.set("file", new File([new Uint8Array([1])], "x.png", { type: "image/png" }))

    expect(await uploadContentImageAction(formData)).toMatchObject({
      ok: false,
      errors: ["Falta la ficha de destino."],
    })
  })
})
