import "server-only"

import { prisma } from "@/lib/db"
import { readEmailConfig, resolveEmailProvider, type EmailConfig } from "@/lib/email"
import type { EmailContent, EmailProvider, EmailSendResult } from "@/lib/email/provider"
import { buildLeadAcknowledgement, buildLeadRequestNotification } from "@/lib/email/templates"
import { recordNotification } from "@/lib/notifications/record"
import type { Lead, LeadRequest } from "@prisma/client"

/**
 * Avisos de una solicitud comercial nueva: el interno al equipo y el acuse al
 * visitante.
 *
 * Regla que gobierna el módulo entero: **la base de datos es la fuente de verdad y
 * el correo es un efecto secundario**. Cuando esto se ejecuta, la solicitud ya está
 * confirmada en base de datos y el visitante ya ha visto su confirmación. Por eso
 * nada de aquí lanza: cualquier fallo se registra y se devuelve como estado, nunca
 * se propaga a quien envió el formulario.
 */

export const TEMPLATE_INTERNAL = "lead-request-created"
export const TEMPLATE_ACKNOWLEDGEMENT = "lead-request-acknowledgement"

export type NotificationStatusCode = EmailSendResult["status"]

export type LeadNotificationOutcome = {
  internal: NotificationStatusCode
  /** `"DISABLED"` cuando `SEND_LEAD_ACKNOWLEDGEMENT` no está activado. */
  acknowledgement: NotificationStatusCode | "DISABLED"
}

/**
 * ¿Consta consentimiento de marketing vigente?
 *
 * Se mira el **último** evento del propósito, no si existe alguno concedido: el día
 * que se registren revocaciones (`granted=false`), esta consulta ya responde bien
 * sin tocarla. Ante cualquier error de lectura devuelve `false`: no saber si hay
 * consentimiento equivale a no tenerlo.
 */
export async function hasMarketingConsent(leadId: string): Promise<boolean> {
  try {
    const latest = await prisma.consentEvent.findFirst({
      where: { leadId, purpose: "MARKETING" },
      orderBy: { createdAt: "desc" },
      select: { granted: true },
    })
    return latest?.granted === true
  } catch {
    return false
  }
}

/** Envía un contenido y registra el resultado. No lanza. */
async function deliver(
  provider: EmailProvider,
  content: EmailContent,
  options: { to: string[]; replyTo?: string; template: string; leadId: string | null }
): Promise<NotificationStatusCode> {
  if (options.to.length === 0) {
    const result: EmailSendResult = { status: "SKIPPED_CONFIG", reason: "sin destinatarios configurados" }
    await recordNotification({ ...options, provider: provider.name, recipients: [], result })
    return result.status
  }

  let result: EmailSendResult
  try {
    result = await provider.send({
      to: options.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: options.replyTo,
    })
  } catch (error) {
    // El contrato dice que `send` no lanza, pero un adaptador futuro podría
    // incumplirlo y eso no puede convertirse en una excepción sin registrar.
    result = {
      status: "FAILED",
      reason: `el proveedor lanzó: ${error instanceof Error ? error.message : "error desconocido"}`,
    }
  }

  await recordNotification({
    leadId: options.leadId,
    template: options.template,
    provider: provider.name,
    recipients: options.to,
    result,
  })

  return result.status
}

/**
 * Avisa de una solicitud nueva. Se invoca **después** del commit, desde
 * `runAfterResponse`.
 */
export async function notifyNewLeadRequest(
  lead: Lead,
  request: LeadRequest,
  config: EmailConfig = readEmailConfig()
): Promise<LeadNotificationOutcome> {
  const provider = resolveEmailProvider(config)

  // El aviso interno lleva `replyTo` con el email de la persona: así responder
  // desde el correo escribe a quien preguntó, no al buzón de avisos.
  const internal = await deliver(provider, buildLeadRequestNotification(lead, request, config.siteUrl), {
    to: config.notificationTo,
    replyTo: lead.email,
    template: TEMPLATE_INTERNAL,
    leadId: lead.id,
  })

  if (!config.sendAcknowledgement) {
    return { internal, acknowledgement: "DISABLED" }
  }

  // El acuse es transaccional y no necesita consentimiento de marketing; el
  // consentimiento solo decide si el correo puede incluir algo más que la
  // confirmación (ver lib/email/templates.ts).
  const includeMarketing = await hasMarketingConsent(lead.id)

  const acknowledgement = await deliver(
    provider,
    buildLeadAcknowledgement(lead, request, { includeMarketing }),
    {
      to: [lead.email],
      template: TEMPLATE_ACKNOWLEDGEMENT,
      leadId: lead.id,
    }
  )

  return { internal, acknowledgement }
}
