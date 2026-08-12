import { afterEach, beforeEach, describe, expect, vi } from "vitest"
import { prisma } from "@/lib/db"
import { createVipAccessSession, revokeVipAccessSession } from "@/lib/domain/vip-sessions"
import { getOrCreateLead } from "@/lib/domain/leads"
import { itDb, uniqueTestEmail } from "@/lib/domain/test-helpers"

let cookieValue: string | undefined

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieValue ? { name, value: cookieValue } : undefined),
  }),
}))

import { getVipLead, hasVipAccess, vipCookieOptions, VIP_COOKIE_MAX_AGE_SECONDS } from "@/lib/vip/session"

const createdLeadIds: string[] = []

beforeEach(() => {
  cookieValue = undefined
})

afterEach(async () => {
  if (createdLeadIds.length) {
    await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } })
    createdLeadIds.length = 0
  }
})

async function createLead() {
  const lead = await getOrCreateLead({ email: uniqueTestEmail("vip-session") })
  createdLeadIds.push(lead.id)
  return lead
}

describe("getVipLead", () => {
  itDb("sin cookie no hay acceso", async () => {
    expect(await getVipLead()).toBeNull()
    expect(await hasVipAccess()).toBe(false)
  })

  itDb("una cookie con un token inventado no concede acceso", async () => {
    cookieValue = "token-inventado-por-un-atacante"
    expect(await getVipLead()).toBeNull()
  })

  itDb("un token válido resuelve su Lead", async () => {
    const lead = await createLead()
    const { token } = await createVipAccessSession(lead.id)
    cookieValue = token

    expect((await getVipLead())?.id).toBe(lead.id)
    expect(await hasVipAccess()).toBe(true)
  })

  itDb("una sesión revocada devuelve null (vuelve a salir el gate)", async () => {
    const lead = await createLead()
    const { token, session } = await createVipAccessSession(lead.id)
    await revokeVipAccessSession(session.id)
    cookieValue = token

    expect(await getVipLead()).toBeNull()
  })

  itDb("una sesión caducada devuelve null", async () => {
    const lead = await createLead()
    // TTL negativo: nace ya caducada.
    const { token } = await createVipAccessSession(lead.id, -1000)
    cookieValue = token

    expect(await getVipLead()).toBeNull()
  })

  itDb("el hash almacenado no sirve como token", async () => {
    const lead = await createLead()
    const { session } = await createVipAccessSession(lead.id)

    // Escenario de volcado de la tabla: conocer el hash no da acceso.
    cookieValue = session.tokenHash
    expect(await getVipLead()).toBeNull()
  })

  itDb("el token de un lead no sirve para otro", async () => {
    const first = await createLead()
    const second = await createLead()
    const { token } = await createVipAccessSession(first.id)
    cookieValue = token

    const resolved = await getVipLead()
    expect(resolved?.id).toBe(first.id)
    expect(resolved?.id).not.toBe(second.id)
  })
})

describe("vipCookieOptions", () => {
  itDb("es HttpOnly, SameSite=lax, con path raíz y caducidad de 30 días", () => {
    const options = vipCookieOptions()
    expect(options.httpOnly).toBe(true)
    expect(options.sameSite).toBe("lax")
    expect(options.path).toBe("/")
    expect(options.maxAge).toBe(VIP_COOKIE_MAX_AGE_SECONDS)
    expect(VIP_COOKIE_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 30)
  })

  itDb("no es Secure en desarrollo sobre http (si lo fuera, el gate sería inusable)", () => {
    // NODE_ENV en los tests es "test" y BETTER_AUTH_URL apunta a http://localhost.
    expect(vipCookieOptions().secure).toBe(false)
  })
})
