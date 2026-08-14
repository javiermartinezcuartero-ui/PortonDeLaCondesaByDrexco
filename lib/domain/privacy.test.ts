import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db"
import { itDb, uniqueTestEmail } from "@/lib/domain/test-helpers"
import {
  anonymizeLead,
  exportLeadPersonalData,
  findLeadsBeyondRetention,
  retentionCutoff,
  retentionMonths,
  revokeAllVipSessions,
  revokeMarketingConsent,
} from "@/lib/domain/privacy"
import { randomBytes } from "node:crypto"
import { hashVipToken } from "@/lib/security/hash"
import { hasMarketingConsent } from "@/lib/notifications/lead-request-notification"

const createdEmails: string[] = []
const createdUserIds: string[] = []
const originalRetention = process.env.DATA_RETENTION_MONTHS

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(async () => {
  vi.restoreAllMocks()

  if (originalRetention === undefined) delete process.env.DATA_RETENTION_MONTHS
  else process.env.DATA_RETENTION_MONTHS = originalRetention

  if (createdEmails.length) {
    await prisma.lead.deleteMany({ where: { emailNormalized: { in: createdEmails } } })
    createdEmails.length = 0
  }
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
    createdUserIds.length = 0
  }
})

async function createLead(overrides: Record<string, unknown> = {}) {
  const email = uniqueTestEmail("privacidad")
  createdEmails.push(email.toLowerCase())
  return prisma.lead.create({
    data: {
      email,
      emailNormalized: email.toLowerCase(),
      firstName: "Ana",
      lastName: "García",
      phone: "+34600112233",
      phoneNormalized: "+34600112233",
      ...overrides,
    },
  })
}

async function createActor() {
  const user = await prisma.user.create({
    data: { name: "Admin de prueba", email: uniqueTestEmail("actor"), role: "ADMIN" },
  })
  createdUserIds.push(user.id)
  return user
}

// ---------------------------------------------------------------------------
// Retención
// ---------------------------------------------------------------------------

describe("retención configurable", () => {
  it("usa 36 meses por defecto y admite configuración", () => {
    delete process.env.DATA_RETENTION_MONTHS
    expect(retentionMonths()).toBe(36)

    process.env.DATA_RETENTION_MONTHS = "12"
    expect(retentionMonths()).toBe(12)
  })

  it("ignora valores absurdos en vez de aplicarlos", () => {
    for (const value of ["0", "-5", "9999", "abc", ""]) {
      process.env.DATA_RETENTION_MONTHS = value
      expect(retentionMonths()).toBe(36)
    }
  })

  it("el corte queda en el pasado", () => {
    process.env.DATA_RETENTION_MONTHS = "12"
    const cutoff = retentionCutoff(new Date("2027-06-15T00:00:00.000Z"))
    expect(cutoff.toISOString().slice(0, 7)).toBe("2026-06")
  })

  itDb("identifica contactos inactivos y excluye los que tienen una negociación viva", async () => {
    process.env.DATA_RETENTION_MONTHS = "12"

    const stale = await createLead({
      firstSeenAt: new Date("2020-01-01T00:00:00.000Z"),
      lastActivityAt: new Date("2020-02-01T00:00:00.000Z"),
    })
    const staleButOpen = await createLead({
      firstSeenAt: new Date("2020-01-01T00:00:00.000Z"),
      lastActivityAt: new Date("2020-02-01T00:00:00.000Z"),
    })
    await prisma.leadRequest.create({
      data: { leadId: staleButOpen.id, eventType: "WEDDING", status: "PROPOSAL" },
    })
    const recent = await createLead({ lastActivityAt: new Date() })

    const candidates = await findLeadsBeyondRetention(new Date(), 500)
    const ids = candidates.map((row) => row.id)

    expect(ids).toContain(stale.id)
    // Mientras haya una negociación abierta, el dato sigue siendo necesario.
    expect(ids).not.toContain(staleButOpen.id)
    expect(ids).not.toContain(recent.id)
  })

  itDb("no propone un contacto ya anonimizado", async () => {
    process.env.DATA_RETENTION_MONTHS = "12"
    const lead = await createLead({ firstSeenAt: new Date("2020-01-01T00:00:00.000Z"), lastActivityAt: null })
    await anonymizeLead(lead.id)

    const candidates = await findLeadsBeyondRetention(new Date(), 500)
    expect(candidates.map((row) => row.id)).not.toContain(lead.id)
  })
})

// ---------------------------------------------------------------------------
// Exportación de datos personales
// ---------------------------------------------------------------------------

