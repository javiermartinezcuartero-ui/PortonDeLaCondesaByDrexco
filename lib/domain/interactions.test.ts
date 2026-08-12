import { afterEach, describe, expect } from "vitest"
import { prisma } from "@/lib/db"
import { createContentEntry } from "@/lib/domain/content"
import { getOrCreateLead } from "@/lib/domain/leads"
import { recordContentViewOnce, VIEW_DEDUPE_WINDOW_MS } from "@/lib/domain/interactions"
import { itDb, uniqueSlug, uniqueTestEmail } from "@/lib/domain/test-helpers"

const createdLeadIds: string[] = []
const createdEntryIds: string[] = []

afterEach(async () => {
  if (createdLeadIds.length) {
    await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } })
    createdLeadIds.length = 0
  }
  if (createdEntryIds.length) {
    await prisma.contentEntry.deleteMany({ where: { id: { in: createdEntryIds } } })
    createdEntryIds.length = 0
  }
})

async function createLead() {
  const lead = await getOrCreateLead({ email: uniqueTestEmail("interaccion") })
  createdLeadIds.push(lead.id)
  return lead
}

async function createEntry() {
  const entry = await createContentEntry({
    type: "REAL_WEDDING",
    slug: uniqueSlug("interaccion"),
    translations: { es: { title: "Ficha" } },
  })
  createdEntryIds.push(entry.id)
  return entry
}

describe("recordContentViewOnce", () => {
  itDb("registra la primera vista de una sección", async () => {
    const lead = await createLead()

    const interaction = await recordContentViewOnce({
      leadId: lead.id,
      section: "REAL_WEDDING",
      type: "SECTION_VIEWED",
    })

    expect(interaction).not.toBeNull()
    expect(await prisma.contentInteraction.count({ where: { leadId: lead.id } })).toBe(1)
  })

  itDb("no duplica la misma vista dentro de la ventana (render doble, prefetch, F5)", async () => {
    const lead = await createLead()
    const input = { leadId: lead.id, section: "REAL_WEDDING" as const, type: "SECTION_VIEWED" as const }

    await recordContentViewOnce(input)
    const second = await recordContentViewOnce(input)
    const third = await recordContentViewOnce(input)

    expect(second).toBeNull()
    expect(third).toBeNull()
    expect(await prisma.contentInteraction.count({ where: { leadId: lead.id } })).toBe(1)
  })

  itDb("distingue la vista del listado de la de una ficha concreta", async () => {
    const lead = await createLead()
    const entry = await createEntry()

    await recordContentViewOnce({ leadId: lead.id, section: "REAL_WEDDING", type: "SECTION_VIEWED" })
    await recordContentViewOnce({
      leadId: lead.id,
      section: "REAL_WEDDING",
      type: "CONTENT_VIEWED",
      contentEntryId: entry.id,
    })

    const interactions = await prisma.contentInteraction.findMany({ where: { leadId: lead.id } })
    expect(interactions).toHaveLength(2)
    expect(interactions.map((item) => item.type).sort()).toEqual(["CONTENT_VIEWED", "SECTION_VIEWED"])
  })

  itDb("cuenta por separado dos fichas distintas de la misma sección", async () => {
    const lead = await createLead()
    const first = await createEntry()
    const second = await createEntry()

    await recordContentViewOnce({
      leadId: lead.id,
      section: "REAL_WEDDING",
      type: "CONTENT_VIEWED",
      contentEntryId: first.id,
    })
    await recordContentViewOnce({
      leadId: lead.id,
      section: "REAL_WEDDING",
      type: "CONTENT_VIEWED",
      contentEntryId: second.id,
    })

    expect(await prisma.contentInteraction.count({ where: { leadId: lead.id } })).toBe(2)
  })

  itDb("distingue las dos secciones (interacción por categoría de entrada)", async () => {
    const lead = await createLead()

    await recordContentViewOnce({ leadId: lead.id, section: "REAL_WEDDING", type: "SECTION_VIEWED" })
    await recordContentViewOnce({ leadId: lead.id, section: "CATERING_EVENT", type: "SECTION_VIEWED" })

    const interactions = await prisma.contentInteraction.findMany({ where: { leadId: lead.id } })
    expect(interactions.map((item) => item.section).sort()).toEqual(["CATERING_EVENT", "REAL_WEDDING"])
  })

  itDb("vuelve a registrar cuando la vista anterior queda fuera de la ventana", async () => {
    const lead = await createLead()
    const input = { leadId: lead.id, section: "REAL_WEDDING" as const, type: "SECTION_VIEWED" as const }

    await recordContentViewOnce(input)
    // Se envejece la interacción en vez de esperar 30 minutos reales.
    await prisma.contentInteraction.updateMany({
      where: { leadId: lead.id },
      data: { createdAt: new Date(Date.now() - VIEW_DEDUPE_WINDOW_MS - 1000) },
    })

    expect(await recordContentViewOnce(input)).not.toBeNull()
    expect(await prisma.contentInteraction.count({ where: { leadId: lead.id } })).toBe(2)
  })

  itDb("no mezcla los historiales de dos leads distintos", async () => {
    const first = await createLead()
    const second = await createLead()
    const input = { section: "REAL_WEDDING" as const, type: "SECTION_VIEWED" as const }

    await recordContentViewOnce({ ...input, leadId: first.id })
    // Para el segundo lead es su primera vista, aunque el primero ya la tenga.
    expect(await recordContentViewOnce({ ...input, leadId: second.id })).not.toBeNull()
  })
})
