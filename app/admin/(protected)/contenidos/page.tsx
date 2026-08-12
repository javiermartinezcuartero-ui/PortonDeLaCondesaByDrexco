import type { Metadata } from "next"
import Link from "next/link"
import type { ContentStatus, ContentType } from "@prisma/client"
import { requirePermission } from "@/lib/auth/session"
import {
  CONTENT_LIST_PAGE_SIZE,
  countContentEntriesByStatus,
  listContentEntriesForAdmin,
} from "@/lib/domain/content"
import { ContentFilters } from "./content-filters"
import { ContentRowActions } from "./content-row-actions"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Contenidos",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

/** Pestañas del listado. `all` no filtra; el resto fija tipo o estado. */
const TABS = [
  { key: "todo", label: "Todo" },
  { key: "bodas", label: "Bodas reales" },
  { key: "catering", label: "Catering" },
  { key: "borradores", label: "Borradores" },
  { key: "publicados", label: "Publicados" },
  { key: "archivados", label: "Archivados" },
] as const

type TabKey = (typeof TABS)[number]["key"]

function tabFilters(tab: TabKey): { type?: ContentType; status?: ContentStatus } {
  switch (tab) {
    case "bodas":
      return { type: "REAL_WEDDING" }
    case "catering":
      return { type: "CATERING_EVENT" }
    case "borradores":
      return { status: "DRAFT" }
    case "publicados":
      return { status: "PUBLISHED" }
    case "archivados":
      return { status: "ARCHIVED" }
    default:
      return {}
  }
}

const STATUS_LABEL: Record<ContentStatus, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  ARCHIVED: "Archivado",
}

const TYPE_LABEL: Record<ContentType, string> = {
  REAL_WEDDING: "Boda real",
  CATERING_EVENT: "Catering",
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === "si") return true
  if (value === "no") return false
  return undefined
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

type SearchParams = {
  tab?: string
  q?: string
  tipo?: string
  estado?: string
  demo?: string
  destacado?: string
  desde?: string
  hasta?: string
  pagina?: string
}

export default async function AdminContentListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requirePermission("cms:access")

  const params = await searchParams
  const tab = (TABS.find((item) => item.key === params.tab)?.key ?? "todo") as TabKey
  const fromTab = tabFilters(tab)

  // Los filtros explícitos del formulario tienen prioridad sobre la pestaña.
  const type = (params.tipo === "REAL_WEDDING" || params.tipo === "CATERING_EVENT" ? params.tipo : undefined) ?? fromTab.type
  const status =
    (params.estado === "DRAFT" || params.estado === "PUBLISHED" || params.estado === "ARCHIVED"
      ? params.estado
      : undefined) ?? fromTab.status

  const page = Number.parseInt(params.pagina ?? "1", 10)
  const { entries, total, totalPages, page: currentPage } = await listContentEntriesForAdmin({
    type,
    status,
    isDemo: parseBoolean(params.demo),
    featured: parseBoolean(params.destacado),
    search: params.q,
    eventDateFrom: parseDate(params.desde),
    eventDateTo: parseDate(params.hasta),
    page: Number.isFinite(page) ? page : 1,
    pageSize: CONTENT_LIST_PAGE_SIZE,
  })
  const counts = await countContentEntriesByStatus()

  const buildHref = (overrides: Partial<SearchParams>) => {
    const next = new URLSearchParams()
    const merged = { ...params, ...overrides }
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value)
    }
    const query = next.toString()
    return query ? `/admin/contenidos?${query}` : "/admin/contenidos"
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-light text-foreground">Contenidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.ALL} fichas · {counts.PUBLISHED} publicadas · {counts.DRAFT} borradores · {counts.ARCHIVED} archivadas
          </p>
        </div>
        <Link
          href="/admin/contenidos/nuevo"
          className="px-5 py-2.5 text-xs tracking-[0.15em] uppercase text-primary-foreground bg-primary hover:bg-primary/90 transition-colors duration-300"
        >
          Nueva ficha
        </Link>
      </div>

      <nav aria-label="Filtrar por sección" className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((item) => {
          const isActive = item.key === tab
          return (
            <Link
              key={item.key}
              href={buildHref({ tab: item.key, pagina: undefined, tipo: undefined, estado: undefined })}
              aria-current={isActive ? "page" : undefined}
              className={`-mb-px border-b-2 px-4 py-2.5 text-xs tracking-[0.15em] uppercase transition-colors duration-300 ${
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <ContentFilters />

      {entries.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No hay fichas que coincidan con estos filtros.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <caption className="sr-only">Fichas de contenido de bodas reales y catering</caption>
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-[0.15em] text-muted-foreground">
                <th scope="col" className="py-2.5 pr-4">Título</th>
                <th scope="col" className="py-2.5 pr-4">Tipo</th>
                <th scope="col" className="py-2.5 pr-4">Estado</th>
                <th scope="col" className="py-2.5 pr-4">Espacio</th>
                <th scope="col" className="py-2.5 pr-4">Orden</th>
                <th scope="col" className="py-2.5 pr-4">Archivos</th>
                <th scope="col" className="py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const spanish = entry.translations.find((translation) => translation.locale === "ES")
                return (
                  <tr key={entry.id} className="border-b border-border/60 align-top">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/admin/contenidos/${entry.id}`}
                        className="text-foreground hover:text-accent transition-colors duration-300"
                      >
                        {spanish?.title ?? "(sin título)"}
                      </Link>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{entry.slug}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {entry.isDemo && (
                          <span className="bg-secondary px-2 py-0.5 text-[10px] tracking-[0.15em] uppercase text-muted-foreground">
                            Ejemplo
                          </span>
                        )}
                        {entry.featured && (
                          <span className="bg-secondary px-2 py-0.5 text-[10px] tracking-[0.15em] uppercase text-muted-foreground">
                            Destacado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{TYPE_LABEL[entry.type]}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{STATUS_LABEL[entry.status]}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{entry.space ?? "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{entry.sortOrder}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{entry._count.media}</td>
                    <td className="py-3">
                      <ContentRowActions id={entry.id} status={entry.status} title={spanish?.title ?? entry.slug} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Paginación" className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {currentPage} de {totalPages} ({total} fichas)
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={buildHref({ pagina: String(currentPage - 1) })}
                className="border border-border px-3 py-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors duration-300"
              >
                Anterior
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={buildHref({ pagina: String(currentPage + 1) })}
                className="border border-border px-3 py-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors duration-300"
              >
                Siguiente
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  )
}
