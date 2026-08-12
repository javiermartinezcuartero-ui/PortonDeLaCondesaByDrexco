import "server-only"

import { prisma } from "@/lib/db"
import { escapeHtml } from "@/lib/security/text"
import type { Lead, LeadRequest } from "@prisma/client"

/**
 * Aviso interno de solicitud nueva.
 *
 * Se invoca **después** del commit de la solicitud y siempre desde un
 * `catch`/`void`: el correo es un efecto secundario, no parte de la captación.
 * Si el proveedor no está configurado, falla o tarda, la solicitud ya está
 * guardada y el visitante ya ha visto su confirmación. Esa es la regla que
 * gobierna este módulo: **nunca puede hacer fallar un envío de formulario**.
 *
 * Todavía no hay proveedor de correo integrado (SendGrid se decidirá al montar
 * el CRM, Fase 7). Hasta entonces esto deja constancia en `NotificationLog` con
 * estado PENDING, de modo que ninguna solicitud se quede sin rastro de que
 * había que avisar de ella, y el día que exista transporte solo hay que
 * rellenar `deliver()`.
 */

export type LeadNotificationResult =
  | { delivered: true }
  | { delivered: false; reason: "not-configured" | "failed" }

const TEMPLATE = "lead-request-created"

function isEmailConfigured(): boolean {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.LEAD_NOTIFICATION_TO)
}

/**
 * Cuerpo del aviso. `escapeHtml` sobre cada valor porque aquí no hay JSX que
 * escape por nosotros: el asunto y el mensaje son texto libre de un formulario
 * público (ver lib/security/text.ts).
 */
export function buildLeadNotificationHtml(lead: Lead, leadRequest: LeadRequest): string {
  const rows: Array<[string, string | null]> = [
    ["Nombre", [lead.firstName, lead.lastName].filter(Boolean).join(" ") || null],
    ["Email", lead.email],
    ["Teléfono", lead.phone],
    ["Tipo de evento", leadRequest.eventType],
    ["Fecha prevista", leadRequest.eventDate ? leadRequest.eventDate.toISOString().slice(0, 10) : null],
    ["Invitados", leadRequest.guestCount === null ? null : String(leadRequest.guestCount)],
    ["Espacio preferido", leadRequest.preferredSpace],
    ["Presupuesto", leadRequest.budgetRange],
    ["Empresa", leadRequest.company],
    ["Cargo", leadRequest.jobTitle],
    ["Necesidades audiovisuales", leadRequest.audiovisualNeeds],
    ["Asunto", leadRequest.subject],
    ["Mensaje", leadRequest.message],
    ["Origen", [leadRequest.sourceForm, leadRequest.sourcePage].filter(Boolean).join(" · ") || null],
  ]

  const body = rows
    .filter((row): row is [string, string] => Boolean(row[1]))
    .map(([label, value]) => `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join("")

  return `<h1>Nueva solicitud comercial</h1><table>${body}</table>`
}

async function deliver(lead: Lead, leadRequest: LeadRequest): Promise<LeadNotificationResult> {
  // Sin configuración no hay nada que intentar, y no es un error: el proyecto
  // funciona igual sin proveedor de correo.
  if (!isEmailConfigured()) return { delivered: false, reason: "not-configured" }

  // TODO(fase-crm): enviar `buildLeadNotificationHtml(lead, leadRequest)` a
  // `LEAD_NOTIFICATION_TO` con SendGrid. Hasta que exista transporte, tener las
  // variables puestas no puede hacer creer que el aviso salió: se lanza para
  // que el fallo quede registrado como tal, sin tocar la solicitud guardada.
  void buildLeadNotificationHtml(lead, leadRequest)
  throw new Error("Transporte de correo no implementado todavía")
}

/**
 * Registra y (cuando haya transporte) envía el aviso. No lanza nunca: cualquier
 * fallo se traga aquí y se anota en `NotificationLog`.
 */
export async function notifyNewLeadRequest(lead: Lead, leadRequest: LeadRequest): Promise<LeadNotificationResult> {
  let result: LeadNotificationResult

  try {
    result = await deliver(lead, leadRequest)
  } catch (error) {
    result = { delivered: false, reason: "failed" }
    // Sin PII en el log: solo el identificador de la solicitud y el motivo.
    console.error("[leads] fallo al enviar el aviso de solicitud nueva", {
      leadRequestId: leadRequest.id,
      error: error instanceof Error ? error.message : "desconocido",
    })
  }

  const status = result.delivered ? "SENT" : result.reason === "not-configured" ? "PENDING" : "FAILED"

  try {
    await prisma.notificationLog.create({
      data: {
        leadId: lead.id,
        channel: "EMAIL",
        template: TEMPLATE,
        status,
        sentAt: result.delivered ? new Date() : null,
        // Motivo corto y sin PII: nunca el cuerpo ni el email de destino.
        error: result.delivered ? null : `sin entregar: ${result.reason}`,
      },
    })
  } catch {
    // Ni el registro del aviso puede tumbar la captación.
  }

  return result
}