describe("exportLeadPersonalData", () => {
  itDb("incluye todo lo que consta de la persona, notas incluidas", async () => {
    const lead = await createLead()
    const actor = await createActor()
    await prisma.leadRequest.create({
      data: { leadId: lead.id, eventType: "WEDDING", subject: "Boda", message: "Queremos visitar" },
    })
    await prisma.leadNote.create({ data: { leadId: lead.id, body: "Nota interna sobre Ana" } })
    await prisma.consentEvent.create({
      data: { leadId: lead.id, purpose: "PRIVACY", granted: true, policyVersion: "2026-08" },
    })

    const data = await exportLeadPersonalData(lead.id, actor.id)

    expect(data.contacto.email).toBe(lead.email)
    expect(data.solicitudes).toHaveLength(1)
    // El derecho de acceso incluye las notas: son datos sobre ella.
    expect(data.notasInternas[0].texto).toBe("Nota interna sobre Ana")
    expect(data.consentimientos).toHaveLength(1)
  })

  itDb("no incluye el hash del token de sus sesiones", async () => {
    const lead = await createLead()
    const actor = await createActor()
    const tokenHash = hashVipToken(randomBytes(16).toString("hex"))
    await prisma.vipAccessSession.create({
      data: { leadId: lead.id, tokenHash, expiresAt: new Date(Date.now() + 60_000) },
    })

    const data = await exportLeadPersonalData(lead.id, actor.id)
    const serialized = JSON.stringify(data)

    // El hash es un secreto del sistema, no un dato de la persona.
    expect(serialized).not.toContain(tokenHash)
    expect(data.sesionesDeAcceso).toHaveLength(1)
  })

  itDb("deja un evento de auditoría de quién pidió la copia", async () => {
    const lead = await createLead()
    const actor = await createActor()

    await exportLeadPersonalData(lead.id, actor.id)

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityType: "Lead", entityId: lead.id, action: "privacy.export" },
    })
    expect(audit.actorId).toBe(actor.id)
  })

  itDb("falla con un contacto inexistente en vez de devolver un objeto vacío", async () => {
    const actor = await createActor()
    await expect(exportLeadPersonalData("no-existe", actor.id)).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Revocaciones
// ---------------------------------------------------------------------------

describe("revocación de marketing", () => {
  itDb("añade un evento granted=false sin borrar el anterior", async () => {
    const lead = await createLead()
    const actor = await createActor()
    await prisma.consentEvent.create({
      data: { leadId: lead.id, purpose: "MARKETING", granted: true, policyVersion: "2026-08" },
    })

    expect(await hasMarketingConsent(lead.id)).toBe(true)

    await revokeMarketingConsent({ leadId: lead.id, actorId: actor.id, policyVersion: "2026-08" })

    const events = await prisma.consentEvent.findMany({
      where: { leadId: lead.id, purpose: "MARKETING" },
      orderBy: { createdAt: "asc" },
    })
    // El historial no se destruye: consintió y luego revocó, y las dos cosas constan.
    expect(events).toHaveLength(2)
    expect(events[0].granted).toBe(true)
    expect(events[1].granted).toBe(false)
    expect(await hasMarketingConsent(lead.id)).toBe(false)
  })

  itDb("queda auditada", async () => {
    const lead = await createLead()
    const actor = await createActor()
    await revokeMarketingConsent({ leadId: lead.id, actorId: actor.id, policyVersion: "2026-08" })

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityId: lead.id, action: "privacy.marketing.revoke" },
    })
    expect(audit.actorId).toBe(actor.id)
  })
})

