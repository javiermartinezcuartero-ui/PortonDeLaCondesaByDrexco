import { afterEach, describe, expect } from "vitest"
import { prisma } from "@/lib/db"
import { getOrCreateLead } from "@/lib/domain/leads"
import { createVipAccessSession, verifyVipAccessSession, revokeVipAccessSession } from "@/lib/domain/vip-sessions"
import { itDb, uniqueTestEmail } from "@/lib/domain/test-helpers"

const createdLeadIds: string[] = []
afterEach(async () => {
  if (createdLeadIds.length) {
    await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } })
    createdLeadIds.length = 0
  }
})

describe("sesión de acceso VIP", () => {
  itDb("nunca guarda el token en claro y lo verifica por su hash", async () => {
    const lead = await getOrCreateLead({ email: uniqueTestEmail("vip") })
    createdLeadIds.push(lead.id)

    const { token, session } = await createVipAccessSession(lead.id)

    expect(session.tokenHash).not.toBe(token)

    const stored = await prisma.vipAccessSession.findUniqueOrThrow({ where: { id: session.id } })
    expect(stored.tokenHash).not.toContain(token)

    const resolved = await verifyVipAccessSession(token)
    expect(resolved?.id).toBe(lead.id)
  })

  itDb("una sesión revocada deja de ser válida", async () => {
    const lead = await getOrCreateLead({ email: uniqueTestEmail("vip-revocada") })
    createdLeadIds.push(lead.id)

    const { token, session } = await createVipAccessSession(lead.id)
    await revokeVipAccessSession(session.id)

    const resolved = await verifyVipAccessSession(token)
    expect(resolved).toBeNull()
  })

  itDb("un token inválido no resuelve ninguna sesión", async () => {
    const resolved = await verifyVipAccessSession("token-que-no-existe")
    expect(resolved).toBeNull()
  })
})
