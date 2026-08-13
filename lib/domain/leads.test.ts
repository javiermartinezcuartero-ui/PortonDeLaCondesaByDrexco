import { afterEach, describe, expect } from "vitest"
import { prisma } from "@/lib/db"
import { getOrCreateLead } from "@/lib/domain/leads"
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


describe("getOrCreateLead — no sobrescribe con vacío", () => {
  itDb("una cadena vacía no borra el nombre ya guardado", async () => {
    // Red de seguridad de la capa de dominio. El endpoint público ya rechaza en el
    // borde un nombre sin caracteres imprimibles, pero `getOrCreateLead` tiene otros
    // llamantes (gate VIP, sembrado) y Prisma distingue `undefined` ("no toques la
    // columna") de `""` ("escribe vacío"). Sin esta guarda, cualquier camino que
    // pasara "" dejaba la ficha del CRM sin nombre de forma irreversible.
    const email = uniqueTestEmail("no-sobrescribir")

    const created = await getOrCreateLead({ email, firstName: "Ana", lastName: "García", phone: "+34600111222" })
    createdLeadIds.push(created.id)
    expect(created.firstName).toBe("Ana")

    const updated = await getOrCreateLead({ email, firstName: "", lastName: "   ", phone: "" })

    expect(updated.id).toBe(created.id)
    expect(updated.firstName).toBe("Ana")
    expect(updated.lastName).toBe("García")
    expect(updated.phone).toBe("+34600111222")
    expect(updated.phoneNormalized).toBe(created.phoneNormalized)
  })

  itDb("un dato nuevo de verdad sí actualiza", async () => {
    // La guarda no debe convertirse en "nunca se actualiza nada": un contacto
    // captado por el gate (solo correo) tiene que poder recibir su nombre cuando
    // rellena el formulario.
    const email = uniqueTestEmail("si-actualiza")

    const created = await getOrCreateLead({ email })
    createdLeadIds.push(created.id)
    expect(created.firstName).toBeNull()

    const updated = await getOrCreateLead({ email, firstName: "Elena", lastName: "Ruiz" })

    expect(updated.firstName).toBe("Elena")
    expect(updated.lastName).toBe("Ruiz")
  })
})
