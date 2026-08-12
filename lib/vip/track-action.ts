"use server"

import type { ContentType, InteractionType } from "@prisma/client"
import { recordContentViewOnce } from "@/lib/domain/interactions"
import { getVipLead } from "@/lib/vip/session"

/**
 * Registra que un visitante con acceso ha visto un listado o una ficha.
 *
 * Se invoca desde el cliente al montar la vista (no durante el render en
 * servidor) por dos motivos: un render de servidor puede repetirse sin que
 * haya una visita nueva, y un prefetch de Next no debería contar como vista.
 * Aun así el servidor deduplica por ventana de tiempo, de modo que ni un doble
 * montaje ni un F5 inflan el historial.
 *
 * Sin sesión válida no registra nada: no se puede usar para escribir
 * interacciones de un lead ajeno.
 */
export async function trackVipViewAction(input: {
  section: ContentType
  type: Extract<InteractionType, "SECTION_VIEWED" | "CONTENT_VIEWED">
  contentEntryId?: string
}): Promise<void> {
  const lead = await getVipLead()
  if (!lead) return

  if (input.type !== "SECTION_VIEWED" && input.type !== "CONTENT_VIEWED") return

  await recordContentViewOnce({
    leadId: lead.id,
    section: input.section,
    type: input.type,
    contentEntryId: input.contentEntryId,
  }).catch(() => {
    // Registrar una vista es telemetría comercial: si falla, no debe romper
    // la página que el visitante ya tiene derecho a ver.
  })
}
