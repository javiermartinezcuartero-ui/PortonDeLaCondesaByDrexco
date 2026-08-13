import { escapeHtml } from "@/lib/security/text"
import { budgetLabel, eventTypeLabel, spaceLabel } from "@/lib/crm/labels"
import type { EmailContent } from "@/lib/email/provider"
import type { Lead, LeadRequest } from "@prisma/client"

/**
 * Plantillas de correo.
 *
 * Criterios, en orden de importancia:
 *
 * 1. **Accesibilidad.** Cada correo lleva su versión en texto plano (obligatoria en
 *    el contrato del proveedor), `lang="es"`, un `<h1>` real, tablas de datos con
 *    `<th scope="row">` y tablas de maquetación marcadas `role="presentation"` para
 *    que un lector de pantalla no las anuncie como datos. Sin imágenes: nada que
 *    dependa de descargar recursos ni de un `alt` que alguien olvide.
 * 2. **Escapado en origen.** Todo valor pasa por `escapeHtml`. Aquí no hay JSX que
 *    escape por nosotros y el contenido viene de un formulario público.
 * 3. **Simplicidad y responsive.** Estilos en línea (los clientes de correo ignoran
 *    hojas externas y muchos ignoran `<style>`), `max-width: 600px` y una sola
 *    columna, que se adapta sin media queries.
 */

const BRAND = "El Portón de la Condesa"

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"

/** Envoltorio común. `preheader` es la línea de vista previa de la bandeja. */
function layout({ title, preheader, body }: { title: string; preheader: string; body: string }): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f6f4;">
<div style="display:none;font-size:1px;color:#f6f6f4;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f6f4;">
<tr>
<td align="center" style="padding:24px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e5e5e0;">
<tr>
<td style="padding:24px;font-family:${FONT_STACK};font-size:16px;line-height:1.5;color:#1c1c1a;">
${body}
</td>
</tr>
</table>
<p style="margin:16px 0 0;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:#6b6b64;">
${escapeHtml(BRAND)}
</p>
</td>
</tr>
</table>
</body>
</html>`
}

/** Tabla de datos de verdad (no de maquetación): con encabezados de fila. */
function dataTable(rows: Array<[string, string | null | undefined]>): string {
  const visible = rows.filter((row): row is [string, string] => Boolean(row[1]))
  if (visible.length === 0) return ""

  const cells = visible
    .map(
      ([label, value]) =>
        `<tr><th scope="row" align="left" style="padding:6px 12px 6px 0;vertical-align:top;font-weight:600;color:#6b6b64;">${escapeHtml(
          label
        )}</th><td style="padding:6px 0;vertical-align:top;">${escapeHtml(value)}</td></tr>`
    )
    .join("")

  return `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:15px;">${cells}</table>`
}

function textTable(rows: Array<[string, string | null | undefined]>): string {
  return rows
    .filter((row): row is [string, string] => Boolean(row[1]))
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n")
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0 0;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;background-color:#182605;color:#ffffff;text-decoration:none;font-size:15px;">${escapeHtml(
    label
  )}</a></p>`
}

function fullName(lead: Pick<Lead, "firstName" | "lastName">): string | null {
  return [lead.firstName, lead.lastName].filter(Boolean).join(" ") || null
}

function isoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null
}

// ---------------------------------------------------------------------------
// 1. Aviso interno de solicitud nueva
// ---------------------------------------------------------------------------

/**
 * El enlace lleva al **detalle protegido** del CRM, sin token ni parámetro de
 * acceso: quien abra el correo tendrá que iniciar sesión. Un enlace con token en un
 * correo es un acceso permanente a datos personales para cualquiera que reenvíe el
 * mensaje, y no hace falta para que el equipo llegue a su propio panel.
 */
export function buildLeadRequestNotification(
  lead: Lead,
  request: LeadRequest,
  siteUrl: string
): EmailContent {
  const name = fullName(lead)
  const crmUrl = `${siteUrl}/admin/solicitudes/${request.id}`

  const rows: Array<[string, string | null | undefined]> = [
    ["Nombre", name],
    ["Email", lead.email],
    ["Teléfono", lead.phone],
    ["Tipo de evento", eventTypeLabel(request.eventType)],
    ["Fecha prevista", isoDate(request.eventDate)],
    ["Invitados", request.guestCount === null ? null : String(request.guestCount)],
    ["Espacio de interés", spaceLabel(request.preferredSpace)],
    ["Presupuesto", budgetLabel(request.budgetRange)],
    ["Empresa", request.company],
    ["Cargo", request.jobTitle],
    ["Necesidades audiovisuales", request.audiovisualNeeds],
    ["Origen", [request.sourceForm, request.sourcePage].filter(Boolean).join(" · ") || null],
  ]

  const subject = `Nueva solicitud: ${request.subject ?? eventTypeLabel(request.eventType)}`

  const body = `<h1 style="margin:0 0 8px;font-size:20px;line-height:1.3;">Nueva solicitud comercial</h1>
