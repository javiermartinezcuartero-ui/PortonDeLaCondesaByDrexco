import { afterEach, describe, expect } from "vitest"
import { prisma } from "@/lib/db"
import { getOrCreateLead, anonymizeLead } from "@/lib/domain/leads"
import { itDb, uniqueTestEmail } from "@/lib/domain/test-helpers"

const createdLeadIds: string[] = []
afterEach(async () => {
  if (createdLeadIds.length) {
    await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } })
    createdLeadIds.length = 0
  }
})

describe("getOrCreateLead", () => {
  itDb("no duplica el Lead ante dos peticiones concurrentes con el mismo email", async () => {
    const email = uniqueTestEmail("concurrencia")

    const [leadA, leadB] = await Promise.all([
      getOrCreateLead({ email, firstName: "Ana" }),
      getOrCreateLead({ email, firstName: "Ana" }),
    ])
    createdLeadIds.push(leadA.id)

    expect(leadA.id).toBe(leadB.id)

    const count = await prisma.lead.count({ where: { emailNormalized: email.toLowerCase() } })
    expect(count).toBe(1)
  })

  itDb("reutiliza el Lead existente para el mismo email normalizado", async () => {
    const email = uniqueTestEmail("reuso")
    const first = await getOrCreateLead({ email: email.toUpperCase(), firstName: "Ana" })
    createdLeadIds.push(first.id)

    const second = await getOrCreateLead({ email, lastName: "Ejemplo" })

    expect(second.id).toBe(first.id)
    expect(second.firstName).toBe("Ana") // no se pierde el nombre ya guardado
    expect(second.lastName).toBe("Ejemplo") // se añade el nuevo dato
  })
})

describe("anonymizeLead", () => {
  itDb("sustituye los campos identificativos y marca lifecycle = ANONYMIZED", async () => {
    const email = uniqueTestEmail("anonimizar")
    const lead = await getOrCreateLead({ email, firstName: "Carlos", lastName: "Ejemplo", phone: "619865403" })
    createdLeadIds.push(lead.id)

    const anonymized = await anonymizeLead(lead.id)

    expect(anonymized.lifecycle).toBe("ANONYMIZED")
    expect(anonymized.firstName).toBeNull()
    expect(anonymized.lastName).toBeNull()
    expect(anonymized.phone).toBeNull()
    expect(anonymized.phoneNormalized).toBeNull()
    expect(anonymized.email).not.toBe(email)
    expect(anonymized.anonymizedAt).not.toBeNull()
  })
})
