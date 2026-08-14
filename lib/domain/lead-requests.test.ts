import { afterEach, describe, expect } from "vitest"
import { prisma } from "@/lib/db"
import { createLeadRequest, changeLeadRequestStatus } from "@/lib/domain/lead-requests"
import { InvalidTransitionError, DomainError } from "@/lib/domain/errors"
import { itDb, uniqueTestEmail } from "@/lib/domain/test-helpers"

const createdLeadIds: string[] = []
afterEach(async () => {
  if (createdLeadIds.length) {
    await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } })
    createdLeadIds.length = 0
  }
})

describe("createLeadRequest", () => {
  itDb("crea una LeadRequest nueva por email repetido, sin sobrescribir la anterior", async () => {
    const email = uniqueTestEmail("multi-request")

    const first = await createLeadRequest({ email, eventType: "boda", subject: "Primera consulta" })
    createdLeadIds.push(first.lead.id)

    const second = await createLeadRequest({ email, eventType: "catering", subject: "Segunda consulta" })

    expect(second.lead.id).toBe(first.lead.id)
    expect(second.leadRequest.id).not.toBe(first.leadRequest.id)

    const requests = await prisma.leadRequest.findMany({ where: { leadId: first.lead.id } })
    expect(requests).toHaveLength(2)

    const untouchedFirst = await prisma.leadRequest.findUniqueOrThrow({ where: { id: first.leadRequest.id } })
    expect(untouchedFirst.subject).toBe("Primera consulta") // no se sobrescribió
  })
})

describe("changeLeadRequestStatus", () => {
  itDb("permite una transición válida y registra la actividad", async () => {
    const email = uniqueTestEmail("transicion-valida")
    const { lead, leadRequest } = await createLeadRequest({ email, eventType: "boda" })
    createdLeadIds.push(lead.id)

    const updated = await changeLeadRequestStatus({ leadRequestId: leadRequest.id, nextStatus: "PRESENTATION" })
    expect(updated.status).toBe("PRESENTATION")

    const activity = await prisma.leadActivity.findFirst({
      where: { leadRequestId: leadRequest.id, type: "STATUS_CHANGED" },
    })
    expect(activity).not.toBeNull()
  })

  itDb("rechaza una transición no permitida", async () => {
    const email = uniqueTestEmail("transicion-invalida")
    const { lead, leadRequest } = await createLeadRequest({ email, eventType: "boda" })
    createdLeadIds.push(lead.id)

    await expect(
      changeLeadRequestStatus({ leadRequestId: leadRequest.id, nextStatus: "CLIENT" })
    ).rejects.toBeInstanceOf(InvalidTransitionError)
  })

  itDb("exige lostReason para marcar como LOST", async () => {
    const email = uniqueTestEmail("lost-sin-motivo")
    const { lead, leadRequest } = await createLeadRequest({ email, eventType: "boda" })
    createdLeadIds.push(lead.id)

    await expect(
      changeLeadRequestStatus({ leadRequestId: leadRequest.id, nextStatus: "LOST" })
    ).rejects.toBeInstanceOf(DomainError)

    const withReason = await changeLeadRequestStatus({
      leadRequestId: leadRequest.id,
      nextStatus: "LOST",
      lostReason: "Presupuesto fuera de rango",
    })
    expect(withReason.status).toBe("LOST")
    expect(withReason.lostReason).toBe("Presupuesto fuera de rango")
  })
})
