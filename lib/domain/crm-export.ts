import { prisma } from "@/lib/db"
import { recordAuditEvent } from "@/lib/domain/audit"
import { buildLeadWhere, type LeadListFilters } from "@/lib/domain/crm-leads"
import { buildRequestWhere, type RequestListFilters } from "@/lib/domain/crm-requests"

/**
 * Qué se exporta del CRM. **Cómo** se serializa está en `crm-workbook.ts`.
 *
 * La separación es deliberada y se hizo al pasar de CSV a Excel: este módulo consulta
 * y decide columnas, el otro da forma al archivo. Antes estaban juntos, y el resultado
 * fue que la decisión de seguridad más importante del proyecto —qué columnas salen—
 * compartía archivo con el escapado de comillas.
 *
 * Una exportación es la salida más peligrosa de todo el proyecto: sale del control de
 * acceso de la aplicación, se reenvía y se abre en el equipo de alguien. De ahí las dos
 * reglas que gobiernan este módulo:
 *
 * 1. **Lista blanca de columnas.** No se serializa una fila de Prisma tal cual; cada
 *    columna se declara aquí. Así una columna nueva en el esquema (un hash, un token,
 *    un campo interno) no aparece en el archivo por descuido: para exportarla hay que
 *    añadirla a mano, que es exactamente la fricción que se quiere. Nunca salen
 *    credenciales, tokens, hashes, metadata interna ni claves.
 * 2. **Toda exportación deja un AuditEvent**: quién, qué conjunto y cuántas filas.
 *
 * La tercera regla que había aquí —neutralizar fórmulas para evitar que Excel ejecute
 * un `=HYPERLINK(...)` escrito por un visitante— ya no hace falta: en `.xlsx` cada
 * celda declara su tipo y una cadena es una cadena. Ver `crm-workbook.ts`.
 */

/** Tope de filas por exportación. Evita que un clic tumbe el servidor. */
export const EXPORT_MAX_ROWS = 5_000

/**
 * Una tabla lista para serializar: cabeceras y filas, sin formato.
 *
 * Se devuelve esto y no un archivo para que la decisión de formato viva en un solo
 * sitio —la ruta— y para que las pruebas puedan comprobar **qué datos** salen sin
 * tener que abrir un libro de Excel para leerlos.
 */
export type ExportTable = {
  headers: string[]
  rows: unknown[][]
}

// ---------------------------------------------------------------------------
// Contactos
// ---------------------------------------------------------------------------

const LEAD_HEADERS = [
  "Nombre",
  "Apellidos",
  "Email",
  "Teléfono",
  "Puntuación",
  "Ciclo de vida",
  "Origen inicial",
  "Origen reciente",
  "Primera visita",
  "Última actividad",
  "Solicitudes",
  "Etiquetas",
  "Consiente marketing",
]

export type ExportOptions = {
  actorId: string
  /**
   * Las notas internas son la opinión del equipo sobre una persona. Solo salen
   * si se pide expresamente, y esa decisión queda en la auditoría.
   */
  includeNotes?: boolean
}

export async function exportLeadsTable(filters: LeadListFilters, options: ExportOptions): Promise<ExportTable> {
  const where = buildLeadWhere(filters)

  const leads = await prisma.lead.findMany({
    where,
    // Mismo criterio único que el listado: con el tope de filas, un orden ambiguo
    // decide de forma no determinista a quién recorta.
    orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    take: EXPORT_MAX_ROWS,
    // `select` explícito, nunca `include` completo: así no se cuela una columna
    // nueva del esquema en el archivo.
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      score: true,
      lifecycle: true,
      firstSource: true,
      lastSource: true,
      firstSeenAt: true,
      lastActivityAt: true,
      tags: { select: { tag: { select: { name: true } } } },
      consents: { where: { purpose: "MARKETING", granted: true }, select: { id: true }, take: 1 },
      _count: { select: { requests: true } },
    },
  })

  // Las notas se consultan en una segunda pasada y solo si se piden: cuando no
  // se exportan, sus cuerpos no llegan ni a leerse de la base de datos.
  const notesByLead = new Map<string, string[]>()
  if (options.includeNotes && leads.length > 0) {
    const notes = await prisma.leadNote.findMany({
      where: { leadId: { in: leads.map((lead) => lead.id) } },
      orderBy: { createdAt: "desc" },
      select: { leadId: true, body: true, createdAt: true },
    })
    for (const note of notes) {
      const entry = notesByLead.get(note.leadId) ?? []
      entry.push(`[${note.createdAt.toISOString().slice(0, 10)}] ${note.body}`)
      notesByLead.set(note.leadId, entry)
    }
  }

  const headers = options.includeNotes ? [...LEAD_HEADERS, "Notas internas"] : LEAD_HEADERS

  const rows = leads.map((lead) => {
    const row: unknown[] = [
      lead.firstName,
      lead.lastName,
      lead.email,
      lead.phone,
      lead.score,
      lead.lifecycle,
      lead.firstSource,
      lead.lastSource,
      lead.firstSeenAt,
      lead.lastActivityAt,
      lead._count.requests,
      lead.tags.map((entry) => entry.tag.name).join(", "),
      lead.consents.length > 0,
    ]

    if (options.includeNotes) {
      row.push((notesByLead.get(lead.id) ?? []).join(" | "))
    }

    return row
  })

  await recordAuditEvent({
    entityType: "Lead",
    entityId: "export",
    action: "crm.export.leads",
    actorId: options.actorId,
    metadata: { filas: rows.length, incluyeNotas: Boolean(options.includeNotes), filtros: describeFilters(filters) },
  })

  return { headers, rows }
}

