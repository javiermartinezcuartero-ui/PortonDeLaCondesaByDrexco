import "server-only"

import { prisma } from "@/lib/db"
import { maskEmails } from "@/lib/email/config"
import type { EmailSendResult } from "@/lib/email/provider"

/**
 * Escribe el resultado de un intento de aviso en `NotificationLog`.
 *
 * **No lanza nunca.** Ni el registro de un aviso puede tumbar la operación que lo
 * originó: si la escritura falla, se pierde la traza del correo, no el lead.
 *
 * Lo que se guarda y lo que no:
 *
 * - **Sí:** plantilla, proveedor, estado, motivo corto del fallo y destinatarios
 *   **enmascarados** (`an***a@example.test`), que es lo que permite diagnosticar sin
 *   almacenar a quién se escribió.
 * - **No:** el cuerpo del mensaje, el asunto (puede llevar el texto que escribió una
 *   persona), la clave de API ni la dirección completa.
 */
export async function recordNotification(input: {
  leadId?: string | null
  template: string
  provider: string
  recipients: string[]
  result: EmailSendResult
}): Promise<void> {
  const delivered = input.result.status === "SENT"

  try {
    await prisma.notificationLog.create({
      data: {
        leadId: input.leadId ?? null,
        channel: "EMAIL",
        template: input.template,
        status: input.result.status,
        provider: input.provider,
        recipients: input.recipients.length > 0 ? maskEmails(input.recipients) : null,
        sentAt: delivered ? new Date() : null,
        error: delivered ? null : truncateReason(input.result),
      },
    })
  } catch (error) {
    console.error("[email] no se pudo registrar el aviso", {
      plantilla: input.template,
      estado: input.result.status,
      error: error instanceof Error ? error.message : "desconocido",
    })
  }
}

/** Motivo acotado: es una etiqueta de diagnóstico, no un volcado del proveedor. */
function truncateReason(result: EmailSendResult): string | null {
  if (result.status === "SENT") return null
  return result.reason.slice(0, 200)
}