describe("revocación de sesiones VIP", () => {
  itDb("revoca todas las activas y deja las ya revocadas en paz", async () => {
    const lead = await createLead()
    const actor = await createActor()

    const active = await prisma.vipAccessSession.create({
      data: { leadId: lead.id, tokenHash: hashVipToken(randomBytes(16).toString("hex")), expiresAt: new Date(Date.now() + 60_000) },
    })
    const alreadyRevoked = await prisma.vipAccessSession.create({
      data: {
        leadId: lead.id,
        tokenHash: hashVipToken(randomBytes(16).toString("hex")),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    })

    const count = await revokeAllVipSessions({ leadId: lead.id, actorId: actor.id })
    expect(count).toBe(1)

    const after = await prisma.vipAccessSession.findMany({ where: { leadId: lead.id } })
    expect(after.every((session) => session.revokedAt !== null)).toBe(true)
    // No se reescribe la fecha de una revocación anterior.
    const untouched = after.find((session) => session.id === alreadyRevoked.id)
    expect(untouched?.revokedAt?.toISOString()).toBe("2020-01-01T00:00:00.000Z")
    expect(after.find((session) => session.id === active.id)?.revokedAt).not.toBeNull()
  })

  itDb("sin sesiones activas no inventa un evento de auditoría", async () => {
    const lead = await createLead()
    const actor = await createActor()

    const count = await revokeAllVipSessions({ leadId: lead.id, actorId: actor.id })

    expect(count).toBe(0)
    expect(
      await prisma.auditEvent.count({ where: { entityId: lead.id, action: "privacy.vip.revoke" } })
    ).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Anonimización
// ---------------------------------------------------------------------------

describe("anonymizeLead", () => {
  itDb("sustituye los identificadores por valores no reversibles", async () => {
    const lead = await createLead()
    const original = lead.email

    const { lead: anonymized } = await anonymizeLead(lead.id)

    expect(anonymized.email).not.toBe(original)
    expect(anonymized.email).toContain("@example.invalid")
    expect(anonymized.firstName).toBeNull()
    expect(anonymized.lastName).toBeNull()
    expect(anonymized.phone).toBeNull()
    expect(anonymized.phoneNormalized).toBeNull()
    expect(anonymized.lifecycle).toBe("ANONYMIZED")
    expect(anonymized.anonymizedAt).not.toBeNull()
  })

  itDb("vacía el texto libre de las solicitudes y conserva lo agregable", async () => {
    const lead = await createLead()
    await prisma.leadRequest.create({
      data: {
        leadId: lead.id,
        eventType: "CORPORATE_EVENT",
        subject: "Convención de Ana",
        message: "Soy Ana, mi teléfono es 600112233",
        company: "Empresa de Ana",
        jobTitle: "Directora",
        audiovisualNeeds: "Streaming para Ana",
        lostReason: "Motivo con su nombre",
        guestCount: 200,
        preferredSpace: "salon-cristal",
        utmSource: "instagram",
        status: "LOST",
      },
    })

    const summary = await anonymizeLead(lead.id)
    expect(summary.requestsCleared).toBe(1)

    const request = await prisma.leadRequest.findFirstOrThrow({ where: { leadId: lead.id } })
    for (const field of [request.subject, request.message, request.company, request.jobTitle, request.audiovisualNeeds, request.lostReason]) {
      expect(field).toBeNull()
    }
    // Lo agregable sobrevive: las métricas del CRM siguen cuadrando.
    expect(request.eventType).toBe("CORPORATE_EVENT")
    expect(request.guestCount).toBe(200)
    expect(request.preferredSpace).toBe("salon-cristal")
    expect(request.utmSource).toBe("instagram")
    expect(request.status).toBe("LOST")
  })

  itDb("borra las notas internas", async () => {
    const lead = await createLead()
    await prisma.leadNote.create({ data: { leadId: lead.id, body: "Opinión sobre Ana" } })
    await prisma.leadNote.create({ data: { leadId: lead.id, body: "Otra nota" } })

    const summary = await anonymizeLead(lead.id)

    expect(summary.notesDeleted).toBe(2)
    expect(await prisma.leadNote.count({ where: { leadId: lead.id } })).toBe(0)
  })

  itDb("revoca las sesiones VIP", async () => {
    const lead = await createLead()
    await prisma.vipAccessSession.create({
      data: { leadId: lead.id, tokenHash: hashVipToken(randomBytes(16).toString("hex")), expiresAt: new Date(Date.now() + 60_000) },
    })

    const summary = await anonymizeLead(lead.id)

    expect(summary.vipSessionsRevoked).toBe(1)
    const sessions = await prisma.vipAccessSession.findMany({ where: { leadId: lead.id } })
    expect(sessions.every((session) => session.revokedAt !== null)).toBe(true)
  })

  itDb("limpia los destinatarios de los avisos", async () => {
    const lead = await createLead()
    await prisma.notificationLog.create({
      data: { leadId: lead.id, template: "x", status: "SENT", recipients: "a***a@example.test" },
    })

    const summary = await anonymizeLead(lead.id)

    expect(summary.notificationsCleared).toBe(1)
    const log = await prisma.notificationLog.findFirstOrThrow({ where: { leadId: lead.id } })
    expect(log.recipients).toBeNull()
  })

  itDb("conserva la auditoría y los consentimientos como prueba del tratamiento", async () => {
    const lead = await createLead()
    const actor = await createActor()
    await prisma.consentEvent.create({
      data: { leadId: lead.id, purpose: "PRIVACY", granted: true, policyVersion: "2026-08" },
    })

    await anonymizeLead(lead.id, actor.id)

    // El consentimiento sigue: es la prueba de que el tratamiento fue legítimo.
    expect(await prisma.consentEvent.count({ where: { leadId: lead.id } })).toBe(1)
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityId: lead.id, action: "privacy.anonymize" },
    })
    expect(audit.actorId).toBe(actor.id)
    expect((audit.metadata as { notasBorradas?: number }).notasBorradas).toBe(0)
  })

  itDb("es transaccional: un contacto inexistente no deja nada a medias", async () => {
    await expect(anonymizeLead("no-existe")).rejects.toThrow()
    expect(await prisma.auditEvent.count({ where: { entityId: "no-existe" } })).toBe(0)
  })

  itDb("no se puede anonimizar dos veces", async () => {
    const lead = await createLead()
    await anonymizeLead(lead.id)
    await expect(anonymizeLead(lead.id)).rejects.toThrow()
  })

  itDb("el email anonimizado usa un dominio que nunca podrá existir", async () => {
    const lead = await createLead()
    const { lead: anonymized } = await anonymizeLead(lead.id)
    // `.invalid` es un TLD reservado (RFC 2606): no hay riesgo de escribir por
    // error a un buzón real.
    expect(anonymized.email.endsWith(".invalid")).toBe(true)
  })
})
