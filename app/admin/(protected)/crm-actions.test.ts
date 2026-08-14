import { afterEach, describe, expect, vi } from "vitest"
import { prisma } from "@/lib/db"
import { createAuthTestUser, signInHeaders } from "@/lib/auth/test-helpers"
import { itDb, uniqueTestEmail } from "@/lib/domain/test-helpers"

/**
 * Autorización de las mutaciones del CRM.
 *
 * Lo que se comprueba aquí no es que la interfaz esconda un botón, sino que
 * **invocar la acción directamente** con la sesión equivocada no cambia nada en
 * la base de datos. Una Server Action es un endpoint: alguien con sesión de
 * CONTENT puede llamarla sin pasar por ninguna pantalla.
 */

// Las acciones llaman a `requirePermission` sin headers, así que por dentro usan
// `headers()` de "next/headers" (el camino real dentro de una Server Action).
// Fuera del runtime de Next no hay scope de petición: se simula aquí.
let currentHeaders = new Headers()
vi.mock("next/headers", () => ({
  headers: async () => currentHeaders,
}))

const revalidatePath = vi.fn()
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => revalidatePath(path) }))

import {
  addLeadNoteAction,
  changeRequestStatusAction,
  createTaskAction,
  updateRequestAction,
  updateScoringRuleAction,
} from "./crm-actions"

const createdUserIds: string[] = []
const createdEmails: string[] = []

afterEach(async () => {
  currentHeaders = new Headers()
  revalidatePath.mockClear()

  if (createdEmails.length) {
    await prisma.lead.deleteMany({ where: { emailNormalized: { in: createdEmails } } })
    createdEmails.length = 0
  }
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
    createdUserIds.length = 0
  }
})

async function createLead() {
  const email = uniqueTestEmail("crm-action")
  createdEmails.push(email.toLowerCase())
  return prisma.lead.create({
    data: { email, emailNormalized: email.toLowerCase(), firstName: "Ana", lastName: "García" },
  })
}

async function createRequest(leadId: string) {
  return prisma.leadRequest.create({
    data: { leadId, eventType: "WEDDING", subject: "Boda", message: "Hola" },
  })
}

async function signInAs(role: "ADMIN" | "SALES" | "CONTENT") {
  const { id, email } = await createAuthTestUser(role)
  createdUserIds.push(id)
  currentHeaders = await signInHeaders(email)
  return id
}

describe("acceso al CRM sin sesión", () => {
  itDb("addLeadNoteAction no guarda nada sin sesión", async () => {
    const lead = await createLead()

    const result = await addLeadNoteAction({ leadId: lead.id, body: "Nota sin sesión" })

    expect(result.ok).toBe(false)
    expect(await prisma.leadNote.count({ where: { leadId: lead.id } })).toBe(0)
  })

  itDb("changeRequestStatusAction no mueve nada sin sesión", async () => {
    const lead = await createLead()
    const request = await createRequest(lead.id)

    const result = await changeRequestStatusAction({ requestId: request.id, nextStatus: "PRESENTATION" })

    expect(result.ok).toBe(false)
    const unchanged = await prisma.leadRequest.findUniqueOrThrow({ where: { id: request.id } })
    expect(unchanged.status).toBe("CONTACT")
  })
})

