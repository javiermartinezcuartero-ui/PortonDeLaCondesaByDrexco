import type { Metadata } from "next"
import Link from "next/link"
import { getSessionUser, roleHasPermission } from "@/lib/auth/session"
import { getDashboardMetrics } from "@/lib/domain/metrics"
import {
  ACTIVITY_LABEL,
  PIPELINE_COLUMN_ORDER,
  PIPELINE_TONE,
  REQUEST_STATUS_LABEL,
  formatDateTime,
  statusTransitionLabel,
} from "@/lib/crm/labels"
import { BarChart, ChartCard, DonutChart, FunnelChart, type Segmento } from "./crm-charts"
import { AverageValue, MetricCard, Pill, RatioHint, RatioValue, SectionTitle } from "./crm-ui"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Estatus Plataforma",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN: "Acceso completo: seguimiento comercial, contenidos, exportación y puntuación.",
  SALES: "Seguimiento comercial: interesados, solicitudes, fases y acciones.",
  CONTENT: "Contenido de bodas reales y catering: edición, media y publicación.",
}

export default async function AdminHomePage() {
  const user = await getSessionUser()
  // El layout ya redirige a /admin/login si no hay sesión; esto no debería
  // alcanzarse nunca, pero evita un `user.name` sobre `null` si lo hiciera.
  if (!user) return null

  // El estado de la plataforma son métricas comerciales. Quien no tiene ese permiso
  // (CONTENT) no ve una pantalla vacía ni un error: ve su propio punto de partida.
  if (!roleHasPermission(user.role, "crm:access")) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="font-serif text-3xl font-light text-foreground">Bienvenido, {user.name}</h1>
        <p className="text-muted-foreground">{ROLE_DESCRIPTIONS[user.role]}</p>
        <Link
          href="/admin/contenidos"
          className="inline-block text-sm text-muted-foreground underline transition-colors duration-300 hover:text-foreground"
        >
          Ir a Contenidos Biblioteca
        </Link>
      </div>
    )
  }

  const metrics = await getDashboardMetrics(new Date())
  const { pipeline, funnel, tasks } = metrics

  // Un anillo por fase. El orden es el del recorrido comercial y el color, el mismo
  // que el de las pastillas del tablero: quien mire las dos pantallas reconoce la fase
  // por el color sin volver a leer la leyenda.
  const fases: Segmento[] = PIPELINE_COLUMN_ORDER.map((status) => ({
    label: REQUEST_STATUS_LABEL[status],
    value: pipeline[status],
    tono: PIPELINE_TONE[status],
    href: `/admin/solicitudes?estado=${status}`,
  }))

  // Las tres cifras de acciones **no** son un anillo, y esto es una decisión, no un
  // descuido: «pendientes en total» incluye a las vencidas y a las de esta semana, así
  // que un anillo con las tres sumaría lo mismo dos y tres veces y mentiría sobre el
  // total. Aquí se convierten en una partición de verdad restando los tramos.
  const masAdelante = Math.max(0, tasks.pending - tasks.overdue - tasks.upcoming)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-light text-foreground">Estatus Plataforma</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cómo va la captación ahora mismo: quién ha entrado, qué solicitudes hay abiertas y qué queda por hacer.
          {" "}
          {ROLE_DESCRIPTIONS[user.role]}
        </p>
      </div>

      <section aria-labelledby="captacion">
        <SectionTitle>
          <span id="captacion">Captación</span>
        </SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Interesados por la biblioteca"
            value={metrics.leadsFromGate}
            hint="Personas que dejaron su email para ver las bibliotecas"
            href="/admin/contactos?interaccion=GATE_GRANTED"
          />
          <MetricCard
            label="Solicitudes sin trabajar"
            value={metrics.newRequests}
            hint="Siguen en la fase Contacto"
            href="/admin/solicitudes?estado=CONTACT"
          />
          <MetricCard
            label="Las más antiguas sin tocar"
            value={metrics.pendingFirstContact}
            hint="Mismo recuento, ordenadas por antigüedad"
            href="/admin/solicitudes?estado=CONTACT&orden=antiguas"
          />
          <MetricCard
            label="Tiempo hasta el primer contacto"
            value={<AverageValue average={metrics.hoursToFirstContact} unit="h" />}
            hint={
              metrics.hoursToFirstContact.sampleSize === 0
                ? "Ninguna solicitud ha pasado de Contacto todavía"
                : `Media de ${metrics.hoursToFirstContact.sampleSize} solicitudes ya atendidas`
            }
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Solicitudes por fase"
          hint="Reparto de las solicitudes abiertas. Pulsa una fase para ver su listado."
        >
          <DonutChart segments={fases} totalLabel="solicitudes" emptyMessage="Todavía no hay solicitudes." />
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border/50 pt-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Cerradas a favor</dt>
              <dd className="font-serif text-2xl text-foreground">{pipeline.CLIENT}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Conversión sobre cerradas</dt>
              <dd className="font-serif text-2xl text-foreground">
                <RatioValue ratio={metrics.conversion} />
              </dd>
              <dd className="mt-0.5 text-xs text-muted-foreground">
                <RatioHint ratio={metrics.conversion} noun="solicitudes cerradas" />
              </dd>
            </div>
          </dl>
        </ChartCard>

        <ChartCard title="Acciones pendientes" hint="Reparto por plazo. Las vencidas son las que piden atención hoy.">
          <DonutChart
            segments={[
              { label: "Vencidas", value: tasks.overdue, tono: "rojo", href: "/admin/tareas?vista=vencidas" },
              { label: "Próximos 7 días", value: tasks.upcoming, tono: "ambar", href: "/admin/tareas?vista=semana" },
              { label: "Más adelante", value: masAdelante, tono: "gris", href: "/admin/tareas" },
            ]}
            totalLabel="acciones pendientes"
            emptyMessage="No hay ninguna acción pendiente."
          />
        </ChartCard>

        <ChartCard
          title="De la biblioteca a la solicitud"
          hint="Cada escalón cuenta solo a quien viene del anterior."
        >
          <FunnelChart
            steps={[
              { label: "Accedieron a la biblioteca", value: funnel.gateGranted },
              { label: "Consultaron alguna ficha", value: funnel.viewedContent },
              { label: "Enviaron una solicitud", value: funnel.submittedRequest },
            ]}
            emptyMessage="Nadie ha accedido a las bibliotecas todavía."
          />
        </ChartCard>

        <ChartCard title="Origen y campaña" hint="Solicitudes según de dónde llegó la visita.">
          <BarChart
            rows={metrics.attribution.map((row) => ({
              label: [row.source ?? "Directo o sin UTM", row.medium, row.campaign].filter(Boolean).join(" · "),
              value: row.requests,
            }))}
            emptyMessage="Todavía no hay solicitudes con datos de origen."
          />
        </ChartCard>

        <ChartCard
          title="Contenido más consultado"
          hint="Fichas de bodas reales y catering, por número de consultas."
          className="lg:col-span-2"
        >
          <BarChart
            rows={metrics.topContent.map((row) => ({
              label: row.title,
              value: row.views,
              href: `/admin/solicitudes?ficha=${row.contentEntryId}`,
            }))}
            emptyMessage="Ninguna ficha se ha consultado todavía."
            unit="consultas"
          />
        </ChartCard>
      </div>

      <section aria-labelledby="movimientos">
        <SectionTitle hint="Lo último que ha pasado, en orden inverso.">
          <span id="movimientos">Últimos movimientos</span>
        </SectionTitle>
        {metrics.movements.length === 0 ? (
          <p className="border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            Sin actividad registrada todavía.
          </p>
        ) : (
          <ul className="space-y-3 border border-border p-5 text-sm">
            {metrics.movements.map((movement) => {
              const transition = statusTransitionLabel(movement.metadata)

              return (
                <li key={movement.id} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Pill>{ACTIVITY_LABEL[movement.type as keyof typeof ACTIVITY_LABEL] ?? movement.type}</Pill>
                    {/* `overflow-wrap: anywhere` porque cuando el contacto no tiene nombre
                        aquí cae su correo, y un correo anonimizado del CRM
                        —`anonimizado+cmst9jnzj00147k08hjvrtqk2@…`— es una cadena de 45
                        caracteres sin un solo punto de corte natural. A 390 px eso
                        desbordaba la ventana entera y aparecía una barra horizontal en la
                        página, no en la tarjeta. `break-words` no basta: no rompe dentro de
                        una palabra, y esto es técnicamente una sola palabra. */}
                    <Link
                      href={`/admin/contactos/${movement.leadId}`}
                      className="min-w-0 text-foreground transition-colors duration-300 [overflow-wrap:anywhere] hover:text-accent"
                    >
                      {movement.leadName ?? movement.leadEmail}
                    </Link>
                    {transition && <span className="text-muted-foreground">{transition}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDateTime(movement.createdAt)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
