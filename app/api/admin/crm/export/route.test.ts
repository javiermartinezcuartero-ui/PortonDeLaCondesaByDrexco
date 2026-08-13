import { afterEach, describe, expect } from "vitest"
import { prisma } from "@/lib/db"
import { createAuthTestUser, signInHeaders } from "@/lib/auth/test-helpers"
import { itDb, uniqueTestEmail } from "@/lib/domain/test-helpers"
import { GET } from "./route"

/**
 * Descarga CSV: es la única vía por la que datos personales salen de la
 * aplicación, así que la prueba central es de autorización. Un rol con acceso al
 * CRM **no** implica permiso para exportarlo.
 */

const ENDPOINT = "http://localhost:3001/api/admin/crm/export"

const createdUserIds: string[] = []
const createdEmails: string[] = []

afterEach(async () => {
  if (createdEmails.length) {
    await prisma.lead.deleteMany({ where: { emailNormalized: { in: createdEmails } } })
    createdEmails.length = 0
  }
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
    createdUserIds.length = 0
  }
})

async function createLead(score: number) {
  const email = uniqueTestEmail("export")
  createdEmails.push(email.toLowerCase())
  return prisma.lead.create({
    data: { email, emailNormalized: email.toLowerCase(), firstName: "Ana", lastName: "García", score },
  })
}

async function headersFor(role: "ADMIN" | "SALES" | "CONTENT"): Promise<Headers> {
  const { id, email } = await createAuthTestUser(role)
  createdUserIds.push(id)
  return signInHeaders(email)
}

function buildRequest(query: string, headers: Headers): Request {
  return new Request(`${ENDPOINT}?${query}`, { headers })
}

describe("GET /api/admin/crm/export", () => {
  itDb("devuelve 401 sin sesión", async () => {
    const response = await GET(buildRequest("conjunto=contactos", new Headers()))
    expect(response.status).toBe(401)
  })

  itDb("devuelve 403 con sesión SALES: consultar el CRM no es poder exportarlo", async () => {
    const response = await GET(buildRequest("conjunto=contactos", await headersFor("SALES")))
    expect(response.status).toBe(403)
  })

  itDb("devuelve 403 con sesión CONTENT", async () => {
    const response = await GET(buildRequest("conjunto=contactos", await headersFor("CONTENT")))
    expect(response.status).toBe(403)
  })

  itDb("devuelve 400 si el conjunto pedido no existe", async () => {
    const response = await GET(buildRequest("conjunto=inventado", await headersFor("ADMIN")))
    expect(response.status).toBe(400)
  })

  itDb("ADMIN descarga el CSV con cabeceras de archivo y sin caché", async () => {
    const lead = await createLead(93)
    const response = await GET(buildRequest("conjunto=contactos&score=90", await headersFor("ADMIN")))

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/csv")
    expect(response.headers.get("content-disposition")).toContain("attachment")
    // Un archivo con datos personales no se queda en ninguna caché intermedia.
    expect(response.headers.get("cache-control")).toBe("no-store")

    const csv = await response.text()
    expect(csv).toContain("Nombre;Apellidos;Email")
    expect(csv).toContain(lead.email)
  })

  itDb("respeta los filtros de la URL, igual que la pantalla", async () => {
    const included = await createLead(94)
    const excluded = await createLead(2)

    const response = await GET(buildRequest("conjunto=contactos&score=90", await headersFor("ADMIN")))
    const csv = await response.text()

    expect(csv).toContain(included.email)
    expect(csv).not.toContain(excluded.email)
  })

  itDb("las notas internas solo salen si se piden explícitamente", async () => {
    const lead = await createLead(95)
    await prisma.leadNote.create({ data: { leadId: lead.id, body: "Nota que no debe salir por defecto" } })

    const withoutNotes = await GET(buildRequest("conjunto=contactos&score=90", await headersFor("ADMIN")))
    expect(await withoutNotes.text()).not.toContain("Nota que no debe salir")

    const withNotes = await GET(buildRequest("conjunto=contactos&score=90&notas=si", await headersFor("ADMIN")))
    expect(await withNotes.text()).toContain("Nota que no debe salir")
  })

  itDb("el CSV de solicitudes no incluye credenciales ni identificadores internos", async () => {
    const lead = await createLead(96)
    await prisma.leadRequest.create({
      data: { leadId: lead.id, eventType: "WEDDING", subject: "Boda", guestCount: 77, submissionId: "clave-interna-1" },
    })

    const response = await GET(
      buildRequest("conjunto=solicitudes&minInvitados=77&maxInvitados=77", await headersFor("ADMIN"))
    )
    const csv = await response.text()

    expect(csv).toContain("Boda")
    for (const forbidden of ["clave-interna-1", "submissionId", "password", "token", "hash", "leadId"]) {
      expect(csv).not.toContain(forbidden)
    }
  })
})
