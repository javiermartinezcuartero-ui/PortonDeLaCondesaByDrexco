import type { Metadata } from "next"
import Link from "next/link"
import type { LeadRequestStatus } from "@prisma/client"
import { requireCrmAccess } from "../guards"
import { listRequestsForPipeline, type PipelineCard } from "@/lib/domain/crm-requests"
import { allowedTransitionsFrom } from "@/lib/domain/lead-requests"
import {
  PIPELINE_COLUMN_ORDER,
  PRIORITY_LABEL,
  REQUEST_STATUS_LABEL,
  eventTypeLabel,
  formatDate,
  leadName,
} from "@/lib/crm/labels"
import { ChangeStatusForm } from "../crm-forms"
import { EmptyState, Pill, SectionTitle, secondaryButtonClass } from "../crm-ui"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Pipeline",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

/**
 * Tablero del pipeline.
 *
 * **No hay arrastrar y soltar, a propósito.** Un tablero con drag and drop
 * accesible de verdad exige una alternativa completa de teclado, anuncios en vivo
 * de cada movimiento y un manejo del foco que sobreviva al reordenado; y aun así
 * el gesto no comunica la restricción que de verdad importa aquí, que es qué
 * transiciones permite la máquina de estados. Cada tarjeta lleva en su lugar un
 * desplegable con **solo los estados válidos** desde donde está, que funciona con
 * teclado, con lector de pantalla y en móvil sin ningún trabajo extra.
 *
 * La vista de tabla (`?vista=tabla`) no es un premio de consolación: es la misma
 * información en una estructura que se recorre linealmente, útil para revisar
 * muchas solicitudes seguidas.
 */

type SearchParams = { vista?: string }

export default async function PipelinePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireCrmAccess()

  const params = await searchParams
  const view = params.vista === "tabla" ? "tabla" : "tablero"

  const cards = await listRequestsForPipeline()

  const byStatus = new Map<LeadRequestStatus, PipelineCard[]>()
  for (const status of PIPELINE_COLUMN_ORDER) byStatus.set(status, [])
  for (const card of cards) byStatus.get(card.status)?.push(card)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-light text-foreground">Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cards.length} solicitudes activas. Cada movimiento valida la transición y queda registrado.
          </p>
        </div>
        <Link href={view === "tabla" ? "/admin/pipeline" : "/admin/pipeline?vista=tabla"} className={secondaryButtonClass}>
          {view === "tabla" ? "Ver como tablero" : "Ver como tabla"}
        </Link>
      </div>

      {cards.length === 0 ? (
        <EmptyState>No hay solicitudes activas en el pipeline.</EmptyState>
      ) : view === "tabla" ? (
        <PipelineTable cards={cards} />
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4">
            {PIPELINE_COLUMN_ORDER.map((status) => {
              const column = byStatus.get(status) ?? []
              return (
                <section key={status} aria-labelledby={`col-${status}`} className="w-72 shrink-0">
                  <SectionTitle>
                    <span id={`col-${status}`}>
                      {REQUEST_STATUS_LABEL[status]} ({column.length})
                    </span>
                  </SectionTitle>
                  {column.length === 0 ? (
                    <p className="border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                      Vacío
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {column.map((card) => (
                        <li key={card.id} className="border border-border p-3">
                          <Link
                            href={`/admin/solicitudes/${card.id}`}
                            className="text-sm text-foreground transition-colors duration-300 hover:text-accent"
                          >
                            {card.subject ?? eventTypeLabel(card.eventType)}
                          </Link>
                          <p className="mt-0.5 text-xs text-muted-foreground">{leadName(card.lead)}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {card.priority !== "NORMAL" && (
                              <Pill tone={card.priority === "URGENT" ? "alert" : "neutral"}>
                                {PRIORITY_LABEL[card.priority]}
                              </Pill>
                            )}
                            {card.eventDate && <Pill>{formatDate(card.eventDate)}</Pill>}
                          </div>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {card.owner?.name ?? "Sin asignar"}
                            {card.nextActionAt ? ` · próxima acción ${formatDate(card.nextActionAt)}` : ""}
                          </p>
                          <div className="mt-3">
                            <ChangeStatusForm
                              requestId={card.id}
                              currentStatus={card.status}
                              allowed={allowedTransitionsFrom(card.status)}
                              compact
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function PipelineTable({ cards }: { cards: PipelineCard[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <caption className="sr-only">Solicitudes activas del pipeline, con su estado y las transiciones posibles</caption>
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-[0.15em] text-muted-foreground">
            <th scope="col" className="py-2.5 pr-4">Solicitud</th>
            <th scope="col" className="py-2.5 pr-4">Contacto</th>
            <th scope="col" className="py-2.5 pr-4">Estado</th>
            <th scope="col" className="py-2.5 pr-4">Responsable</th>
            <th scope="col" className="py-2.5">Mover</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr key={card.id} className="border-b border-border/60 align-top">
              <td className="py-3 pr-4">
                <Link
                  href={`/admin/solicitudes/${card.id}`}
                  className="text-foreground transition-colors duration-300 hover:text-accent"
                >
                  {card.subject ?? eventTypeLabel(card.eventType)}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {eventTypeLabel(card.eventType)}
                  {card.eventDate ? ` · ${formatDate(card.eventDate)}` : ""}
                </p>
              </td>
              <td className="py-3 pr-4 text-muted-foreground">{leadName(card.lead)}</td>
              <td className="py-3 pr-4">
                <Pill tone={card.status === "LOST" ? "alert" : card.status === "WON" ? "accent" : "neutral"}>
                  {REQUEST_STATUS_LABEL[card.status]}
                </Pill>
              </td>
              <td className="py-3 pr-4 text-muted-foreground">{card.owner?.name ?? "Sin asignar"}</td>
              <td className="py-3">
                <ChangeStatusForm
                  requestId={card.id}
                  currentStatus={card.status}
                  allowed={allowedTransitionsFrom(card.status)}
                  compact
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
