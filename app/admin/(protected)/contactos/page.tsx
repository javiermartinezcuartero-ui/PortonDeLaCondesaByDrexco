import type { Metadata } from "next"
import Link from "next/link"
import type { InteractionType } from "@prisma/client"
import { roleHasPermission } from "@/lib/auth/session"
import { requireCrmAccess } from "../guards"
import { LEAD_LIST_PAGE_SIZE, listLeadSources, listLeadsForAdmin, listTags } from "@/lib/domain/crm-leads"
import { INTERACTION_LABEL, LIFECYCLE_LABEL, formatDate, leadName } from "@/lib/crm/labels"
import {
  parseDateParam,
  parseEndOfDayParam,
  parseEnumParam,
  parsePageParam,
  parsePositiveIntParam,
} from "@/lib/validation/crm"
import {
  EmptyState,
  Pagination,
  Pill,
  buttonClass,
  filterFieldClass,
  filterLabelClass,
  secondaryButtonClass,
} from "../crm-ui"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Contactos",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

const INTERACTION_VALUES: InteractionType[] = ["GATE_GRANTED", "SECTION_VIEWED", "CONTENT_VIEWED", "CTA_CLICKED"]

type SearchParams = {
  q?: string
  origen?: string
  etiqueta?: string
  score?: string
  interaccion?: string
  marketing?: string
  desde?: string
  hasta?: string
  pagina?: string
}

export default async function ContactsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireCrmAccess()
  const params = await searchParams

  const filters = {
    search: params.q,
    source: params.origen || undefined,
    tag: params.etiqueta || undefined,
    minScore: parsePositiveIntParam(params.score, 1_000),
    interaction: parseEnumParam(params.interaccion, INTERACTION_VALUES),
    marketingConsent: params.marketing === "si" ? true : params.marketing === "no" ? false : undefined,
    from: parseDateParam(params.desde),
    to: parseEndOfDayParam(params.hasta),
    page: parsePageParam(params.pagina),
    pageSize: LEAD_LIST_PAGE_SIZE,
  }

  const [{ leads, total, page, totalPages }, sources, tags] = await Promise.all([
    listLeadsForAdmin(filters),
    listLeadSources(),
    listTags(),
  ])

  const canExport = roleHasPermission(user.role, "crm:export")

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value)
  const buildHref = (nextPage: number) => {
    const next = new URLSearchParams(query)
    next.set("pagina", String(nextPage))
    return `/admin/contactos?${next.toString()}`
  }

  const exportQuery = new URLSearchParams(query)
  exportQuery.delete("pagina")

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-light text-foreground">Contactos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Personas identificadas por su email, con su historial comercial completo.
          </p>
        </div>
        {canExport && (
          <a href={`/api/admin/crm/export?conjunto=contactos&${exportQuery.toString()}`} className={secondaryButtonClass}>
            Exportar CSV
          </a>
        )}
      </div>

      {/* Formulario GET: los filtros acaban en la URL, así una vista filtrada se
          puede compartir o guardar en marcadores, y funciona sin JavaScript. */}
      <form method="get" className="space-y-4 border border-border p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="q" className={filterLabelClass}>
              Buscar por nombre, email o teléfono
            </label>
            <input id="q" name="q" type="search" defaultValue={params.q ?? ""} className={filterFieldClass} />
          </div>
          <div>
            <label htmlFor="origen" className={filterLabelClass}>
              Origen
            </label>
            <select id="origen" name="origen" defaultValue={params.origen ?? ""} className={filterFieldClass}>
              <option value="">Cualquiera</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="etiqueta" className={filterLabelClass}>
              Etiqueta
            </label>
            <select id="etiqueta" name="etiqueta" defaultValue={params.etiqueta ?? ""} className={filterFieldClass}>
              <option value="">Cualquiera</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="score" className={filterLabelClass}>
              Puntuación mínima
            </label>
            <input
              id="score"
              name="score"
              type="number"
              min={0}
              defaultValue={params.score ?? ""}
              className={filterFieldClass}
            />
          </div>
          <div>
            <label htmlFor="interaccion" className={filterLabelClass}>
              Interacción
            </label>
            <select id="interaccion" name="interaccion" defaultValue={params.interaccion ?? ""} className={filterFieldClass}>
              <option value="">Cualquiera</option>
              {INTERACTION_VALUES.map((value) => (
                <option key={value} value={value}>
                  {INTERACTION_LABEL[value]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="marketing" className={filterLabelClass}>
              Consentimiento de marketing
            </label>
            <select id="marketing" name="marketing" defaultValue={params.marketing ?? ""} className={filterFieldClass}>
              <option value="">Indiferente</option>
              <option value="si">Concedido</option>
              <option value="no">Sin conceder</option>
            </select>
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
        </div>
        <div className="flex gap-2">
          <button type="submit" className={buttonClass}>
            Filtrar
          </button>
          <Link href="/admin/contactos" className={secondaryButtonClass}>
            Limpiar
          </Link>
        </div>
      </form>

      {leads.length === 0 ? (
        <EmptyState>No hay contactos que coincidan con estos filtros.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <caption className="sr-only">Contactos del CRM</caption>
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-[0.15em] text-muted-foreground">
                <th scope="col" className="py-2.5 pr-4">Contacto</th>
                <th scope="col" className="py-2.5 pr-4">Teléfono</th>
                <th scope="col" className="py-2.5 pr-4">Puntuación</th>
                <th scope="col" className="py-2.5 pr-4">Origen</th>
                <th scope="col" className="py-2.5 pr-4">Solicitudes</th>
                <th scope="col" className="py-2.5 pr-4">Interacciones</th>
                <th scope="col" className="py-2.5">Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-border/60 align-top">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/admin/contactos/${lead.id}`}
                      className="text-foreground transition-colors duration-300 hover:text-accent"
                    >
                      {leadName(lead)}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{lead.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {lead.lifecycle !== "ACTIVE" && <Pill tone="alert">{LIFECYCLE_LABEL[lead.lifecycle]}</Pill>}
                      {lead.tags.map((entry) => (
                        <Pill key={entry.tag.name}>{entry.tag.name}</Pill>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{lead.phone ?? "—"}</td>
                  <td className="py-3 pr-4 text-foreground">{lead.score}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{lead.firstSource ?? "—"}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{lead._count.requests}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{lead._count.interactions}</td>
                  <td className="py-3 text-muted-foreground">{formatDate(lead.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} noun="contactos" buildHref={buildHref} />
    </div>
  )
}
