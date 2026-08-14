import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db"
import { itDb, uniqueTestEmail } from "@/lib/domain/test-helpers"
import type { EmailConfig } from "@/lib/email/config"
import {
  TEMPLATE_ACKNOWLEDGEMENT,
  TEMPLATE_INTERNAL,
  hasMarketingConsent,
  notifyNewLeadRequest,
} from "@/lib/notifications/lead-request-notification"
import type { Lead, LeadRequest } from "@prisma/client"

/**
 * Avisos de una solicitud nueva. La regla que se comprueba en todo el archivo:
 * **el correo nunca puede afectar a lo que ya está guardado**, y el registro tiene
 * que contar la verdad de lo ocurrido sin guardar datos personales de más.
 */

const API_KEY = "SG.clave-de-prueba"
const createdEmails: string[] = []

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "id-de-prueba" }), { status: 200 }))
  vi.stubGlobal("fetch", fetchMock)
  vi.spyOn(console, "info").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()

  if (createdEmails.length) {
    await prisma.lead.deleteMany({ where: { emailNormalized: { in: createdEmails } } })
    createdEmails.length = 0
  }
})

/** Config explícita en cada test: nada depende del `.env` de la máquina. */
function config(overrides: Partial<EmailConfig> = {}): EmailConfig {
  return {
    apiKey: API_KEY,
    from: "avisos@porton.test",
    notificationTo: ["equipo@porton.test"],
    sendAcknowledgement: false,
    siteUrl: "https://elportondelacondesa.com",
    ...overrides,
  }
}

async function createLeadWithRequest(overrides: { marketing?: boolean } = {}): Promise<{
  lead: Lead
  request: LeadRequest
}> {
  const email = uniqueTestEmail("aviso")
  createdEmails.push(email.toLowerCase())

  const lead = await prisma.lead.create({
    data: {
      email,
      emailNormalized: email.toLowerCase(),
      firstName: "Ana",
      lastName: "García",
      phone: "+34600112233",
    },
  })

  if (overrides.marketing !== undefined) {
    await prisma.consentEvent.create({
      data: { leadId: lead.id, purpose: "MARKETING", granted: overrides.marketing, policyVersion: "2026-08" },
    })
  }

  const request = await prisma.leadRequest.create({
    data: {
      leadId: lead.id,
      eventType: "WEDDING",
      subject: "Boda en septiembre",
      message: "Queremos visitar la finca",
      guestCount: 150,
    },
  })

  return { lead, request }
}

function logsFor(leadId: string) {
  return prisma.notificationLog.findMany({ where: { leadId }, orderBy: { createdAt: "asc" } })
}

