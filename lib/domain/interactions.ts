import { prisma } from "@/lib/db"
import { recalculateLeadScore } from "@/lib/domain/scoring"
import type { ContentInteraction, ContentType, InteractionType } from "@prisma/client"

export type RecordContentInteractionInput = {
  leadId: string
  section: ContentType
  type: InteractionType
  contentEntryId?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}

export async function recordContentInteraction(input: RecordContentInteractionInput): Promise<ContentInteraction> {
  const interaction = await prisma.contentInteraction.create({
    data: {
      leadId: input.leadId,
      section: input.section,
      type: input.type,
      contentEntryId: input.contentEntryId,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
    },
  })

  await recalculateLeadScore(input.leadId)

  return interaction
}

/**
 * Ventana de deduplicación de vistas. Recargar una ficha tres veces en un
 * minuto no son tres visitas; volver a ella al día siguiente sí. 30 minutos
 * distingue ambos casos sin perder señal comercial útil.
 */
export const VIEW_DEDUPE_WINDOW_MS = 1000 * 60 * 30

/**
 * Registra una vista (`SECTION_VIEWED` / `CONTENT_VIEWED`) solo si no hay ya
 * una idéntica reciente. Evita que un render doble, un prefetch o un F5
 * inflen el historial del lead y su scoring.
 *
 * Devuelve la interacción creada, o `null` si se consideró duplicada.
 */
export async function recordContentViewOnce(
  input: RecordContentInteractionInput
): Promise<ContentInteraction | null> {
  const since = new Date(Date.now() - VIEW_DEDUPE_WINDOW_MS)

  const recent = await prisma.contentInteraction.findFirst({
    where: {
      leadId: input.leadId,
      section: input.section,
      type: input.type,
      // `null` y un id concreto se tratan como claves distintas: la vista del
      // listado no cancela la de una ficha, ni al contrario.
      contentEntryId: input.contentEntryId ?? null,
      createdAt: { gte: since },
    },
    select: { id: true },
  })
  if (recent) return null

  return recordContentInteraction(input)
}
