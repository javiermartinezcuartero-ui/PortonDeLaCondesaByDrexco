import { prisma } from "@/lib/db"
import { recordActivity } from "@/lib/domain/activities"
import { recordAuditEvent } from "@/lib/domain/audit"
import { DomainError } from "@/lib/domain/errors"
import type { LeadRequest, LeadRequestStatus, Prisma, Priority } from "@prisma/client"

export const REQUEST_LIST_PAGE_SIZE = 25

/**
 * Ordenaciones admitidas del listado de solicitudes.
 *
 * Es una **lista blanca cerrada**, no una cadena que se pase a Prisma: el
 * parámetro de orden viaja en la URL y, si se aceptara tal cual, sería una vía
 * para ordenar por columnas que no deberían salir del servidor o para provocar
 * errores del motor. Lo que no está aquí no se ordena.
 */
export const REQUEST_SORTS = {
  recientes: { createdAt: "desc" },
  antiguas: { createdAt: "asc" },
  actualizadas: { updatedAt: "desc" },
  "proxima-accion": { nextActionAt: "asc" },
  prioridad: { priority: "desc" },
  invitados: { guestCount: "desc" },
} as const satisfies Record<string, Prisma.LeadRequestOrderByWithRelationInput>

export type RequestSortKey = keyof typeof REQUEST_SORTS

export function isRequestSortKey(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(REQUEST_SORTS, value)
}

export type RequestListFilters = {
  status?: LeadRequestStatus
  priority?: Priority
  eventType?: string
  ownerId?: string
  /** `"sin-asignar"` filtra las que no tienen responsable. */
  unassigned?: boolean
  preferredSpace?: string
  utmSource?: string
  utmCampaign?: string
  sourceContentId?: string
  minGuests?: number
  maxGuests?: number
  from?: Date
  to?: Date
  search?: string
  sort?: RequestSortKey
  page?: number
  pageSize?: number
}

export function buildRequestWhere(filters: RequestListFilters): Prisma.LeadRequestWhereInput {
  const where: Prisma.LeadRequestWhereInput = { archivedAt: null }

  if (filters.status) where.status = filters.status
  if (filters.priority) where.priority = filters.priority
  if (filters.eventType) where.eventType = filters.eventType
  if (filters.preferredSpace) where.preferredSpace = filters.preferredSpace
  if (filters.utmSource) where.utmSource = filters.utmSource
  if (filters.utmCampaign) where.utmCampaign = filters.utmCampaign
  if (filters.sourceContentId) where.sourceContentId = filters.sourceContentId

  if (filters.unassigned) where.ownerId = null
  else if (filters.ownerId) where.ownerId = filters.ownerId

  if (filters.minGuests !== undefined || filters.maxGuests !== undefined) {
    where.guestCount = {
      ...(filters.minGuests !== undefined ? { gte: filters.minGuests } : {}),
      ...(filters.maxGuests !== undefined ? { lte: filters.maxGuests } : {}),
    }
  }

  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    }
  }

  const search = filters.search?.trim()
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: "insensitive" } },
      { lead: { emailNormalized: { contains: search.toLowerCase() } } },
      { lead: { firstName: { contains: search, mode: "insensitive" } } },
      { lead: { lastName: { contains: search, mode: "insensitive" } } },
    ]
  }

  return where
}

