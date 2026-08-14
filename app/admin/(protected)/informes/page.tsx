import type { Metadata } from "next"
import Link from "next/link"
import { requireCrmAccess } from "../guards"
import { getReportMetrics, type DateRange } from "@/lib/domain/metrics"
import { PIPELINE_COLUMN_ORDER, PIPELINE_TONE, REQUEST_STATUS_LABEL, SECTION_LABEL } from "@/lib/crm/labels"
import { BarChart, ChartCard, DonutChart, type Segmento } from "../crm-charts"
import { AverageValue, MetricCard, RatioHint, RatioValue } from "../crm-ui"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Informes captación",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

/**
 * Primer año con datos. La finca no tenía plataforma antes, así que un selector que
 * empezara en 2020 ofrecería cuatro años garantizados de pantalla vacía.
 */
const PRIMER_ANIO = 2025

/**
 * Años que ofrece el selector: de 2025 al año en curso.
 *
 * Se calcula en cada petición y no se escribe a mano porque una lista fija se queda corta
 * el 1 de enero, y el síntoma sería el peor posible: los informes del año nuevo no
 * existirían y nadie sabría por qué.
 */
function aniosDisponibles(hoy: Date): number[] {
  const actual = hoy.getUTCFullYear()
  const anios: number[] = []
  for (let anio = actual; anio >= PRIMER_ANIO; anio -= 1) anios.push(anio)
  return anios
}

/**
 * Lee el año del parámetro por lista blanca: lo que no esté en el selector se ignora en
 * silencio y se muestra el histórico completo, igual que el resto de filtros del panel.
 */
function parseAnio(value: string | undefined, disponibles: number[]): number | null {
  if (!value) return null
  const anio = Number.parseInt(value, 10)
  return disponibles.includes(anio) ? anio : null
}

/** El año natural completo, en UTC, con el último milisegundo del 31 de diciembre dentro. */
function rangoDelAnio(anio: number): DateRange {
  return {
    from: new Date(Date.UTC(anio, 0, 1, 0, 0, 0, 0)),
    to: new Date(Date.UTC(anio, 11, 31, 23, 59, 59, 999)),
  }
}

