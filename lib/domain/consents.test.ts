import { afterEach, describe, expect } from "vitest"
import { prisma } from "@/lib/db"
import { getOrCreateLead } from "@/lib/domain/leads"
import { recordConsent, getLatestConsent } from "@/lib/domain/consents"
import { itDb, uniqueTestEmail } from "@/lib/domain/test-helpers"

const createdLeadIds: string[] = []
afterEach(async () => {
  if (createdLeadIds.length) {
    await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } })
    createdLeadIds.length = 0
  }
})

describe("recordConsent", () => {
  itDb("una revocación crea un evento nuevo en vez de modificar el anterior", async () => {
    const lead = await getOrCreateLead({ email: uniqueTestEmail("consentimiento") })
    createdLeadIds.push(lead.id)

    const granted = await recordConsent({ leadId: lead.id, purpose: "MARKETING", granted: true, policyVersion: "v1" })
    const revoked = await recordConsent({ leadId: lead.id, purpose: "MARKETING", granted: false, policyVersion: "v1" })

    expect(granted.id).not.toBe(revoked.id)

    const events = await prisma.consentEvent.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: "asc" } })
    expect(events).toHaveLength(2)
    expect(events[0].granted).toBe(true)
    expect(events[1].granted).toBe(false)

    const latest = await getLatestConsent(lead.id, "MARKETING")
    expect(latest?.granted).toBe(false)
  })
})
