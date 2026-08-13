import { prisma } from "@/lib/db"
import { recordAuditEvent } from "@/lib/domain/audit"
import { DomainError } from "@/lib/domain/errors"
import type { ScoringRule } from "@prisma/client"

/**
 * Claves de ScoringRule. Los pesos son configurables en la tabla
 * `scoring_rule` (ver prisma/seed.ts para los valores iniciales, tomados de
 * project-reference/docs/03-arquitectura-crm-leads.md).
 */
export const SCORING_RULE_KEYS = [
  "FORM_SUBMITTED",
  "PHONE_PROVIDED",
  "EVENT_DATE_PROVIDED",
  "GUEST_COUNT_PROVIDED",
  "VIP_ACCESS",
  "DOSSIER_DOWNLOAD",
  "CONTENT_VIEWED_3PLUS",
  "VISIT_REQUESTED",
] as const

export type ScoringRuleKey = (typeof SCORING_RULE_KEYS)[number]

/**
 * Recalcula el score de un Lead desde cero a partir de su historial real
 * (nunca incrementa a ciegas: es idempotente y refleja siempre los pesos
 * vigentes en `scoring_rule`, incluso si se acaban de cambiar).
 */
export async function recalculateLeadScore(leadId: string): Promise<number> {
  const rules = await prisma.scoringRule.findMany({ where: { active: true } })
  const points = new Map<string, number>(rules.map((rule) => [rule.key, rule.points]))
  const weight = (key: ScoringRuleKey) => points.get(key) ?? 0

  const [lead, requestCount, requestsWithDate, requestsWithGuests, vipAccessCount, dossierDownloads, visitRequests, viewedContentIds] =
    await Promise.all([
      prisma.lead.findUniqueOrThrow({ where: { id: leadId } }),
      prisma.leadRequest.count({ where: { leadId } }),
      prisma.leadRequest.count({ where: { leadId, eventDate: { not: null } } }),
      prisma.leadRequest.count({ where: { leadId, guestCount: { not: null } } }),
      prisma.contentInteraction.count({ where: { leadId, type: "GATE_GRANTED" } }),
      prisma.leadActivity.count({ where: { leadId, type: "DOSSIER_DOWNLOADED" } }),
      prisma.leadActivity.count({ where: { leadId, type: "VISIT" } }),
      prisma.contentInteraction.findMany({
        where: { leadId, type: "CONTENT_VIEWED", contentEntryId: { not: null } },
        select: { contentEntryId: true },
        distinct: ["contentEntryId"],
      }),
    ])

  let score = 0
  if (requestCount > 0) score += weight("FORM_SUBMITTED")
  if (lead.phone) score += weight("PHONE_PROVIDED")
  if (requestsWithDate > 0) score += weight("EVENT_DATE_PROVIDED")
  if (requestsWithGuests > 0) score += weight("GUEST_COUNT_PROVIDED")
  if (vipAccessCount > 0) score += weight("VIP_ACCESS")
  if (dossierDownloads > 0) score += weight("DOSSIER_DOWNLOAD")
  if (viewedContentIds.length >= 3) score += weight("CONTENT_VIEWED_3PLUS")
  if (visitRequests > 0) score += weight("VISIT_REQUESTED")

  await prisma.lead.update({ where: { id: leadId }, data: { score } })
  return score
}

// ---------------------------------------------------------------------------
// Configuración de los pesos (solo ADMIN, ver app/admin/(protected)/configuracion)
// ---------------------------------------------------------------------------

/** Tope por hito. Un peso desbocado convierte el score en ruido. */
export const MAX_RULE_POINTS = 100

export async function listScoringRules(): Promise<ScoringRule[]> {
  return prisma.scoringRule.findMany({ orderBy: { key: "asc" } })
}

/**
 * Cambia el peso o el estado de una regla.
 *
 * No se recalcula el score de toda la base al vuelo: `recalculateLeadScore` lee
 * los pesos vigentes cada vez que corre, así que cada contacto se pone al día en
 * su siguiente movimiento. Recalcular miles de filas dentro de una petición HTTP
 * sería peor que la ligera desactualización que esto deja, y el número que se
 * muestra siempre indica cuándo se calculó.
 */
export async function updateScoringRule(input: {
  key: string
  points: number
  active: boolean
  actorId?: string
}): Promise<ScoringRule> {
  if (!Number.isInteger(input.points) || input.points < 0 || input.points > MAX_RULE_POINTS) {
    throw new DomainError(`Los puntos deben ser un entero entre 0 y ${MAX_RULE_POINTS}`)
  }

  const current = await prisma.scoringRule.findUnique({ where: { key: input.key } })
  if (!current) throw new DomainError("La regla de scoring no existe")

  const updated = await prisma.scoringRule.update({
    where: { key: input.key },
    data: { points: input.points, active: input.active },
  })

  await recordAuditEvent({
    entityType: "ScoringRule",
    entityId: updated.id,
    action: "scoring.update",
    actorId: input.actorId,
    metadata: {
      clave: input.key,
      puntosAnteriores: current.points,
      puntosNuevos: input.points,
      activaAnterior: current.active,
      activaNueva: input.active,
    },
  })

  return updated
}
