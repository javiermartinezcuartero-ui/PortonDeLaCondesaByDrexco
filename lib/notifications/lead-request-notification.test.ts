import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db"
import { itDb, uniqueTestEmail } from "@/lib/domain/test-helpers"
import { buildLeadNotificationHtml, notifyNewLeadRequest } from "@/lib/notifications/lead-request-notification"
import type { Lead, LeadRequest } from "@prisma/client"

const createdEmails: string[] = []

const originalApiKey = process.env.SENDGRID_API_KEY
const originalRecipient = process.env.LEAD_NOTIFICATION_TO

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(async () => {
  vi.restoreAllMocks()

  if (originalApiKey === undefined) delete process.env.SENDGRID_API_KEY
  else process.env.SENDGRID_API_KEY = originalApiKey
  if (originalRecipient === undefined) delete process.env.LEAD_NOTIFICATION_TO
  else process.env.LEAD_NOTIFICATION_TO = originalRecipient

  if (createdEmails.length) {
    await prisma.lead.deleteMany({ where: { emailNormalized: { in: createdEmails } } })
    createdEmails.length = 0
  }
})

async function createLeadWithRequest(): Promise<{ lead: Lead; leadRequest: LeadRequest }> {
  const email = uniqueTestEmail("aviso")
  createdEmails.push(email.toLowerCase())

  const lead = await prisma.lead.create({
    data: { email, emailNormalized: email.toLowerCase(), firstName: "Ana", lastName: "García" },
  })
  const leadRequest = await prisma.leadRequest.create({
    data: { leadId: lead.id, eventType: "WEDDING", subject: "Boda en septiembre", message: "Hola" },
  })

  return { lead, leadRequest }
}

describe("buildLeadNotificationHtml", () => {
  it("escapa el texto libre para que no se interprete como HTML", () => {
    const lead = { firstName: "Ana", lastName: "García", email: "ana@example.test", phone: null } as Lead
    const leadRequest = {
      eventType: "WEDDING",
      eventDate: null,
      guestCount: null,
      preferredSpace: null,
      budgetRange: null,
      company: null,
      jobTitle: null,
      audiovisualNeeds: null,
      subject: '<img src=x onerror="alert(1)">',
      message: "Queremos algo & especial",
      sourceForm: "contact-home",
      sourcePage: "/",
    } as LeadRequest

    const html = buildLeadNotificationHtml(lead, leadRequest)

    expect(html).not.toContain("<img")
    expect(html).toContain("&lt;img")
    expect(html).toContain("Queremos algo &amp; especial")
  })

  it("omite las filas sin valor en vez de mostrarlas vacías", () => {
    const lead = { firstName: "Ana", lastName: null, email: "ana@example.test", phone: null } as Lead
    const leadRequest = { eventType: "WEDDING", eventDate: null, guestCount: null } as LeadRequest

    const html = buildLeadNotificationHtml(lead, leadRequest)
    expect(html).not.toContain("Teléfono")
    expect(html).not.toContain("Invitados")
  })
})

describe("notifyNewLeadRequest", () => {
  itDb("sin proveedor configurado no falla y queda como PENDING", async () => {
    delete process.env.SENDGRID_API_KEY
    delete process.env.LEAD_NOTIFICATION_TO

    const { lead, leadRequest } = await createLeadWithRequest()
    const result = await notifyNewLeadRequest(lead, leadRequest)

    expect(result).toEqual({ delivered: false, reason: "not-configured" })

    const log = await prisma.notificationLog.findFirst({ where: { leadId: lead.id } })
    expect(log?.status).toBe("PENDING")
    expect(log?.sentAt).toBeNull()
  })

  itDb("con proveedor configurado pero sin transporte registra el fallo y no lanza", async () => {
    process.env.SENDGRID_API_KEY = "clave-de-prueba"
    process.env.LEAD_NOTIFICATION_TO = "avisos@example.test"

    const { lead, leadRequest } = await createLeadWithRequest()
    const result = await notifyNewLeadRequest(lead, leadRequest)

    expect(result).toEqual({ delivered: false, reason: "failed" })

    const log = await prisma.notificationLog.findFirst({ where: { leadId: lead.id } })
    expect(log?.status).toBe("FAILED")
  })

  itDb("el registro del aviso no guarda el destinatario ni el cuerpo", async () => {
    const { lead, leadRequest } = await createLeadWithRequest()
    await notifyNewLeadRequest(lead, leadRequest)

    const log = await prisma.notificationLog.findFirst({ where: { leadId: lead.id } })
    expect(log?.error).not.toContain("@")
    expect(log?.error).not.toContain("Boda en septiembre")
  })
})
