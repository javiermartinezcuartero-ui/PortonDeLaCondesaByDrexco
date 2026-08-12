import { afterEach, describe, expect } from "vitest"
import { prisma } from "@/lib/db"
import { createLeadRequest } from "@/lib/domain/lead-requests"
import { recalculateLeadScore } from "@/lib/domain/scoring"
import { itDb, uniqueTestEmail } from "@/lib/domain/test-helpers"

const createdLeadIds: string[] = []
afterEach(async () => {
  if (createdLeadIds.length) {
    await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } })
    createdLeadIds.length = 0
  }
})

describe("recalculateLeadScore", () => {
  itDb("suma los pesos de las señales presentes según scoring_rule", async () => {
    await prisma.scoringRule.upsert({
      where: { key: "FORM_SUBMITTED" },
      create: { key: "FORM_SUBMITTED", label: "Formulario enviado", points: 10 },
      update: { points: 10, active: true },
    })
    await prisma.scoringRule.upsert({
      where: { key: "PHONE_PROVIDED" },
      create: { key: "PHONE_PROVIDED", label: "Teléfono informado", points: 10 },
      update: { points: 10, active: true },
    })
    await prisma.scoringRule.upsert({
      where: { key: "EVENT_DATE_PROVIDED" },
      create: { key: "EVENT_DATE_PROVIDED", label: "Fecha informada", points: 10 },
      update: { points: 10, active: true },
    })

    const email = uniqueTestEmail("scoring")
    const { lead } = await createLeadRequest({
      email,
      phone: "619865403",
      eventType: "boda",
      eventDate: new Date("2027-06-01"),
    })
    createdLeadIds.push(lead.id)

    const score = await recalculateLeadScore(lead.id)

    // FORM_SUBMITTED (10) + PHONE_PROVIDED (10) + EVENT_DATE_PROVIDED (10) = 30
    expect(score).toBe(30)

    const updatedLead = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })
    expect(updatedLead.score).toBe(30)
  })

  itDb("una regla desactivada no suma puntos", async () => {
    await prisma.scoringRule.upsert({
      where: { key: "FORM_SUBMITTED" },
      create: { key: "FORM_SUBMITTED", label: "Formulario enviado", points: 10, active: false },
      update: { active: false },
    })

    const email = uniqueTestEmail("scoring-inactivo")
    const { lead } = await createLeadRequest({ email, eventType: "boda" })
    createdLeadIds.push(lead.id)

    const score = await recalculateLeadScore(lead.id)
    expect(score).toBe(0)

    // Deja la regla reactivada para no afectar a otros tests/al seed real.
    await prisma.scoringRule.update({ where: { key: "FORM_SUBMITTED" }, data: { active: true } })
  })
})
