import type { ReactElement, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Lead } from "@prisma/client"

/**
 * El requisito más importante de la Fase 5: **sin sesión válida no se consulta
 * ni se serializa ninguna ficha**. Aquí se comprueba en el propio límite del
 * componente de servidor, no mirando el HTML: se espía la capa de datos y se
 * verifica que no se llama.
 *
 * Un test sobre el HTML podría pasar por casualidad (porque el contenido esté
 * vacío, o porque el texto buscado no coincida); espiar la consulta demuestra
 * que la comprobación de acceso va **antes** del acceso a datos.
 */

const getVipLead = vi.fn<() => Promise<Lead | null>>()
vi.mock("@/lib/vip/session", () => ({
  getVipLead: () => getVipLead(),
  hasVipAccess: async () => (await getVipLead()) !== null,
}))

const listPublishedContent = vi.fn(async () => [])
const getPublishedContentBySlug = vi.fn(async () => null)
vi.mock("@/lib/domain/content", () => ({
  listPublishedContent: (...args: unknown[]) => listPublishedContent(...(args as [])),
  getPublishedContentBySlug: (...args: unknown[]) => getPublishedContentBySlug(...(args as [])),
}))

const resolveMediaUrls = vi.fn(async () => new Map())
vi.mock("@/lib/domain/content-media", () => ({
  resolveMediaUrls: (...args: unknown[]) => resolveMediaUrls(...(args as [])),
  PUBLIC_SIGNED_URL_TTL_SECONDS: 3600,
}))

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND")
})
vi.mock("next/navigation", () => ({ notFound: () => notFound() }))

import { VipLibrary } from "@/components/vip/vip-library"
import { VipStory } from "@/components/vip/vip-story"
import { VipGate } from "@/components/vip/vip-gate"
import { StoryCard } from "@/components/vip/story-card"
import { StoryDetail } from "@/components/vip/story-detail"

/** Recorre el árbol de elementos devuelto y recoge los tipos de componente usados. */
function collectComponentTypes(node: ReactNode, found: Set<unknown> = new Set()): Set<unknown> {
  if (node === null || node === undefined || typeof node === "boolean") return found
  if (Array.isArray(node)) {
    for (const child of node) collectComponentTypes(child, found)
    return found
  }
  if (typeof node !== "object") return found

  const element = node as ReactElement<{ children?: ReactNode }>
  found.add(element.type)
  if (element.props?.children) collectComponentTypes(element.props.children, found)
  return found
}

const fakeLead = { id: "lead-1" } as Lead

beforeEach(() => {
  getVipLead.mockReset()
  listPublishedContent.mockClear()
  getPublishedContentBySlug.mockClear()
  resolveMediaUrls.mockClear()
  notFound.mockClear()
})

describe("VipLibrary — límite de acceso", () => {
  it("sin sesión muestra el gate y NO consulta el contenido", async () => {
    getVipLead.mockResolvedValue(null)

    const tree = await VipLibrary({ type: "REAL_WEDDING" })
    const types = collectComponentTypes(tree)

    expect(types.has(VipGate)).toBe(true)
    expect(types.has(StoryCard)).toBe(false)
    // Lo esencial: la capa de datos no se ha tocado.
    expect(listPublishedContent).not.toHaveBeenCalled()
  })

  it("sin sesión no genera ninguna URL firmada", async () => {
    getVipLead.mockResolvedValue(null)

    await VipLibrary({ type: "CATERING_EVENT" })

    expect(resolveMediaUrls).not.toHaveBeenCalled()
  })

  it("con sesión consulta el contenido del tipo correcto", async () => {
    getVipLead.mockResolvedValue(fakeLead)

    const tree = await VipLibrary({ type: "CATERING_EVENT" })
    const types = collectComponentTypes(tree)

    expect(types.has(VipGate)).toBe(false)
    expect(listPublishedContent).toHaveBeenCalledWith("CATERING_EVENT")
  })
})

describe("VipStory — límite de acceso", () => {
  it("acceder directamente a un slug sin sesión muestra el gate y NO consulta la ficha", async () => {
    getVipLead.mockResolvedValue(null)

    const tree = await VipStory({ type: "REAL_WEDDING", slug: "laura-y-marcos" })
    const types = collectComponentTypes(tree)

    expect(types.has(VipGate)).toBe(true)
    expect(types.has(StoryDetail)).toBe(false)
    expect(getPublishedContentBySlug).not.toHaveBeenCalled()
    expect(resolveMediaUrls).not.toHaveBeenCalled()
  })

  it("sin sesión no llega a notFound aunque el slug no exista (no se filtra qué slugs hay)", async () => {
    getVipLead.mockResolvedValue(null)

    const tree = await VipStory({ type: "REAL_WEDDING", slug: "slug-que-no-existe" })

    // Un 404 distinto del gate revelaría qué slugs existen y cuáles no.
    expect(collectComponentTypes(tree).has(VipGate)).toBe(true)
    expect(notFound).not.toHaveBeenCalled()
  })

  it("con sesión consulta la ficha por tipo y slug", async () => {
    getVipLead.mockResolvedValue(fakeLead)

    // Con la consulta mockeada devolviendo null, la ficha no existe → 404.
    await expect(VipStory({ type: "CATERING_EVENT", slug: "gala" })).rejects.toThrow("NEXT_NOT_FOUND")
    expect(getPublishedContentBySlug).toHaveBeenCalledWith("CATERING_EVENT", "gala")
  })
})

describe("gate del slug: la ruta de retorno vuelve a la misma ficha", () => {
  it("el gate de una ficha recibe su propia ruta como returnPath", async () => {
    getVipLead.mockResolvedValue(null)

    const tree = (await VipStory({ type: "REAL_WEDDING", slug: "laura-y-marcos" })) as ReactElement<{
      children?: ReactNode
    }>
    const gate = collectGateElement(tree)

    expect(gate?.props).toMatchObject({
      section: "REAL_WEDDING",
      returnPath: "/bodas-reales/laura-y-marcos",
    })
  })
})

/** Localiza el elemento `VipGate` dentro del árbol devuelto. */
function collectGateElement(node: ReactNode): ReactElement<Record<string, unknown>> | null {
  if (node === null || node === undefined || typeof node === "boolean") return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = collectGateElement(child)
      if (found) return found
    }
    return null
  }
  if (typeof node !== "object") return null

  const element = node as ReactElement<{ children?: ReactNode }>
  if (element.type === VipGate) return element as ReactElement<Record<string, unknown>>
  return element.props?.children ? collectGateElement(element.props.children) : null
}
