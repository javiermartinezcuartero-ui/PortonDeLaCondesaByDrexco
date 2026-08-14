import { prisma } from "@/lib/db"
import type { ContentType, LeadRequestStatus, Prisma } from "@prisma/client"

/**
 * Agregados del CRM para el Resumen y los Informes.
 *
 * Dos reglas gobiernan este módulo:
 *
 * 1. **Nunca se inventa una métrica.** Un ratio sin denominador devuelve `null`,
 *    no 0 %: un 0 % dice "nadie convierte" y un `null` dice "todavía no hay
 *    datos", que son cosas muy distintas para quien decide. Cada ratio viaja con
 *    su denominador para que la interfaz pueda mostrarlo.
 * 2. **Casi nunca se carga la base en memoria.** Todo son `count`, `aggregate` o
 *    `groupBy` agregados en la base de datos, salvo dos excepciones que conviene
 *    conocer porque el docstring anterior las negaba:
 *
 *    - Las tres consultas del embudo devuelven listas de identificadores, porque
 *      hacen falta las intersecciones. Crecen con el número de contactos.
 *    - `averageHoursToFirstContact` trae **todas** las solicitudes del periodo y
 *      **todas** sus actividades de cambio de estado, y calcula la media en
 *      TypeScript. No tiene `take`.
 *
 *    Esa segunda es la que se rompe primero, y no se degrada: con del orden de
 *    65.000 solicitudes el `IN (...)` supera el límite de parámetros de PostgreSQL
 *    y **el Resumen entero devuelve 500**, no solo esa tarjeta, porque va dentro
 *    del `Promise.all` de `getDashboardMetrics`. Mucho antes de eso ya sería la
 *    consulta más lenta del panel.
 *
 *    Se deja así en la auditoría final a conciencia: llevarlo a la base de datos
 *    exige un `$queryRaw` con `FILTER` y `AVG(EXTRACT(EPOCH ...))`, y reescribir
 *    una métrica en la última fase tiene más riesgo que un límite que hoy está
 *    tres órdenes de magnitud por encima del volumen real. Anotado en
 *    README §Limitaciones conocidas con su umbral.
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type DateRange = { from?: Date; to?: Date }

/** Ratio con su denominador a la vista: sin denominador no hay porcentaje. */
export type Ratio = {
  numerator: number
  denominator: number
  /** `null` cuando el denominador es 0. La interfaz muestra "sin datos". */
  percentage: number | null
}

export type Average = {
  /** `null` si no hay ni una muestra. */
  value: number | null
  sampleSize: number
}

export type PipelineCounts = Record<LeadRequestStatus, number>

export type AttributionRow = {
  source: string | null
  medium: string | null
  campaign: string | null
  content: string | null
  requests: number
}

export type ContentPopularityRow = {
  contentEntryId: string
  title: string
  type: ContentType
  slug: string
  views: number
}

export type FunnelCounts = {
  /** Contactos que pasaron el gate de email. */
  gateGranted: number
  /** De esos, cuántos abrieron al menos una ficha. */
  viewedContent: number
  /** De esos, cuántos acabaron enviando una solicitud. */
  submittedRequest: number
}

export type RecentMovement = {
  id: string
  createdAt: Date
  type: string
  leadId: string
  leadEmail: string
  leadName: string | null
  leadRequestId: string | null
  metadata: Prisma.JsonValue
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function ratio(numerator: number, denominator: number): Ratio {
  return {
    numerator,
    denominator,
    percentage: denominator === 0 ? null : Math.round((numerator / denominator) * 1000) / 10,
  }
}

function createdAtFilter(range: DateRange): Prisma.DateTimeFilter | undefined {
  if (!range.from && !range.to) return undefined
  return { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) }
}