describe("acceso al CRM con el rol equivocado", () => {
  itDb("CONTENT no puede añadir una nota aunque llame a la acción directamente", async () => {
    const lead = await createLead()
    await signInAs("CONTENT")

    const result = await addLeadNoteAction({ leadId: lead.id, body: "No debería guardarse" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(" ")).toContain("permisos")
    expect(await prisma.leadNote.count({ where: { leadId: lead.id } })).toBe(0)
  })

  itDb("CONTENT no puede mover una solicitud de estado", async () => {
    const lead = await createLead()
    const request = await createRequest(lead.id)
    await signInAs("CONTENT")

    const result = await changeRequestStatusAction({ requestId: request.id, nextStatus: "PRESENTATION" })

    expect(result.ok).toBe(false)
    expect((await prisma.leadRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("CONTACT")
  })

  itDb("CONTENT no puede crear tareas", async () => {
    const lead = await createLead()
    await signInAs("CONTENT")

    const result = await createTaskAction({ leadId: lead.id, title: "Tarea prohibida", dueAt: "2027-06-12" })

    expect(result.ok).toBe(false)
    expect(await prisma.followUpTask.count({ where: { leadId: lead.id } })).toBe(0)
  })

  itDb("SALES no puede cambiar los pesos de scoring: es configuración de ADMIN", async () => {
    await signInAs("SALES")
    const before = await prisma.scoringRule.findUniqueOrThrow({ where: { key: "FORM_SUBMITTED" } })

    const result = await updateScoringRuleAction({ key: "FORM_SUBMITTED", points: "99", active: "true" })

    expect(result.ok).toBe(false)
    const after = await prisma.scoringRule.findUniqueOrThrow({ where: { key: "FORM_SUBMITTED" } })
    expect(after.points).toBe(before.points)
  })
})

describe("acceso al CRM con permiso", () => {
  itDb("SALES puede añadir una nota y queda con su autoría", async () => {
    const lead = await createLead()
    const actorId = await signInAs("SALES")

    const result = await addLeadNoteAction({ leadId: lead.id, body: "Llamada de 10 minutos" })

    expect(result.ok).toBe(true)
    const note = await prisma.leadNote.findFirstOrThrow({ where: { leadId: lead.id } })
    expect(note.authorId).toBe(actorId)
    expect(note.body).toBe("Llamada de 10 minutos")
  })

  itDb("SALES puede mover una solicitud por una transición válida", async () => {
    const lead = await createLead()
    const request = await createRequest(lead.id)
    const actorId = await signInAs("SALES")

    const result = await changeRequestStatusAction({ requestId: request.id, nextStatus: "PRESENTATION" })

    expect(result.ok).toBe(true)
    expect((await prisma.leadRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("PRESENTATION")

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityId: request.id, action: "request.status" },
    })
    expect(audit.actorId).toBe(actorId)
  })

  itDb("una transición inválida se rechaza aunque el rol sea correcto", async () => {
    const lead = await createLead()
    const request = await createRequest(lead.id)
    await signInAs("ADMIN")

    // El tablero no ofrece Cliente desde Contacto, pero la acción no se fía de eso.
    const result = await changeRequestStatusAction({ requestId: request.id, nextStatus: "CLIENT" })

    expect(result.ok).toBe(false)
    expect((await prisma.leadRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("CONTACT")
  })

  itDb("perder sin motivo se rechaza en la acción, no solo en el formulario", async () => {
    const lead = await createLead()
    const request = await createRequest(lead.id)
    await signInAs("SALES")

    const result = await changeRequestStatusAction({ requestId: request.id, nextStatus: "LOST" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(" ").toLowerCase()).toContain("motivo")
    expect((await prisma.leadRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("CONTACT")
  })

  itDb("ADMIN puede cambiar un peso de scoring y queda auditado", async () => {
    const actorId = await signInAs("ADMIN")
    const original = await prisma.scoringRule.findUniqueOrThrow({ where: { key: "DOSSIER_DOWNLOAD" } })

    try {
      const result = await updateScoringRuleAction({
        key: "DOSSIER_DOWNLOAD",
        points: String(original.points + 1),
        active: "true",
      })
      expect(result.ok).toBe(true)

      const updated = await prisma.scoringRule.findUniqueOrThrow({ where: { key: "DOSSIER_DOWNLOAD" } })
      expect(updated.points).toBe(original.points + 1)

      const audit = await prisma.auditEvent.findFirstOrThrow({
        where: { entityType: "ScoringRule", action: "scoring.update", actorId },
        orderBy: { createdAt: "desc" },
      })
      expect((audit.metadata as { clave?: string }).clave).toBe("DOSSIER_DOWNLOAD")
    } finally {
      // Se restaura el peso: es configuración compartida de la base de desarrollo.
      await prisma.scoringRule.update({
        where: { key: "DOSSIER_DOWNLOAD" },
        data: { points: original.points, active: original.active },
      })
    }
  })

  itDb("asignar un responsable inexistente devuelve error y no cambia nada", async () => {
    const lead = await createLead()
    const request = await createRequest(lead.id)
    await signInAs("ADMIN")

    const result = await updateRequestAction({
      requestId: request.id,
      priority: "HIGH",
      ownerId: "usuario-que-no-existe",
    })

    expect(result.ok).toBe(false)
    const unchanged = await prisma.leadRequest.findUniqueOrThrow({ where: { id: request.id } })
    expect(unchanged.priority).toBe("NORMAL")
    expect(unchanged.ownerId).toBeNull()
  })
})
