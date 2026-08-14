import type { Metadata } from "next"
import Link from "next/link"
import type { ContentStatus, ContentType } from "@prisma/client"
import { requireCmsAccess } from "../guards"
import {
  CONTENT_LIST_PAGE_SIZE,
  countContentEntriesByStatus,
  listContentEntriesForAdmin,
} from "@/lib/domain/content"
import { formatDate } from "@/lib/crm/labels"
import { parsePageParam } from "@/lib/validation/crm"
import { EmptyState, Pagination, Pill, buttonClass } from "../crm-ui"
import { ContentRowActions } from "./content-row-actions"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Contenidos Biblioteca",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

/**
 * Listado de fichas de las bibliotecas.
 *
 * **Sin pestañas, sin buscador y sin filtros**, igual que la pantalla de Acciones y por
 * petición del titular: una sola tabla con todas las fichas. Antes había seis pestañas
 * (Todo, Bodas, Catering, Borradores, Publicados, Archivados) más un formulario de seis
 * campos, es decir, doce controles para elegir entre las fichas que hay —que hoy son
 * siete—. El coste de leer todo eso era mayor que el de recorrer la tabla entera.
 *
 * Se conserva la paginación, y eso no es una contradicción: es la única de las piezas
 * retiradas que no era un filtro, y sin ella una biblioteca que crezca a cientos de fichas
 * traería cientos de filas en cada carga.
 *
 * El tipo y el estado dejan de ser columnas de texto y pasan a pastilla, que es lo que
 * permite reconocerlos sin leerlos. La fecha del evento entra en la tabla porque es el dato
 * por el que se busca una ficha cuando no se recuerda el título.
 */

const STATUS_LABEL: Record<ContentStatus, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  ARCHIVED: "Archivado",
}

const STATUS_TONE: Record<ContentStatus, string> = {
  DRAFT: "ambar",
  PUBLISHED: "verde",
  ARCHIVED: "gris",
}

const TYPE_LABEL: Record<ContentType, string> = {
  REAL_WEDDING: "Boda real",
  CATERING_EVENT: "Catering",
}

const TYPE_TONE: Record<ContentType, string> = {
  REAL_WEDDING: "violeta",
  CATERING_EVENT: "cian",
}

type SearchParams = { pagina?: string }

export default async function AdminContentListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireCmsAccess()

  const params = await searchParams
  const page = parsePageParam(params.pagina)

  const [{ entries, total, totalPages }, counts] = await Promise.all([
    listContentEntriesForAdmin({ page, pageSize: CONTENT_LIST_PAGE_SIZE }),
    countContentEntriesByStatus(),
  ])

  const buildHref = (nextPage: number) => `/admin/contenidos?pagina=${nextPage}`

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-light text-foreground">Contenidos Biblioteca</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fichas de bodas reales y catering que se muestran en las bibliotecas privadas. {counts.ALL} en total ·{" "}
            {counts.PUBLISHED} publicadas · {counts.DRAFT} borradores · {counts.ARCHIVED} archivadas.
          </p>
        </div>
        <Link href="/admin/contenidos/nuevo" className={buttonClass}>
          Nueva ficha
        </Link>
      </div>

      {entries.length === 0 ? (
        <EmptyState>Todavía no hay ninguna ficha. Empieza por «Nueva ficha».</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <caption className="sr-only">Fichas de contenido de bodas reales y catering</caption>
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                <th scope="col" className="py-2.5 pr-3">Ficha</th>
                <th scope="col" className="py-2.5 pr-3">Biblioteca</th>
                <th scope="col" className="py-2.5 pr-3">Estado</th>
                <th scope="col" className="py-2.5 pr-3">Fecha del evento</th>
                <th scope="col" className="py-2.5 pr-3">Espacio</th>
                <th scope="col" className="py-2.5 pr-3">Orden</th>
                <th scope="col" className="py-2.5 pr-3">Archivos</th>
                <th scope="col" className="py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const spanish = entry.translations.find((translation) => translation.locale === "ES")
                const title = spanish?.title ?? "(sin título)"

                return (
                  <tr key={entry.id} className="align-top">
                    <td className="py-3 pr-3">
                      <Link
                        href={`/admin/contenidos/${entry.id}`}
                        className="text-foreground transition-colors duration-300 hover:text-accent"
                      >
                        {title}
                      </Link>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{entry.slug}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {entry.isDemo && <Pill>Ejemplo</Pill>}
                        {entry.featured && <Pill tone="accent">Destacado</Pill>}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="pipe-pill" data-tono={TYPE_TONE[entry.type]}>
                        {TYPE_LABEL[entry.type]}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="pipe-pill" data-tono={STATUS_TONE[entry.status]}>
                        {STATUS_LABEL[entry.status]}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">{formatDate(entry.eventDate)}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{entry.space ?? "—"}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{entry.sortOrder}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{entry._count.media}</td>
                    <td className="py-3">
                      <ContentRowActions id={entry.id} status={entry.status} title={title} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} noun="fichas" buildHref={buildHref} />
    </div>
  )
}
