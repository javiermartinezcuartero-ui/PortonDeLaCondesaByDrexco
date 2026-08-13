import { prisma } from "@/lib/db"
import { normalizeEmail, normalizePhone } from "@/lib/domain/normalize"
import type { InteractionType, Prisma } from "@prisma/client"

/**
 * Consultas de contactos para el CRM.
 *
 * Todas paginan en servidor. Ninguna función de este módulo devuelve "todos los
 * contactos": la única que no lleva `take` es la de exportación, y esa exige
 * ADMIN y respeta los mismos filtros (ver lib/domain/crm-export.ts).
 */

export const LEAD_LIST_PAGE_SIZE = 25

export type LeadListFilters = {
  /** Busca en nombre, email y teléfono. Email y teléfono se normalizan igual que al guardarlos. */
  search?: string
  source?: string
  tag?: string
  minScore?: number
  interaction?: InteractionType
  /** `true` = ha concedido marketing; `false` = no consta que lo haya concedido. */
  marketingConsent?: boolean
  from?: Date
  to?: Date
  page?: number
  pageSize?: number
}

export type LeadListRow = Awaited<ReturnType<typeof listLeadsForAdmin>>["leads"][number]

/**
 * Construye el `where` de la búsqueda de contactos.
 *
 * La búsqueda por email y teléfono va contra las columnas **normalizadas**, que
 * es como se guardan: buscar "600 11 22 33" encuentra el lead guardado como
 * "+34600112233" porque el término pasa por el mismo normalizador. El nombre, en
 * cambio, se busca sin distinguir mayúsculas porque no tiene forma canónica.
 */
export function buildLeadWhere(filters: LeadListFilters): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {}

  const search = filters.search?.trim()
  if (search) {
    const normalizedPhone = normalizePhone(search)
    const or: Prisma.LeadWhereInput[] = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { emailNormalized: { contains: normalizeEmail(search) } },
    ]
    // Un término sin dígitos normaliza a cadena vacía, que casaría con todo.
    if (normalizedPhone.replace(/\D/g, "").length >= 3) {
      or.push({ phoneNormalized: { contains: normalizedPhone } })
    }
    where.OR = or
  }

  if (filters.source) {
    // Va en `AND` y no en `OR` para no mezclarse con el `OR` de la búsqueda: son
    // dos condiciones que deben cumplirse a la vez, no alternativas.
    where.AND = [{ OR: [{ firstSource: filters.source }, { lastSource: filters.source }] }]
  }

  if (filters.tag) where.tags = { some: { tag: { name: filters.tag } } }
  if (filters.minScore !== undefined) where.score = { gte: filters.minScore }
  if (filters.interaction) where.interactions = { some: { type: filters.interaction } }

  if (filters.marketingConsent !== undefined) {
    // Hoy solo se registra el consentimiento de marketing cuando se concede (ver
    // docs/flujo-captacion.md §5), así que "tiene un evento granted" equivale al
    // estado vigente. Si algún día se registran revocaciones habrá que mirar el
    // último evento por fecha, no la mera existencia.
    const granted = { some: { purpose: "MARKETING" as const, granted: true } }
    where.consents = filters.marketingConsent ? granted : { none: granted.some }
  }

  if (filters.from || filters.to) {
    where.firstSeenAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    }
  }

  return where
}

export async function listLeadsForAdmin(filters: LeadListFilters = {}) {
  const pageSize = filters.pageSize ?? LEAD_LIST_PAGE_SIZE
  const page = Math.max(1, filters.page ?? 1)
  const where = buildLeadWhere(filters)

  const [total, leads] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      // Tercer criterio único: sin él, dos contactos con la misma última
      // actividad y la misma fecha de creación —lo normal en una ráfaga de altas o
      // en el sembrado— pueden cambiar de página entre consultas, de modo que uno
      // se vea dos veces y otro no se vea nunca. Al revisar la lista para atender
      // una supresión, el que falta no se trata. `listRequestsForAdmin` ya lo hacía.
      orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
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
        firstSeenAt: true,
        lastActivityAt: true,
        tags: { select: { tag: { select: { name: true } } } },
        _count: { select: { requests: true, interactions: true } },
      },
    }),
  ])

  return { leads, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

/** Orígenes distintos ya presentes en la base, para poblar el desplegable de filtro. */
export async function listLeadSources(): Promise<string[]> {
  const [first, last] = await Promise.all([
    prisma.lead.groupBy({ by: ["firstSource"], where: { firstSource: { not: null } } }),
    prisma.lead.groupBy({ by: ["lastSource"], where: { lastSource: { not: null } } }),
  ])

  const sources = new Set<string>()
  for (const row of first) if (row.firstSource) sources.add(row.firstSource)
  for (const row of last) if (row.lastSource) sources.add(row.lastSource)
  return [...sources].sort()
}

export async function listTags(): Promise<string[]> {
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" }, select: { name: true } })
  return tags.map((tag) => tag.name)
}

/**
 * Ficha 360º: datos de contacto, consentimientos, solicitudes, contenido
 * consultado, timeline, notas y tareas en una sola consulta.
 *
 * **Todas** las colecciones llevan `take`, porque una ficha es una pantalla y no
 * un archivo histórico completo. El docstring ya lo afirmaba, pero solo lo
 * cumplían dos de las seis: `consents`, `requests`, `notes` y `followUps` venían
 * sin cota, así que un contacto veterano con cientos de notas y decenas de
 * solicitudes serializaba todos los cuerpos en el payload del Server Component.
 * No era una fuga —quien lo recibe está autorizado— pero sí una página que crecía
 * sin límite con los datos, y una promesa escrita que no se cumplía: quien leyera
 * este comentario daría por acotado algo que no lo estaba.
 *
 * Para el histórico completo: el listado paginado de Solicitudes y la exportación.
 */
export async function getLeadDetail(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      // Los consentimientos de una persona son pocos por naturaleza, pero el tope
      // evita que un bucle de revocaciones y concesiones haga crecer la ficha.
      consents: { orderBy: { createdAt: "desc" }, take: 50 },
      requests: {
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { owner: { select: { id: true, name: true } } },
      },
      interactions: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          contentEntry: {
            select: { id: true, slug: true, type: true, translations: { where: { locale: "ES" }, select: { title: true } } },
          },
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { actor: { select: { id: true, name: true } } },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { author: { select: { id: true, name: true } } },
      },
      followUps: {
        orderBy: [{ status: "asc" }, { dueAt: "asc" }],
        take: 50,
        include: { assignee: { select: { id: true, name: true } } },
      },
    },
  })
}

export type LeadDetail = NonNullable<Awaited<ReturnType<typeof getLeadDetail>>>

/**
 * Sesiones de acceso VIP vivas de un contacto.
 *
 * Se cuenta aparte de `getLeadDetail` y **sin traer las filas**: una sesión contiene
 * el hash de su token, y ese valor no tiene ninguna razón para viajar hasta un
 * componente de interfaz. Aquí solo hace falta el número, para saber si hay algo que
 * revocar.
 */
export async function countActiveVipSessions(leadId: string): Promise<number> {
  return prisma.vipAccessSession.count({
    where: { leadId, revokedAt: null, expiresAt: { gt: new Date() } },
  })
}
