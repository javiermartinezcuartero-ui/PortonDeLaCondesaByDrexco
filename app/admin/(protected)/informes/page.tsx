import type { Metadata } from "next"
import Link from "next/link"
import { requireCrmAccess } from "../guards"
import { getReportMetrics } from "@/lib/domain/metrics"
import { PIPELINE_COLUMN_ORDER, REQUEST_STATUS_LABEL, SECTION_LABEL, formatDate } from "@/lib/crm/labels"
import { parseDateParam, parseEndOfDayParam } from "@/lib/validation/crm"
import {
  AverageValue,
  EmptyState,
  MetricCard,
  RatioHint,
  RatioValue,
  SectionTitle,
  buttonClass,
  filterFieldClass,
  filterLabelClass,
  secondaryButtonClass,
} from "../crm-ui"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Informes",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

type SearchParams = { desde?: string; hasta?: string }

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireCrmAccess()
  const params = await searchParams

  const range = { from: parseDateParam(params.desde), to: parseEndOfDayParam(params.hasta) }
  const metrics = await getReportMetrics(range)

  const hasRange = Boolean(range.from || range.to)
  const totalRequests = PIPELINE_COLUMN_ORDER.reduce((sum, status) => sum + metrics.pipeline[status], 0)
  const totalGate = metrics.gateBySection.REAL_WEDDING + metrics.gateBySection.CATERING_EVENT

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif text-3xl font-light text-foreground">Informes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasRange
            ? `Periodo: ${range.from ? formatDate(range.from) : "inicio"} – ${range.to ? formatDate(range.to) : "hoy"}`
            : "Todo el histórico. Filtra por fechas para ver un periodo concreto."}
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 border border-border p-4">
        <div>
          <label htmlFor="desde" className={filterLabelClass}>
            Desde
          </label>
          <input id="desde" name="desde" type="date" defaultValue={params.desde ?? ""} className={filterFieldClass} />
        </div>
        <div>
          <label htmlFor="hasta" className={filterLabelClass}>
            Hasta
          </label>
          <input id="hasta" name="hasta" type="date" defaultValue={params.hasta ?? ""} className={filterFieldClass} />
        </div>
        <button type="submit" className={buttonClass}>
          Aplicar
        </button>
        <Link href="/admin/informes" className={secondaryButtonClass}>
          Todo el histórico
        </Link>
      </form>

      <section aria-labelledby="ratios">
        <SectionTitle hint="Cada ratio muestra su denominador. Sin datos suficientes no se calcula un porcentaje.">
          <span id="ratios">Conversión</span>
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="De identificado a solicitud"
            value={<RatioValue ratio={metrics.identifiedToRequest} />}
            hint={<RatioHint ratio={metrics.identifiedToRequest} noun="contactos identificados" />}
          />
          <MetricCard
            label="Conversión sobre cerradas"
            value={<RatioValue ratio={metrics.conversion} />}
            hint={<RatioHint ratio={metrics.conversion} noun="solicitudes cerradas" />}
          />
          <MetricCard
            label="Tiempo de respuesta"
            value={<AverageValue average={metrics.hoursToFirstContact} unit="h" />}
            hint={
              metrics.hoursToFirstContact.sampleSize === 0
                ? "Ninguna solicitud del periodo ha pasado a Contactada"
                : `Media de ${metrics.hoursToFirstContact.sampleSize} solicitudes`
            }
          />
          <MetricCard
            label="Puntuación media"
            value={<AverageValue average={metrics.averageScore} unit="pts" />}
            hint={
              metrics.averageScore.sampleSize === 0
                ? "Todavía no hay contactos"
                : `Sobre ${metrics.averageScore.sampleSize} contactos (histórico completo)`
            }
          />
        </div>
      </section>

      <section aria-labelledby="pipeline-periodo">
        <SectionTitle hint={hasRange ? "Solicitudes creadas dentro del periodo, por su estado actual." : undefined}>
          <span id="pipeline-periodo">Pipeline del periodo</span>
        </SectionTitle>
        {totalRequests === 0 ? (
          <EmptyState>No hay solicitudes en este periodo.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Solicitudes por estado</caption>
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  <th scope="col" className="py-2.5 pr-4">Estado</th>
                  <th scope="col" className="py-2.5 pr-4">Solicitudes</th>
                  <th scope="col" className="py-2.5">Peso</th>
                </tr>
              </thead>
              <tbody>
                {PIPELINE_COLUMN_ORDER.map((status) => (
                  <tr key={status} className="border-b border-border/60">
                    <td className="py-2.5 pr-4 text-muted-foreground">{REQUEST_STATUS_LABEL[status]}</td>
                    <td className="py-2.5 pr-4 text-foreground">{metrics.pipeline[status]}</td>
                    <td className="py-2.5 text-muted-foreground">
                      {Math.round((metrics.pipeline[status] / totalRequests) * 100)} %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="adquisicion">
          <SectionTitle>
            <span id="adquisicion">Adquisición por origen</span>
          </SectionTitle>
          {metrics.attribution.length === 0 ? (
            <EmptyState>No hay solicitudes con datos de origen en este periodo.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <caption className="sr-only">Solicitudes por source, medium, campaign y content</caption>
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-[0.15em] text-muted-foreground">
                    <th scope="col" className="py-2.5 pr-3">Source</th>
                    <th scope="col" className="py-2.5 pr-3">Medium</th>
                    <th scope="col" className="py-2.5 pr-3">Campaign</th>
                    <th scope="col" className="py-2.5 pr-3">Content</th>
                    <th scope="col" className="py-2.5">Solicitudes</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.attribution.map((row, index) => (
                    <tr key={index} className="border-b border-border/60">
                      <td className="py-2.5 pr-3 text-muted-foreground">{row.source ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{row.medium ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{row.campaign ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{row.content ?? "—"}</td>
                      <td className="py-2.5 text-foreground">{row.requests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="captacion-biblioteca">
          <SectionTitle>
            <span id="captacion-biblioteca">Captación por biblioteca</span>
          </SectionTitle>
          {totalGate === 0 ? (
            <EmptyState>Nadie ha pasado por el gate en este periodo.</EmptyState>
          ) : (
            <ul className="space-y-2 text-sm">
              <li className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2">
                <span className="text-muted-foreground">{SECTION_LABEL.REAL_WEDDING}</span>
                <span className="text-foreground">{metrics.gateBySection.REAL_WEDDING}</span>
              </li>
              <li className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2">
                <span className="text-muted-foreground">{SECTION_LABEL.CATERING_EVENT}</span>
                <span className="text-foreground">{metrics.gateBySection.CATERING_EVENT}</span>
              </li>
            </ul>
          )}
        </section>

        <section aria-labelledby="fichas" className="lg:col-span-2">
          <SectionTitle>
            <span id="fichas">Fichas más consultadas</span>
          </SectionTitle>
          {metrics.topContent.length === 0 ? (
            <EmptyState>Ninguna ficha se ha consultado en este periodo.</EmptyState>
          ) : (
            <ul className="space-y-2 text-sm">
              {metrics.topContent.map((row) => (
                <li key={row.contentEntryId} className="flex flex-wrap items-baseline justify-between gap-4 border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">
                    {row.title}
                    <span className="ml-2 text-xs">{SECTION_LABEL[row.type]}</span>
                  </span>
                  <span className="flex gap-4">
                    <span className="text-foreground">{row.views} consultas</span>
                    <Link
                      href={`/admin/solicitudes?ficha=${row.contentEntryId}`}
                      className="text-xs text-muted-foreground underline transition-colors duration-300 hover:text-foreground"
                    >
                      Ver solicitudes
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