const EMPTY_PIPELINE: PipelineCounts = {
  CONTACT: 0,
  PRESENTATION: 0,
  PROPOSAL: 0,
  CLIENT: 0,
  LOST: 0,
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/** Solicitudes por estado. Con rango, solo las creadas dentro de él. */
export async function countRequestsByStatus(range: DateRange = {}): Promise<PipelineCounts> {
  const createdAt = createdAtFilter(range)
  const grouped = await prisma.leadRequest.groupBy({
    by: ["status"],
    where: { archivedAt: null, ...(createdAt ? { createdAt } : {}) },
    _count: { _all: true },
  })

  const counts: PipelineCounts = { ...EMPTY_PIPELINE }
  for (const row of grouped) counts[row.status] = row._count._all
  return counts
}

/**
 * Conversión sobre **cerrados**, no sobre el total: mientras una solicitud sigue
 * viva no cuenta ni a favor ni en contra. El denominador es CLIENT + LOST y viaja
 * en el resultado para que se pueda mostrar junto al porcentaje.
 */
export function conversionOverClosed(counts: PipelineCounts): Ratio {
  return ratio(counts.CLIENT, counts.CLIENT + counts.LOST)
}

/**
 * Horas medias hasta el primer contacto: del alta de la solicitud a su salida de la
 * fase de entrada. Se lee del historial real de `LeadActivity`, no de un campo
 * denormalizado que pudiera quedar desfasado.
 */
export async function averageHoursToFirstContact(range: DateRange = {}): Promise<Average> {
  const createdAt = createdAtFilter(range)

  const requests = await prisma.leadRequest.findMany({
    where: { archivedAt: null, ...(createdAt ? { createdAt } : {}) },
    select: { id: true, createdAt: true },
  })
  if (requests.length === 0) return { value: null, sampleSize: 0 }

  const requestIds = requests.map((request) => request.id)

  const contacts = await prisma.leadActivity.findMany({
    where: {
      leadRequestId: { in: requestIds },
      type: "STATUS_CHANGED",
      // Filtro sobre el JSON de metadata: el paso concreto a la segunda fase.
      //
      // Se aceptan **los dos vocabularios**. Antes de la reducción a cinco fases el
      // paso se anotaba como `to: "CONTACTED"`, y el historial no se reescribió en la
      // migración a propósito: es una pista de auditoría. Si este filtro solo mirase
      // el nombre nuevo, la métrica devolvería "sin datos" sobre todo el histórico
      // anterior, que es peor que aceptar dos nombres.
      OR: [
        { metadata: { path: ["to"], equals: "PRESENTATION" } },
        { metadata: { path: ["to"], equals: "CONTACTED" } },
      ],
    },
    select: { leadRequestId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  // El primer paso a la segunda fase de cada solicitud; los posteriores (una vuelta
  // atrás y otro avance) no son "el primer contacto".
  const firstContact = new Map<string, Date>()
  for (const activity of contacts) {
    if (!activity.leadRequestId) continue
    if (!firstContact.has(activity.leadRequestId)) firstContact.set(activity.leadRequestId, activity.createdAt)
  }

  const durations: number[] = []
  for (const request of requests) {
    const contactedAt = firstContact.get(request.id)
    if (!contactedAt) continue
    durations.push((contactedAt.getTime() - request.createdAt.getTime()) / (1000 * 60 * 60))
  }

  if (durations.length === 0) return { value: null, sampleSize: 0 }
  const total = durations.reduce((sum, hours) => sum + hours, 0)
  return { value: Math.round((total / durations.length) * 10) / 10, sampleSize: durations.length }
}

/** Solicitudes sin trabajar todavía: siguen en la fase de entrada. */
export async function countPendingFirstContact(): Promise<number> {
  return prisma.leadRequest.count({ where: { status: "CONTACT", archivedAt: null } })
}

// ---------------------------------------------------------------------------
// Contactos y tareas
// ---------------------------------------------------------------------------

export async function countLeadsFromGate(range: DateRange = {}): Promise<number> {
  const createdAt = createdAtFilter(range)
  const grouped = await prisma.contentInteraction.groupBy({
    by: ["leadId"],
    where: { type: "GATE_GRANTED", ...(createdAt ? { createdAt } : {}) },
  })
  return grouped.length
}

export async function countTasks(now: Date): Promise<{ overdue: number; upcoming: number; pending: number }> {
  const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [overdue, upcoming, pending] = await Promise.all([
    prisma.followUpTask.count({ where: { status: "PENDING", dueAt: { lt: now } } }),
    prisma.followUpTask.count({ where: { status: "PENDING", dueAt: { gte: now, lte: inSevenDays } } }),
    prisma.followUpTask.count({ where: { status: "PENDING" } }),
  ])

  return { overdue, upcoming, pending }
}

export async function averageLeadScore(): Promise<Average> {
  const result = await prisma.lead.aggregate({
    where: { lifecycle: { not: "ANONYMIZED" } },
    _avg: { score: true },
    _count: { _all: true },
  })

  return {
    value: result._avg.score === null ? null : Math.round(result._avg.score * 10) / 10,
    sampleSize: result._count._all,
  }
}

// ---------------------------------------------------------------------------
// Atribución y contenido
// ---------------------------------------------------------------------------

/** Solicitudes agrupadas por origen completo (source/medium/campaign/content). */
export async function requestsByAttribution(range: DateRange = {}, limit = 25): Promise<AttributionRow[]> {
  const createdAt = createdAtFilter(range)
  const grouped = await prisma.leadRequest.groupBy({
    by: ["utmSource", "utmMedium", "utmCampaign", "utmContent"],
    where: { archivedAt: null, ...(createdAt ? { createdAt } : {}) },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  })

  return grouped.map((row) => ({
    source: row.utmSource,
    medium: row.utmMedium,
    campaign: row.utmCampaign,
    content: row.utmContent,
    requests: row._count._all,
  }))
}

/** Accesos concedidos por el gate, separados por biblioteca de entrada. */
export async function gateGrantsBySection(range: DateRange = {}): Promise<Record<ContentType, number>> {
  const createdAt = createdAtFilter(range)
  const grouped = await prisma.contentInteraction.groupBy({
    by: ["section"],
    where: { type: "GATE_GRANTED", ...(createdAt ? { createdAt } : {}) },
    _count: { _all: true },
  })

  const counts: Record<ContentType, number> = { REAL_WEDDING: 0, CATERING_EVENT: 0 }
  for (const row of grouped) counts[row.section] = row._count._all
  return counts
}

/** Fichas más consultadas, con su título en español para poder nombrarlas. */
export async function mostViewedContent(range: DateRange = {}, limit = 10): Promise<ContentPopularityRow[]> {
  const createdAt = createdAtFilter(range)
  const grouped = await prisma.contentInteraction.groupBy({
    by: ["contentEntryId"],
    where: { type: "CONTENT_VIEWED", contentEntryId: { not: null }, ...(createdAt ? { createdAt } : {}) },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  })

  const ids = grouped.map((row) => row.contentEntryId).filter((id): id is string => id !== null)
  if (ids.length === 0) return []

  const entries = await prisma.contentEntry.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, type: true, translations: { where: { locale: "ES" }, select: { title: true } } },
  })
  const byId = new Map(entries.map((entry) => [entry.id, entry]))

  return grouped
    .map((row) => {
      const entry = row.contentEntryId ? byId.get(row.contentEntryId) : undefined
      if (!entry) return null
      return {
        contentEntryId: entry.id,
        title: entry.translations[0]?.title ?? entry.slug,
        type: entry.type,
        slug: entry.slug,
        views: row._count._all,
      }
    })
    .filter((row): row is ContentPopularityRow => row !== null)
}

/**
 * Embudo gate → consulta de contenido → solicitud, contando **contactos
 * distintos** en cada paso y solo los que vienen del paso anterior: alguien que
 * envió una solicitud sin pasar por el gate no infla el último escalón.
 */
export async function acquisitionFunnel(): Promise<FunnelCounts> {
  const [gate, viewed, requested] = await Promise.all([
    prisma.contentInteraction.groupBy({ by: ["leadId"], where: { type: "GATE_GRANTED" } }),
    prisma.contentInteraction.groupBy({ by: ["leadId"], where: { type: "CONTENT_VIEWED" } }),
    prisma.leadRequest.groupBy({ by: ["leadId"], where: { archivedAt: null } }),
  ])

  const gateIds = new Set(gate.map((row) => row.leadId))
  const viewedIds = new Set(viewed.map((row) => row.leadId))
  const requestedIds = new Set(requested.map((row) => row.leadId))

  const gateAndViewed = [...gateIds].filter((id) => viewedIds.has(id))
  const gateViewedAndRequested = gateAndViewed.filter((id) => requestedIds.has(id))

  return {
    gateGranted: gateIds.size,
    viewedContent: gateAndViewed.length,
    submittedRequest: gateViewedAndRequested.length,
  }
}

/**
 * De visitante identificado (alguien de quien tenemos el email) a solicitud.
 * El denominador son los contactos no anonimizados; el numerador, los que han
 * enviado al menos una solicitud.
 */
export async function identifiedToRequestRatio(): Promise<Ratio> {
  const [identified, withRequest] = await Promise.all([
    prisma.lead.count({ where: { lifecycle: { not: "ANONYMIZED" } } }),
    prisma.lead.count({ where: { lifecycle: { not: "ANONYMIZED" }, requests: { some: {} } } }),
  ])
  return ratio(withRequest, identified)
}

// ---------------------------------------------------------------------------
// Últimos movimientos
// ---------------------------------------------------------------------------

export async function recentMovements(limit = 12): Promise<RecentMovement[]> {
  const activities = await prisma.leadActivity.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      type: true,
      leadId: true,
      leadRequestId: true,
      metadata: true,
      lead: { select: { email: true, firstName: true, lastName: true } },
    },
  })

  return activities.map((activity) => ({
    id: activity.id,
    createdAt: activity.createdAt,
    type: activity.type,
    leadId: activity.leadId,
    leadEmail: activity.lead.email,
    leadName: [activity.lead.firstName, activity.lead.lastName].filter(Boolean).join(" ") || null,
    leadRequestId: activity.leadRequestId,
    metadata: activity.metadata,
  }))
}