describe("aviso interno", () => {
  itDb("con proveedor configurado se envía y se registra como SENT", async () => {
    const { lead, request } = await createLeadWithRequest()

    const outcome = await notifyNewLeadRequest(lead, request, config())

    expect(outcome.internal).toBe("SENT")
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [log] = await logsFor(lead.id)
    expect(log.template).toBe(TEMPLATE_INTERNAL)
    expect(log.status).toBe("SENT")
    expect(log.provider).toBe("resend")
    expect(log.sentAt).not.toBeNull()
    expect(log.error).toBeNull()
  })

  itDb("sin configuración no se envía nada y queda SKIPPED_CONFIG", async () => {
    const { lead, request } = await createLeadWithRequest()

    const outcome = await notifyNewLeadRequest(lead, request, config({ apiKey: undefined, from: undefined }))

    expect(outcome.internal).toBe("SKIPPED_CONFIG")
    expect(fetchMock).not.toHaveBeenCalled()

    const [log] = await logsFor(lead.id)
    expect(log.status).toBe("SKIPPED_CONFIG")
    expect(log.provider).toBe("development")
    expect(log.sentAt).toBeNull()
  })

  itDb("sin destinatarios internos no llama al proveedor", async () => {
    const { lead, request } = await createLeadWithRequest()

    const outcome = await notifyNewLeadRequest(lead, request, config({ notificationTo: [] }))

    expect(outcome.internal).toBe("SKIPPED_CONFIG")
    expect(fetchMock).not.toHaveBeenCalled()

    const [log] = await logsFor(lead.id)
    expect(log.error).toContain("sin destinatarios")
    expect(log.recipients).toBeNull()
  })

  itDb("un fallo transitorio del proveedor queda RETRY_PENDING sin tocar lo guardado", async () => {
    const { lead, request } = await createLeadWithRequest()
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }))

    const outcome = await notifyNewLeadRequest(lead, request, config())

    expect(outcome.internal).toBe("RETRY_PENDING")

    // Lo esencial: la solicitud y el contacto siguen exactamente donde estaban.
    expect(await prisma.leadRequest.findUnique({ where: { id: request.id } })).not.toBeNull()
    expect(await prisma.lead.findUnique({ where: { id: lead.id } })).not.toBeNull()

    const [log] = await logsFor(lead.id)
    expect(log.status).toBe("RETRY_PENDING")
    expect(log.sentAt).toBeNull()
  })

  itDb("un fallo permanente queda FAILED sin tocar lo guardado", async () => {
    const { lead, request } = await createLeadWithRequest()
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))

    const outcome = await notifyNewLeadRequest(lead, request, config())

    expect(outcome.internal).toBe("FAILED")
    expect(await prisma.leadRequest.findUnique({ where: { id: request.id } })).not.toBeNull()
    expect((await logsFor(lead.id))[0].status).toBe("FAILED")
  })

  itDb("una excepción del proveedor tampoco se propaga", async () => {
    const { lead, request } = await createLeadWithRequest()
    fetchMock.mockImplementation(() => {
      throw new Error("el adaptador se rompió")
    })

    // No lanza: devuelve un estado.
    const outcome = await notifyNewLeadRequest(lead, request, config())

    expect(outcome.internal).toBe("RETRY_PENDING")
    expect(await prisma.leadRequest.findUnique({ where: { id: request.id } })).not.toBeNull()
  })

  itDb("responder al aviso escribe a quien preguntó, no al buzón de avisos", async () => {
    const { lead, request } = await createLeadWithRequest()

    await notifyNewLeadRequest(lead, request, config())

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))
    expect(body.reply_to).toBe(lead.email)
    expect(body.to).toEqual(["equipo@porton.test"])
  })

  itDb("el enlace del correo apunta al detalle protegido y sin token", async () => {
    const { lead, request } = await createLeadWithRequest()

    await notifyNewLeadRequest(lead, request, config({ siteUrl: "https://porton.test" }))

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))
    const html = body.html as string
    expect(html).toContain(`https://porton.test/admin/solicitudes/${request.id}`)
    expect(html).not.toContain("token")
  })
})