<p style="margin:0 0 20px;color:#6b6b64;font-size:14px;">${escapeHtml(request.subject ?? "Sin asunto")}</p>
${dataTable(rows)}
${
  request.message
    ? `<h2 style="margin:24px 0 8px;font-size:16px;">Mensaje</h2><p style="margin:0;white-space:pre-wrap;">${escapeHtml(
        request.message
      )}</p>`
    : ""
}
${button(crmUrl, "Abrir en el panel")}
<p style="margin:12px 0 0;font-size:13px;color:#6b6b64;">Tendrás que iniciar sesión: el enlace no lleva ningún acceso incorporado.</p>`

  const text = [
    "Nueva solicitud comercial",
    request.subject ?? "",
    "",
    textTable(rows),
    request.message ? `\nMensaje:\n${request.message}` : "",
    "",
    `Abrir en el panel: ${crmUrl}`,
    "Tendrás que iniciar sesión: el enlace no lleva ningún acceso incorporado.",
  ]
    .filter((line) => line !== "")
    .join("\n")

  return { subject, html: layout({ title: subject, preheader: `${name ?? lead.email} · ${eventTypeLabel(request.eventType)}`, body }), text }
}

// ---------------------------------------------------------------------------
// 2. Acuse al visitante
// ---------------------------------------------------------------------------

/**
 * Acuse de recibo. Es un correo **transaccional**: responde a una acción que la
 * persona acaba de hacer, así que no necesita consentimiento de marketing.
 *
 * Precisamente por eso, sin ese consentimiento el correo **solo confirma la
 * recepción**: ni novedades, ni catálogo, ni invitación a nada. Colar contenido
 * promocional en un acuse es exactamente la forma de convertir una base legal
 * transaccional en un envío comercial no consentido.
 *
 * @param includeMarketing solo `true` si consta consentimiento de marketing vigente.
 */
export function buildLeadAcknowledgement(
  lead: Lead,
  request: LeadRequest,
  options: { includeMarketing: boolean }
): EmailContent {
  const name = lead.firstName?.trim()
  const greeting = name ? `Hola ${name},` : "Hola,"

  const rows: Array<[string, string | null | undefined]> = [
    ["Tipo de evento", eventTypeLabel(request.eventType)],
    ["Fecha prevista", isoDate(request.eventDate)],
    ["Invitados", request.guestCount === null ? null : String(request.guestCount)],
    ["Asunto", request.subject],
  ]

  const subject = `Hemos recibido tu solicitud · ${BRAND}`

  const marketingBlock = options.includeMarketing
    ? `<p style="margin:20px 0 0;font-size:14px;color:#6b6b64;">Como nos autorizaste a enviarte comunicaciones comerciales, también te haremos llegar novedades de la finca. Puedes pedirnos que dejemos de hacerlo cuando quieras respondiendo a este correo.</p>`
    : ""

  const body = `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">Hemos recibido tu solicitud</h1>
