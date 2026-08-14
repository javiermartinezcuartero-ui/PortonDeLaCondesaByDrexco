import type { Metadata } from "next"
import Link from "next/link"
import { roleHasPermission } from "@/lib/auth/session"
import { requireCrmAccess } from "../guards"
import { ExportButton } from "../export-button"
import {
  REQUEST_LIST_PAGE_SIZE,
  REQUEST_SORTS,
  listAssignableUsers,
  listRequestFilterOptions,
  listRequestsForAdmin,
  type RequestSortKey,
} from "@/lib/domain/crm-requests"
import {
  PRIORITY_LABEL,
  REQUEST_STATUS_LABEL,
  eventTypeLabel,
  formatDate,
  leadName,
  spaceLabel,
} from "@/lib/crm/labels"
import {
  LEAD_REQUEST_STATUS_VALUES,
  PRIORITY_VALUES,
  parseDateParam,
  parseEndOfDayParam,
  parseEnumParam,
  parsePageParam,
  parsePositiveIntParam,
} from "@/lib/validation/crm"
import { EmptyState, FilterPanel, Pagination, StatusPill, filterFieldClass, filterLabelClass } from "../crm-ui"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Solicitudes Formulario",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

const SORT_LABEL: Record<RequestSortKey, string> = {
  recientes: "Más recientes",
  antiguas: "Más antiguas",
  actualizadas: "Actualizadas",
  "proxima-accion": "Próxima acción",
  prioridad: "Prioridad",
  invitados: "Invitados",
}

type SearchParams = {
  q?: string
  estado?: string
  prioridad?: string
  tipo?: string
  espacio?: string
  responsable?: string
  origen?: string
  campana?: string
  ficha?: string
  minInvitados?: string
  maxInvitados?: string
  desde?: string
  hasta?: string
  orden?: string
  pagina?: string
}