// ---------------------------------------------------------------------------
// Composiciones para las páginas
// ---------------------------------------------------------------------------

export type DashboardMetrics = {
  leadsFromGate: number
  newRequests: number
  pendingFirstContact: number
  tasks: { overdue: number; upcoming: number; pending: number }
  pipeline: PipelineCounts
  conversion: Ratio
  hoursToFirstContact: Average
  attribution: AttributionRow[]
  topContent: ContentPopularityRow[]
  funnel: FunnelCounts
  movements: RecentMovement[]
}

export async function getDashboardMetrics(now: Date): Promise<DashboardMetrics> {
  const [leadsFromGate, pipeline, pendingFirstContact, tasks, hoursToFirstContact, attribution, topContent, funnel, movements] =
    await Promise.all([
      countLeadsFromGate(),
      countRequestsByStatus(),
      countPendingFirstContact(),
      countTasks(now),
      averageHoursToFirstContact(),
      requestsByAttribution({}, 8),
      mostViewedContent({}, 5),
      acquisitionFunnel(),
      recentMovements(10),
    ])

  return {
    leadsFromGate,
    newRequests: pipeline.CONTACT,
    pendingFirstContact,
    tasks,
    pipeline,
    conversion: conversionOverClosed(pipeline),
    hoursToFirstContact,
    attribution,
    topContent,
    funnel,
    movements,
  }
}

export type ReportMetrics = {
  range: DateRange
  attribution: AttributionRow[]
  gateBySection: Record<ContentType, number>
  topContent: ContentPopularityRow[]
  identifiedToRequest: Ratio
  pipeline: PipelineCounts
  conversion: Ratio
  hoursToFirstContact: Average
  averageScore: Average
}

export async function getReportMetrics(range: DateRange): Promise<ReportMetrics> {
  const [attribution, gateBySection, topContent, identifiedToRequest, pipeline, hoursToFirstContact, averageScore] =
    await Promise.all([
      requestsByAttribution(range, 30),
      gateGrantsBySection(range),
      mostViewedContent(range, 10),
      identifiedToRequestRatio(),
      countRequestsByStatus(range),
      averageHoursToFirstContact(range),
      averageLeadScore(),
    ])

  return {
    range,
    attribution,
    gateBySection,
    topContent,
    identifiedToRequest,
    pipeline,
    conversion: conversionOverClosed(pipeline),
    hoursToFirstContact,
    averageScore,
  }
}