<p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
<p style="margin:0 0 20px;">Gracias por escribirnos. Hemos registrado tu solicitud y nos pondremos en contacto contigo para hablar de tu celebración.</p>
${dataTable(rows)}
<p style="margin:20px 0 0;font-size:14px;color:#6b6b64;">Este mensaje confirma que tu solicitud llegó correctamente. No hace falta que respondas.</p>
${marketingBlock}`

  const text = [
    "Hemos recibido tu solicitud",
    "",
    greeting,
    "",
    "Gracias por escribirnos. Hemos registrado tu solicitud y nos pondremos en contacto contigo para hablar de tu celebración.",
    "",
    textTable(rows),
    "",
    "Este mensaje confirma que tu solicitud llegó correctamente. No hace falta que respondas.",
    options.includeMarketing
      ? "\nComo nos autorizaste a enviarte comunicaciones comerciales, también te haremos llegar novedades de la finca. Puedes pedirnos que dejemos de hacerlo cuando quieras respondiendo a este correo."
      : "",
  ]
    .filter((line) => line !== "")
    .join("\n")

  return {
    subject,
    html: layout({ title: subject, preheader: "Tu solicitud ha llegado correctamente.", body }),
    text,
  }
}

// ---------------------------------------------------------------------------
// 3. Resumen interno de tareas vencidas
// ---------------------------------------------------------------------------

export type OverdueTaskSummary = {
  id: string
  title: string
  dueAt: Date
  leadId: string
  leadLabel: string
  assigneeName: string | null
}

export function buildOverdueTasksDigest(tasks: OverdueTaskSummary[], siteUrl: string): EmailContent {
  const subject = `${tasks.length} ${tasks.length === 1 ? "tarea vencida" : "tareas vencidas"} en el CRM`

  const items = tasks
    .map(
      (task) =>
        `<li style="margin:0 0 12px;"><strong>${escapeHtml(task.title)}</strong><br>
<span style="color:#6b6b64;font-size:14px;">Venció el ${escapeHtml(isoDate(task.dueAt) ?? "")} · ${escapeHtml(
          task.leadLabel
        )} · ${escapeHtml(task.assigneeName ?? "sin asignar")}</span></li>`
    )
    .join("")

  const body = `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">${escapeHtml(subject)}</h1>
<ul style="margin:0;padding-left:20px;">${items}</ul>
${button(`${siteUrl}/admin/tareas?vista=vencidas`, "Ver tareas vencidas")}`

  const text = [
    subject,
    "",
    ...tasks.map(
      (task) =>
        `- ${task.title} (venció el ${isoDate(task.dueAt)}, ${task.leadLabel}, ${task.assigneeName ?? "sin asignar"})`
    ),
    "",
    `Ver tareas vencidas: ${siteUrl}/admin/tareas?vista=vencidas`,
  ].join("\n")

  return { subject, html: layout({ title: subject, preheader: subject, body }), text }
}

// ---------------------------------------------------------------------------
// 4. Verificación del email de acceso VIP — PREPARADA, NO ACTIVA
// ---------------------------------------------------------------------------

/**
 * Plantilla del futuro correo de verificación del acceso VIP.
 *
 * **No está activa y nada la invoca en producción.** El gate concede acceso
 * inmediato tras capturar el email (decisión de la Fase 5, ver docs/gate-vip.md
 * §3); esto es la mitad que se puede escribir y probar hoy sin flujo vivo.
 *
 * Para activarla harían falta tres piezas que **no** existen todavía:
 *
 * 1. una ruta que consuma el enlace, valide el token contra `Verification` y cree
 *    la `VipAccessSession` solo entonces;
 * 2. que el gate deje de conceder acceso al enviar el formulario y pase a
 *    "revisa tu correo";
 * 3. una caducidad corta del enlace y un límite de reenvíos.
 *
 * A diferencia del enlace al CRM, este **sí** lleva token: es su único propósito,
 * y por eso la ruta que lo consuma tendrá que invalidarlo en el primer uso.
 */
export function buildVipVerificationEmail(verifyUrl: string): EmailContent {
  const subject = `Confirma tu email para acceder · ${BRAND}`

  const body = `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">Confirma tu email</h1>
<p style="margin:0 0 20px;">Pulsa el botón para confirmar tu dirección y acceder a las bibliotecas de bodas reales y catering.</p>
${button(verifyUrl, "Confirmar mi email")}
<p style="margin:20px 0 0;font-size:14px;color:#6b6b64;">Si no has pedido este acceso, puedes ignorar este mensaje.</p>`

  const text = [
    "Confirma tu email",
    "",
    "Pulsa el enlace para confirmar tu dirección y acceder a las bibliotecas de bodas reales y catering:",
    verifyUrl,
    "",
    "Si no has pedido este acceso, puedes ignorar este mensaje.",
  ].join("\n")

  return { subject, html: layout({ title: subject, preheader: "Confirma tu email para acceder.", body }), text }
}