// ---------------------------------------------------------------------------
// Solicitudes
// ---------------------------------------------------------------------------

const REQUEST_HEADERS = [
  "Fecha de alta",
  "Estado",
  "Prioridad",
  "Tipo de evento",
  "Fecha del evento",
  "Invitados",
  "Espacio",
  "Presupuesto",
  "Asunto",
  "Mensaje",
  "Empresa",
  "Cargo",
  "Necesidades audiovisuales",
  "Nombre",
  "Apellidos",
  "Email",
  "Teléfono",
  "Responsable",
  "Próxima acción",
  "Motivo de pérdida",
  "Página de origen",
  "Formulario",
  "Ficha de origen",
  "Referente",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
]

export async function exportRequestsTable(filters: RequestListFilters, options: ExportOptions): Promise<ExportTable> {
  const where = buildRequestWhere(filters)

  const requests = await prisma.leadRequest.findMany({
    where,
    // Criterio único, como en el resto: con el tope de filas, un orden ambiguo
    // decide de forma no determinista a quién recorta.
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: EXPORT_MAX_ROWS,
    select: {
      createdAt: true,
      status: true,
      priority: true,
      eventType: true,
      eventDate: true,
      guestCount: true,
      preferredSpace: true,
      budgetRange: true,
      subject: true,
      message: true,
      company: true,
      jobTitle: true,
      audiovisualNeeds: true,
      nextActionAt: true,
      lostReason: true,
      sourcePage: true,
      sourceForm: true,
      sourceContentId: true,
      referrer: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      utmContent: true,
      utmTerm: true,
      leadId: true,
      owner: { select: { name: true } },
    },
  })

  // El contacto se lee en una consulta aparte, en lugar de con un `select`
  // anidado, y no es una cuestión de estilo.
  //
  // `LeadRequest.lead` es una relación **obligatoria** en el esquema. Prisma
  // resuelve una relación anidada con una segunda consulta, y si entre las dos el
  // contacto ha desaparecido lanza `Inconsistent query result: Field lead is
  // required to return data, got null` y **la exportación entera devuelve 500**.
  // No es teórico: apareció como fallo intermitente en la suite, donde otro
  // archivo de pruebas borra contactos en paralelo. En producción la ventana es
  // estrecha —`anonymizeLead` no borra el contacto, solo lo vacía— pero existe:
  // basta con exportar mientras alguien ejecuta `demo:clean` o borra un contacto.
  //
  // Con dos consultas explícitas el número de viajes a la base no cambia, y una
  // fila huérfana se omite en vez de tumbar la descarga.
  const leadIds = [...new Set(requests.map((request) => request.leadId))]
  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds } },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  })
  const leadById = new Map(leads.map((lead) => [lead.id, lead]))

  const rows = requests
    // Una solicitud sin contacto es un estado transitorio que dejará de existir en
    // cuanto la cascada termine. Se omite: una línea de CSV con un mensaje y sin
    // nadie a quien atribuirlo no sirve para nada y además no se sabe de quién era.
    .filter((request) => leadById.has(request.leadId))
    .map((request) => [
    request.createdAt,
    request.status,
    request.priority,
    request.eventType,
    request.eventDate,
    request.guestCount,
    request.preferredSpace,
    request.budgetRange,
    request.subject,
    request.message,
    request.company,
    request.jobTitle,
    request.audiovisualNeeds,
    leadById.get(request.leadId)!.firstName,
    leadById.get(request.leadId)!.lastName,
    leadById.get(request.leadId)!.email,
    leadById.get(request.leadId)!.phone,
    request.owner?.name ?? null,
    request.nextActionAt,
    request.lostReason,
    request.sourcePage,
    request.sourceForm,
    request.sourceContentId,
    request.referrer,
    request.utmSource,
    request.utmMedium,
    request.utmCampaign,
    request.utmContent,
    request.utmTerm,
  ])

  await recordAuditEvent({
    entityType: "LeadRequest",
    entityId: "export",
    action: "crm.export.requests",
    actorId: options.actorId,
    metadata: { filas: rows.length, filtros: describeFilters(filters) },
  })

  return { headers: REQUEST_HEADERS, rows }
}

/**
 * Descripción de los filtros para la auditoría: solo qué se filtró, sin los
 * términos de búsqueda (que pueden ser el email o el teléfono de una persona).
 */
function describeFilters(filters: Record<string, unknown>): Record<string, unknown> {
  const described: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue
    if (key === "search") {
      described.busqueda = "(término omitido)"
      continue
    }
    described[key] = value instanceof Date ? value.toISOString() : value
  }
  return described
}