export async function listRequestsForAdmin(filters: RequestListFilters = {}) {
  const pageSize = filters.pageSize ?? REQUEST_LIST_PAGE_SIZE
  const page = Math.max(1, filters.page ?? 1)
  const where = buildRequestWhere(filters)
  const orderBy = REQUEST_SORTS[filters.sort ?? "recientes"]

  const [total, rows] = await Promise.all([
    prisma.leadRequest.count({ where }),
    prisma.leadRequest.findMany({
      where,
      // Segundo criterio estable: sin él, dos filas con el mismo valor podrían
      // cambiar de página entre consultas y hacer que una se vea dos veces.
      orderBy: [orderBy, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        createdAt: true,
        status: true,
        priority: true,
        eventType: true,
        eventDate: true,
        guestCount: true,
        preferredSpace: true,
        subject: true,
        nextActionAt: true,
        utmSource: true,
        utmCampaign: true,
        sourceContentId: true,
        // `leadId` en vez de la relación anidada: ver el comentario de abajo.
        leadId: true,
        owner: { select: { id: true, name: true } },
      },
    }),
  ])

  // El contacto se lee en una consulta aparte, igual que en la exportación
  // (`crm-export.ts`), y por el mismo motivo.
  //
  // `LeadRequest.lead` es una relación **obligatoria**. Prisma la resuelve con una
  // segunda consulta interna, y si el contacto desaparece entre las dos lanza
  // `Inconsistent query result: Field lead is required to return data, got null` y
  // **el listado entero de Solicitudes devuelve 500**. La auditoría final corrigió
  // este mismo defecto en la exportación, pero el listado se quedó sin arreglar:
  // volvió a aparecer como fallo intermitente de la suite, donde otro archivo de
  // pruebas borra contactos en paralelo.
  //
  // En producción la ventana es estrecha —`anonymizeLead` vacía el contacto, no lo
  // borra— pero existe: basta con abrir Solicitudes mientras alguien ejecuta una
  // supresión o `test:clean`. Con dos consultas explícitas el número de viajes a la
  // base no cambia, y una fila huérfana se omite en vez de tumbar la pantalla.
  const leadIds = [...new Set(rows.map((row) => row.leadId))]
  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds } },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, score: true },
  })
  const leadById = new Map(leads.map((lead) => [lead.id, lead]))

  const requests = rows
    .filter((row) => leadById.has(row.leadId))
    .map(({ leadId, ...row }) => ({ ...row, lead: leadById.get(leadId)! }))

  return { requests, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

/**
 * Solicitudes para el tablero, agrupadas por estado en la interfaz.
 *
 * **El tope es GLOBAL, no por columna.** El nombre del parámetro dice
 * `limitPerColumn` y el docstring decía "con tope por columna", y las dos cosas
 * eran falsas: se traen `limitPerColumn * 9` filas en una sola consulta ordenada
 * por prioridad y fecha, y el reparto por estado lo hace después la interfaz.
 *
 * Consecuencia real, dicha para que nadie se fíe de lo que no es: con más de 225
 * solicitudes activas, si las primeras 225 por prioridad caen todas en un mismo
 * estado, las demás columnas se pintan con `(0)` y el texto "Vacío" **aunque
 * tengan solicitudes vivas**. Un comercial vería un embudo sin negociaciones en
 * curso.
 *
 * No se ha reescrito en la auditoría final porque exige nueve consultas con su
 * `groupBy` de conteos, y un cambio de ese tamaño en la última fase tiene más
 * riesgo que el defecto: hoy la demostración tiene 8 solicitudes y el umbral está
 * a 225. Queda anotado en README §Limitaciones conocidas con su umbral, que es lo
 * que permite decidir cuándo toca. El listado paginado de Solicitudes es, mientras
 * tanto, la vista completa y fiable.
 */
export async function listRequestsForPipeline(limitPerColumn = 25) {
  const requests = await prisma.leadRequest.findMany({
    where: { archivedAt: null, status: { not: "WON" } },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    // Se acota el conjunto para que el tablero no crezca sin límite; el listado
    // paginado de Solicitudes es la vista completa.
    take: limitPerColumn * 9,
    select: {
      id: true,
      status: true,
      priority: true,
      eventType: true,
      eventDate: true,
      subject: true,
      nextActionAt: true,
      lead: { select: { id: true, email: true, firstName: true, lastName: true } },
      owner: { select: { id: true, name: true } },
    },
  })

  const wonRecent = await prisma.leadRequest.findMany({
    where: { archivedAt: null, status: "WON" },
    orderBy: { updatedAt: "desc" },
    take: limitPerColumn,
    select: {
      id: true,
      status: true,
      priority: true,
      eventType: true,
      eventDate: true,
      subject: true,
      nextActionAt: true,
      lead: { select: { id: true, email: true, firstName: true, lastName: true } },
      owner: { select: { id: true, name: true } },
    },
  })

  return [...requests, ...wonRecent]
}

export type PipelineCard = Awaited<ReturnType<typeof listRequestsForPipeline>>[number]

export async function getRequestDetail(id: string) {
  return prisma.leadRequest.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      lead: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          score: true,
          lifecycle: true,
          firstSource: true,
          lastSource: true,
          consents: { orderBy: { createdAt: "desc" }, take: 5 },
          _count: { select: { requests: true } },
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { actor: { select: { id: true, name: true } } },
      },
    },
  })
}

export type RequestDetail = NonNullable<Awaited<ReturnType<typeof getRequestDetail>>>

/** Ficha de contenido de la que vino la solicitud, si la hubo y sigue existiendo. */
export async function getRequestSourceContent(sourceContentId: string | null) {
  if (!sourceContentId) return null
  return prisma.contentEntry.findUnique({
    where: { id: sourceContentId },
    select: { id: true, slug: true, type: true, translations: { where: { locale: "ES" }, select: { title: true } } },
  })
}

/**
 * Posibles coincidencias del mismo contacto: otras personas con el mismo
 * teléfono normalizado o con el mismo nombre y apellidos.
 *
 * **Solo avisa, no fusiona nada.** Fusionar dos contactos significa decidir qué
 * consentimiento sobrevive y qué solicitudes se reasignan; eso no puede hacerlo
 * una heurística de coincidencia, y fusionar solicitudes está explícitamente
 * descartado. El aviso está para que una persona lo revise.
 */