export default async function RequestsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireCrmAccess()
  const params = await searchParams

  const sortKeys = Object.keys(REQUEST_SORTS) as RequestSortKey[]

  const filters = {
    search: params.q,
    status: parseEnumParam(params.estado, LEAD_REQUEST_STATUS_VALUES),
    priority: parseEnumParam(params.prioridad, PRIORITY_VALUES),
    eventType: params.tipo || undefined,
    preferredSpace: params.espacio || undefined,
    ownerId: params.responsable && params.responsable !== "sin-asignar" ? params.responsable : undefined,
    unassigned: params.responsable === "sin-asignar",
    utmSource: params.origen || undefined,
    utmCampaign: params.campana || undefined,
    sourceContentId: params.ficha || undefined,
    minGuests: parsePositiveIntParam(params.minInvitados, 10_000),
    maxGuests: parsePositiveIntParam(params.maxInvitados, 10_000),
    from: parseDateParam(params.desde),
    to: parseEndOfDayParam(params.hasta),
    // Orden por lista blanca: un valor desconocido cae al predeterminado.
    sort: parseEnumParam(params.orden, sortKeys) ?? ("recientes" as RequestSortKey),
    page: parsePageParam(params.pagina),
    pageSize: REQUEST_LIST_PAGE_SIZE,
  }

  const [{ requests, total, page, totalPages }, options, users] = await Promise.all([
    listRequestsForAdmin(filters),
    listRequestFilterOptions(),
    listAssignableUsers(),
  ])

  const canExport = roleHasPermission(user.role, "crm:export")

  // Cuántos filtros hay puestos. Se descuentan `pagina` y `orden`: la primera es
  // paginación y la segunda es ordenación —siempre trae un valor—, así que contarlas
  // dejaría el bloque abierto siempre y el recuento no significaría nada.
  const activeFilters = (Object.keys(params) as Array<keyof SearchParams>).filter(
    (key) => key !== "pagina" && key !== "orden" && params[key]
  ).length

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value)
  const buildHref = (nextPage: number) => {
    const next = new URLSearchParams(query)
    next.set("pagina", String(nextPage))
    return `/admin/solicitudes?${next.toString()}`
  }

  const exportQuery = new URLSearchParams(query)
  exportQuery.delete("pagina")

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-light text-foreground">Solicitudes Formulario</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Peticiones de información llegadas por el formulario de la web. Cada envío es una solicitud propia:
            nunca se sobrescribe una anterior.
          </p>
        </div>
        {canExport && (
          <ExportButton
            href={`/api/admin/crm/export?conjunto=solicitudes&${exportQuery.toString()}`}
            label="Descargar las solicitudes en Excel"
          />
        )}
      </div>

      <FilterPanel activeCount={activeFilters} clearHref="/admin/solicitudes">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="q" className={filterLabelClass}>
              Buscar por asunto, nombre o email
            </label>
            <input id="q" name="q" type="search" defaultValue={params.q ?? ""} className={filterFieldClass} />
          </div>
          <div>
            <label htmlFor="estado" className={filterLabelClass}>
              Estado
            </label>
            <select id="estado" name="estado" defaultValue={params.estado ?? ""} className={filterFieldClass}>
              <option value="">Cualquiera</option>
              {LEAD_REQUEST_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {REQUEST_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="prioridad" className={filterLabelClass}>
              Prioridad
            </label>
            <select id="prioridad" name="prioridad" defaultValue={params.prioridad ?? ""} className={filterFieldClass}>
              <option value="">Cualquiera</option>
              {PRIORITY_VALUES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABEL[priority]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tipo" className={filterLabelClass}>
              Tipo de evento
            </label>
            <select id="tipo" name="tipo" defaultValue={params.tipo ?? ""} className={filterFieldClass}>
              <option value="">Cualquiera</option>
              {options.eventTypes.map((type) => (
                <option key={type} value={type}>
                  {eventTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="espacio" className={filterLabelClass}>
              Espacio
            </label>
            <select id="espacio" name="espacio" defaultValue={params.espacio ?? ""} className={filterFieldClass}>
              <option value="">Cualquiera</option>
              {options.spaces.map((space) => (
                <option key={space} value={space}>
                  {spaceLabel(space)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="responsable" className={filterLabelClass}>
              Responsable
            </label>
            <select id="responsable" name="responsable" defaultValue={params.responsable ?? ""} className={filterFieldClass}>
              <option value="">Cualquiera</option>
              <option value="sin-asignar">Sin asignar</option>
              {users.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="origen" className={filterLabelClass}>
              Origen (utm_source)
            </label>
            <select id="origen" name="origen" defaultValue={params.origen ?? ""} className={filterFieldClass}>
              <option value="">Cualquiera</option>
              {options.sources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="campana" className={filterLabelClass}>
              Campaña
            </label>
            <select id="campana" name="campana" defaultValue={params.campana ?? ""} className={filterFieldClass}>
              <option value="">Cualquiera</option>
              {options.campaigns.map((campaign) => (
                <option key={campaign} value={campaign}>
                  {campaign}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="minInvitados" className={filterLabelClass}>
                Invitados mín.
              </label>
              <input
                id="minInvitados"
                name="minInvitados"
                type="number"
                min={0}
                defaultValue={params.minInvitados ?? ""}
                className={filterFieldClass}
              />
            </div>
            <div>
              <label htmlFor="maxInvitados" className={filterLabelClass}>
                Máx.
              </label>
              <input
                id="maxInvitados"
                name="maxInvitados"
                type="number"
                min={0}
                defaultValue={params.maxInvitados ?? ""}
                className={filterFieldClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="desde" className={filterLabelClass}>
              Alta desde
            </label>
            <input id="desde" name="desde" type="date" defaultValue={params.desde ?? ""} className={filterFieldClass} />
          </div>
          <div>
            <label htmlFor="hasta" className={filterLabelClass}>
              Alta hasta
            </label>
            <input id="hasta" name="hasta" type="date" defaultValue={params.hasta ?? ""} className={filterFieldClass} />
          </div>
          <div>
            <label htmlFor="orden" className={filterLabelClass}>
              Ordenar por
            </label>
            <select id="orden" name="orden" defaultValue={params.orden ?? "recientes"} className={filterFieldClass}>
              {sortKeys.map((key) => (
                <option key={key} value={key}>
                  {SORT_LABEL[key]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {params.ficha && <input type="hidden" name="ficha" value={params.ficha} />}
      </FilterPanel>

      {requests.length === 0 ? (
        <EmptyState>No hay solicitudes que coincidan con estos filtros.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <caption className="sr-only">Solicitudes comerciales</caption>
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-[0.15em] text-muted-foreground">
                <th scope="col" className="py-2.5 pr-4">Solicitud</th>
                <th scope="col" className="py-2.5 pr-4">Contacto</th>
                <th scope="col" className="py-2.5 pr-4">Estado</th>
                <th scope="col" className="py-2.5 pr-4">Prioridad</th>
                <th scope="col" className="py-2.5 pr-4">Evento</th>
                <th scope="col" className="py-2.5 pr-4">Invitados</th>
                <th scope="col" className="py-2.5 pr-4">Responsable</th>
                <th scope="col" className="py-2.5">Próxima acción</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-b border-border/60 align-top">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/admin/solicitudes/${request.id}`}
                      className="text-foreground transition-colors duration-300 hover:text-accent"
                    >
                      {request.subject ?? eventTypeLabel(request.eventType)}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(request.createdAt)}
                      {request.utmSource ? ` · ${request.utmSource}` : ""}
                      {request.sourceContentId ? " · desde una ficha" : ""}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <Link
                      href={`/admin/contactos/${request.lead.id}`}
                      className="text-muted-foreground transition-colors duration-300 hover:text-foreground"
                    >
                      {leadName(request.lead)}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{request.lead.email}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusPill status={request.status} />
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{PRIORITY_LABEL[request.priority]}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {eventTypeLabel(request.eventType)}
                    {request.eventDate && <span className="block text-xs">{formatDate(request.eventDate)}</span>}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{request.guestCount ?? "—"}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{request.owner?.name ?? "Sin asignar"}</td>
                  <td className="py-3 text-muted-foreground">{formatDate(request.nextActionAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} noun="solicitudes" buildHref={buildHref} />
    </div>
  )
}