describe("acuse al visitante", () => {
  itDb("desactivado no se envía y se marca como DISABLED", async () => {
    const { lead, request } = await createLeadWithRequest()

    const outcome = await notifyNewLeadRequest(lead, request, config({ sendAcknowledgement: false }))

    expect(outcome.acknowledgement).toBe("DISABLED")
    // Solo el aviso interno.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const logs = await logsFor(lead.id)
    expect(logs.map((log) => log.template)).toEqual([TEMPLATE_INTERNAL])
  })

  itDb("activado se envía al visitante y se registra por separado", async () => {
    const { lead, request } = await createLeadWithRequest()

    const outcome = await notifyNewLeadRequest(lead, request, config({ sendAcknowledgement: true }))

    expect(outcome.internal).toBe("SENT")
    expect(outcome.acknowledgement).toBe("SENT")
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const logs = await logsFor(lead.id)
    expect(logs.map((log) => log.template).sort()).toEqual([TEMPLATE_ACKNOWLEDGEMENT, TEMPLATE_INTERNAL].sort())
  })

  itDb("sin consentimiento de marketing el acuse solo confirma la recepción", async () => {
    const { lead, request } = await createLeadWithRequest()

    await notifyNewLeadRequest(lead, request, config({ sendAcknowledgement: true }))

    const ackCall = fetchMock.mock.calls[1] as [string, RequestInit]
    const body = JSON.parse(String(ackCall[1].body))
    const text = body.text as string

    expect(body.to).toEqual([lead.email])
    expect(text).toContain("Hemos recibido tu solicitud")
    expect(text.toLowerCase()).not.toContain("comunicaciones comerciales")
    expect(text.toLowerCase()).not.toContain("novedades")
  })

  itDb("con consentimiento concedido el acuse puede incluir la parte comercial", async () => {
    const { lead, request } = await createLeadWithRequest({ marketing: true })

    await notifyNewLeadRequest(lead, request, config({ sendAcknowledgement: true }))

    const body = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body))
    const text = body.text as string
    expect(text.toLowerCase()).toContain("comunicaciones comerciales")
  })

  itDb("un consentimiento revocado no reactiva la parte comercial", async () => {
    const { lead, request } = await createLeadWithRequest({ marketing: true })
    // Revocación posterior: se mira el último evento, no si existe alguno concedido.
    await prisma.consentEvent.create({
      data: { leadId: lead.id, purpose: "MARKETING", granted: false, policyVersion: "2026-08" },
    })

    expect(await hasMarketingConsent(lead.id)).toBe(false)

    await notifyNewLeadRequest(lead, request, config({ sendAcknowledgement: true }))

    const body = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body))
    const text = body.text as string
    expect(text.toLowerCase()).not.toContain("comunicaciones comerciales")
  })

  itDb("si falla el acuse, el aviso interno sigue registrado como enviado", async () => {
    const { lead, request } = await createLeadWithRequest()
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "id-de-prueba" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))

    const outcome = await notifyNewLeadRequest(lead, request, config({ sendAcknowledgement: true }))

    expect(outcome.internal).toBe("SENT")
    expect(outcome.acknowledgement).toBe("RETRY_PENDING")

    const logs = await logsFor(lead.id)
    const internal = logs.find((log) => log.template === TEMPLATE_INTERNAL)
    const ack = logs.find((log) => log.template === TEMPLATE_ACKNOWLEDGEMENT)
    expect(internal?.status).toBe("SENT")
    expect(ack?.status).toBe("RETRY_PENDING")
  })
})

describe("el registro no guarda lo que no debe", () => {
  itDb("guarda los destinatarios enmascarados, no las direcciones", async () => {
    const { lead, request } = await createLeadWithRequest()

    await notifyNewLeadRequest(lead, request, config({ sendAcknowledgement: true }))

    const logs = await logsFor(lead.id)
    for (const log of logs) {
      expect(log.recipients).not.toBeNull()
      expect(log.recipients).toContain("***")
      expect(log.recipients).not.toContain("equipo@porton.test")
      expect(log.recipients).not.toContain(lead.email)
    }
  })

  itDb("no guarda el cuerpo, el asunto ni la clave de API", async () => {
    const { lead, request } = await createLeadWithRequest()
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))

    await notifyNewLeadRequest(lead, request, config({ sendAcknowledgement: true }))

    const logs = await logsFor(lead.id)
    const serialized = JSON.stringify(logs)
    expect(serialized).not.toContain("Queremos visitar la finca")
    expect(serialized).not.toContain("Boda en septiembre")
    expect(serialized).not.toContain(API_KEY)
    expect(serialized).not.toContain("SG.")
  })

  itDb("los mensajes de consola no filtran el cuerpo ni la dirección completa", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const { lead, request } = await createLeadWithRequest()

    await notifyNewLeadRequest(lead, request, config({ apiKey: undefined, from: undefined, sendAcknowledgement: true }))

    const logged = JSON.stringify([...info.mock.calls, ...error.mock.calls])
    expect(logged).not.toContain("Queremos visitar la finca")
    expect(logged).not.toContain(lead.email)
    expect(logged).not.toContain("equipo@porton.test")
  })
})