export async function findPossibleDuplicates(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, phoneNormalized: true, firstName: true, lastName: true },
  })
  if (!lead) return []

  const conditions: Prisma.LeadWhereInput[] = []
  if (lead.phoneNormalized) conditions.push({ phoneNormalized: lead.phoneNormalized })
  if (lead.firstName && lead.lastName) {
    conditions.push({
      firstName: { equals: lead.firstName, mode: "insensitive" },
      lastName: { equals: lead.lastName, mode: "insensitive" },
    })
  }
  if (conditions.length === 0) return []

  return prisma.lead.findMany({
    where: { id: { not: lead.id }, lifecycle: { not: "ANONYMIZED" }, OR: conditions },
    take: 5,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      _count: { select: { requests: true } },
    },
  })
}

export type UpdateRequestDetailsInput = {
  id: string
  actorId: string
  priority: Priority
  /** `null` desasigna. */
  ownerId: string | null
  nextActionAt: Date | null
  preferredSpace: string | null
  budgetRange: string | null
}

/**
 * Edita los campos de gestión de una solicitud: prioridad, responsable, próxima
 * acción, espacio y presupuesto. **No toca el estado del pipeline** (eso es
 * `changeLeadRequestStatus`, que valida la transición) ni los datos que escribió
 * la persona: el mensaje y el asunto de una solicitud son su testimonio y el CRM
 * no los reescribe.
 */
export async function updateRequestDetails(input: UpdateRequestDetailsInput): Promise<LeadRequest> {
  const current = await prisma.leadRequest.findUnique({
    where: { id: input.id },
    select: { id: true, leadId: true, ownerId: true, priority: true },
  })
  if (!current) throw new DomainError("La solicitud no existe")

  if (input.ownerId) {
    const owner = await prisma.user.findUnique({ where: { id: input.ownerId }, select: { id: true } })
    if (!owner) throw new DomainError("El responsable indicado no existe")
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.leadRequest.update({
      where: { id: input.id },
      data: {
        priority: input.priority,
        ownerId: input.ownerId,
        nextActionAt: input.nextActionAt,
        preferredSpace: input.preferredSpace,
        budgetRange: input.budgetRange,
      },
    })

    // Reasignar es un cambio con consecuencias organizativas: se anota en el
    // historial del contacto, no solo en la auditoría técnica.
    if (current.ownerId !== input.ownerId) {
      await recordActivity(
        {
          leadId: current.leadId,
          leadRequestId: current.id,
          actorId: input.actorId,
          type: "NOTE",
          metadata: { accion: "asignacion", anterior: current.ownerId, nuevo: input.ownerId },
        },
        tx
      )
    }

    return updated
  })
}

/**
 * Archiva una solicitud sin borrarla: el historial comercial no se destruye.
 * Deja de aparecer en listados y tablero, pero sigue en la ficha del contacto.
 */
export async function archiveRequest(id: string, actorId: string): Promise<LeadRequest> {
  const current = await prisma.leadRequest.findUnique({ where: { id }, select: { id: true, leadId: true } })
  if (!current) throw new DomainError("La solicitud no existe")

  const [updated] = await prisma.$transaction([
    prisma.leadRequest.update({ where: { id }, data: { archivedAt: new Date() } }),
    prisma.leadActivity.create({
      data: { leadId: current.leadId, leadRequestId: id, actorId, type: "NOTE", metadata: { accion: "archivada" } },
    }),
  ])

  await recordAuditEvent({ entityType: "LeadRequest", entityId: id, action: "request.archive", actorId })

  return updated
}

/** Responsables asignables: cualquier usuario interno que trabaje el CRM. */
export async function listAssignableUsers() {
  return prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SALES"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  })
}

/** Valores distintos ya presentes, para poblar los desplegables de filtro. */
export async function listRequestFilterOptions() {
  const [eventTypes, spaces, sources, campaigns] = await Promise.all([
    prisma.leadRequest.groupBy({ by: ["eventType"], where: { archivedAt: null } }),
    prisma.leadRequest.groupBy({ by: ["preferredSpace"], where: { archivedAt: null, preferredSpace: { not: null } } }),
    prisma.leadRequest.groupBy({ by: ["utmSource"], where: { archivedAt: null, utmSource: { not: null } } }),
    prisma.leadRequest.groupBy({ by: ["utmCampaign"], where: { archivedAt: null, utmCampaign: { not: null } } }),
  ])

  return {
    eventTypes: eventTypes.map((row) => row.eventType).sort(),
    spaces: spaces.map((row) => row.preferredSpace).filter((value): value is string => value !== null).sort(),
    sources: sources.map((row) => row.utmSource).filter((value): value is string => value !== null).sort(),
    campaigns: campaigns.map((row) => row.utmCampaign).filter((value): value is string => value !== null).sort(),
  }
}