type SearchParams = { anio?: string }

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireCrmAccess()
  const params = await searchParams

  const anios = aniosDisponibles(new Date())
  const anio = parseAnio(params.anio, anios)
  const range = anio === null ? {} : rangoDelAnio(anio)
  const metrics = await getReportMetrics(range)

  const totalRequests = PIPELINE_COLUMN_ORDER.reduce((sum, status) => sum + metrics.pipeline[status], 0)

  const fases: Segmento[] = PIPELINE_COLUMN_ORDER.map((status) => ({
    label: REQUEST_STATUS_LABEL[status],
    value: metrics.pipeline[status],
    tono: PIPELINE_TONE[status],
  }))

  return (
    <div className="space-y-6">
      {/* Selector de año.
          Sustituye a los dos campos de fecha con su botón «Aplicar», y el cambio no es
          solo de aspecto: aquellos permitían pedir un rango cualquiera —del 3 de marzo al
          17 de julio— y en la práctica nadie compara eso; se compara un año con otro. Con
          pastillas, el periodo se cambia en un clic y sin formulario que enviar.

          Va arriba y a la izquierda, antes del título, porque es lo que decide qué dicen
          todas las cifras de la pantalla: leer primero un número y después descubrir de qué
          periodo era es el orden equivocado. */}
      <nav aria-label="Periodo del informe" className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-medium tracking-[0.06em] uppercase text-muted-foreground">
          Periodo
        </span>
        {anios.map((valor) => (
          <PastillaDeAnio key={valor} href={`/admin/informes?anio=${valor}`} activa={anio === valor}>
            {valor}
          </PastillaDeAnio>
        ))}
        <PastillaDeAnio href="/admin/informes" activa={anio === null}>
          Todo
        </PastillaDeAnio>
      </nav>

      <div>
        <h1 className="font-serif text-3xl font-light text-foreground">Informes captación</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {anio === null
            ? "Todo el histórico. Elige un año arriba para ver solo ese periodo."
            : `Datos de ${anio}. Las solicitudes se cuentan por su fecha de alta.`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="De interesado a solicitud"
          value={<RatioValue ratio={metrics.identifiedToRequest} />}
          hint={<RatioHint ratio={metrics.identifiedToRequest} noun="personas identificadas" />}
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
              ? "Ninguna solicitud del periodo ha pasado de Contacto"
              : `Media de ${metrics.hoursToFirstContact.sampleSize} solicitudes`
          }
        />
        <MetricCard
          label="Puntuación media"
          value={<AverageValue average={metrics.averageScore} unit="pts" />}
          hint={
            metrics.averageScore.sampleSize === 0
              ? "Todavía no hay personas registradas"
              : `Sobre ${metrics.averageScore.sampleSize} personas (histórico completo)`
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Solicitudes por fase"
          hint={
            anio === null
              ? "Todas las solicitudes no archivadas, por la fase en la que están hoy."
              : `Solicitudes dadas de alta en ${anio}, por la fase en la que están hoy.`
          }
        >
          <DonutChart
            segments={fases}
            totalLabel="solicitudes"
            emptyMessage="No hay solicitudes en este periodo."
          />
        </ChartCard>

        <ChartCard title="Captación por biblioteca" hint="Por dónde entró cada persona a dejar su email.">
          <DonutChart
            segments={[
              { label: SECTION_LABEL.REAL_WEDDING, value: metrics.gateBySection.REAL_WEDDING, tono: "violeta" },
              { label: SECTION_LABEL.CATERING_EVENT, value: metrics.gateBySection.CATERING_EVENT, tono: "cian" },
            ]}
            totalLabel="accesos concedidos"
            emptyMessage="Nadie ha accedido a las bibliotecas en este periodo."
          />
        </ChartCard>

        <ChartCard
          title="Adquisición por origen"
          hint="Solicitudes por source, medium y campaign de la visita que las originó."
        >
          <BarChart
            rows={metrics.attribution.map((row) => ({
              label: [row.source ?? "Directo o sin UTM", row.medium, row.campaign, row.content]
                .filter(Boolean)
                .join(" · "),
              value: row.requests,
            }))}
            emptyMessage="No hay solicitudes con datos de origen en este periodo."
          />
        </ChartCard>

        <ChartCard title="Fichas más consultadas" hint="Bodas reales y catering, por número de consultas.">
          <BarChart
            rows={metrics.topContent.map((row) => ({
              label: `${row.title} · ${SECTION_LABEL[row.type]}`,
              value: row.views,
              href: `/admin/solicitudes?ficha=${row.contentEntryId}`,
            }))}
            emptyMessage="Ninguna ficha se ha consultado en este periodo."
            unit="consultas"
          />
        </ChartCard>
      </div>

      {/* El total en texto cierra la pantalla. Un anillo dice bien el reparto y mal el
          tamaño: sin esta línea, dos solicitudes y doscientas dibujan la misma figura. */}
      <p className="text-xs text-muted-foreground">
        {totalRequests === 0
          ? "Sin solicitudes en el periodo seleccionado."
          : `${totalRequests} solicitudes en el periodo seleccionado.`}
      </p>
    </div>
  )
}

/**
 * Pastilla de periodo. El estado activo no se marca solo con color: lleva
 * `aria-current="page"`, que es lo que permite saber cuál está seleccionada sin verlo.
 */
function PastillaDeAnio({
  href,
  activa,
  children,
}: {
  href: string
  activa: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={activa ? "page" : undefined}
      className={
        activa
          ? "rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
          : "admin-pill rounded-full px-2.5 py-1 text-xs font-medium"
      }
    >
      {children}
    </Link>
  )
}
