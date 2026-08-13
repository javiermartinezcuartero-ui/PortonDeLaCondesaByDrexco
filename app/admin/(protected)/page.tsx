import type { Metadata } from "next"
import Link from "next/link"
import { getSessionUser, roleHasPermission } from "@/lib/auth/session"
import { getDashboardMetrics } from "@/lib/domain/metrics"
import { ACTIVITY_LABEL, formatDateTime, statusTransitionLabel } from "@/lib/crm/labels"
import {
  AverageValue,
  EmptyState,
  MetricCard,
  Pill,
  RatioHint,
  RatioValue,
  SectionTitle,
} from "./crm-ui"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Resumen",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN: "Acceso completo: CRM, contenidos, exportación y configuración.",
  SALES: "CRM comercial: contactos, solicitudes, pipeline y tareas.",
  CONTENT: "Contenido de bodas reales y catering: edición, media y publicación.",
}

export default async function AdminHomePage() {
  const user = await getSessionUser()
  // El layout ya redirige a /admin/login si no hay sesión; esto no debería
  // alcanzarse nunca, pero evita un `user.name` sobre `null` si lo hiciera.
  if (!user) return null

  // El Resumen son métricas de CRM. Quien no tiene ese permiso (CONTENT) no ve
  // una pantalla vacía ni un error: ve su propio punto de partida.
  if (!roleHasPermission(user.role, "crm:access")) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="font-serif text-3xl font-light text-foreground">Bienvenido, {user.name}</h1>
        <p className="text-muted-foreground">{ROLE_DESCRIPTIONS[user.role]}</p>
        <Link
          href="/admin/contenidos"
          className="inline-block text-sm text-muted-foreground underline transition-colors duration-300 hover:text-foreground"
        >
          Ir a Contenidos
        </Link>
      </div>
    )
  }

  const metrics = await getDashboardMetrics(new Date())
  const { pipeline, funnel } = metrics

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif text-3xl font-light text-foreground">Resumen</h1>
        <p className="mt-1 text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[user.role]}</p>
      </div>

      <section aria-labelledby="captacion">
        <SectionTitle>
          <span id="captacion">Captación</span>
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Contactos por el gate"
            value={metrics.leadsFromGate}
            hint="Personas que dejaron su email para ver las bibliotecas"
            href="/admin/contactos?interaccion=GATE_GRANTED"
          />
          <MetricCard
            label="Solicitudes nuevas"
            value={metrics.newRequests}
            hint="Sin trabajar todavía"
            href="/admin/solicitudes?estado=NEW"
          />
          <MetricCard
            label="Sin primer contacto"
            value={metrics.pendingFirstContact}
            hint="Siguen en estado Nueva"
            href="/admin/solicitudes?estado=NEW&orden=antiguas"
          />
          <MetricCard
            label="Tiempo al primer contacto"
            value={<AverageValue average={metrics.hoursToFirstContact} unit="h" />}
            hint={
              metrics.hoursToFirstContact.sampleSize === 0
                ? "Ninguna solicitud ha pasado a Contactada todavía"
                : `Media de ${metrics.hoursToFirstContact.sampleSize} solicitudes contactadas`
            }
          />
        </div>
      </section>

      <section aria-labelledby="pipeline-resumen">
        <SectionTitle>
          <span id="pipeline-resumen">Pipeline</span>
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Visitas agendadas"
            value={pipeline.VISIT_SCHEDULED}
            href="/admin/solicitudes?estado=VISIT_SCHEDULED"
          />
          <MetricCard
            label="Propuestas enviadas"
            value={pipeline.PROPOSAL_SENT}
            href="/admin/solicitudes?estado=PROPOSAL_SENT"
          />
          <MetricCard
            label="Ganadas / perdidas"
            value={`${pipeline.WON} / ${pipeline.LOST}`}
            hint={`${pipeline.NEGOTIATION} en negociación · ${pipeline.NURTURING} en seguimiento`}
            href="/admin/pipeline"
          />
          <MetricCard
            label="Conversión sobre cerradas"
            value={<RatioValue ratio={metrics.conversion} />}
            hint={<RatioHint ratio={metrics.conversion} noun="solicitudes cerradas" />}
          />
        </div>
      </section>

      <section aria-labelledby="tareas-resumen">
        <SectionTitle>
          <span id="tareas-resumen">Tareas</span>
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="Vencidas" value={metrics.tasks.overdue} href="/admin/tareas?vista=vencidas" />
          <MetricCard
            label="Próximos 7 días"
            value={metrics.tasks.upcoming}
            href="/admin/tareas?vista=semana"
          />
          <MetricCard label="Pendientes en total" value={metrics.tasks.pending} href="/admin/tareas" />
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="embudo">
          <SectionTitle hint="Cada escalón cuenta solo a quien viene del anterior.">
            <span id="embudo">Del gate a la solicitud</span>
          </SectionTitle>
          {funnel.gateGranted === 0 ? (
            <EmptyState>Nadie ha pasado por el gate todavía.</EmptyState>
          ) : (
            <ol className="space-y-2 text-sm">
              <FunnelStep label="Accedieron por el gate" value={funnel.gateGranted} total={funnel.gateGranted} />
              <FunnelStep label="Consultaron alguna ficha" value={funnel.viewedContent} total={funnel.gateGranted} />
              <FunnelStep label="Enviaron una solicitud" value={funnel.submittedRequest} total={funnel.gateGranted} />
            </ol>
          )}
        </section>

        <section aria-labelledby="origen">
          <SectionTitle>
            <span id="origen">Origen y campaña</span>
          </SectionTitle>
          {metrics.attribution.length === 0 ? (
            <EmptyState>Todavía no hay solicitudes con datos de origen.</EmptyState>
          ) : (
            <ul className="space-y-2 text-sm">
              {metrics.attribution.map((row, index) => (
                <li key={index} className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">
                    {row.source ?? "Directo o sin UTM"}
                    {row.medium ? ` · ${row.medium}` : ""}
                    {row.campaign ? ` · ${row.campaign}` : ""}
                  </span>
                  <span className="text-foreground">{row.requests}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="contenido">
          <SectionTitle>
            <span id="contenido">Contenido más consultado</span>
          </SectionTitle>
          {metrics.topContent.length === 0 ? (
            <EmptyState>Ninguna ficha se ha consultado todavía.</EmptyState>
          ) : (
            <ul className="space-y-2 text-sm">
              {metrics.topContent.map((row) => (
                <li key={row.contentEntryId} className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2">
                  <Link
                    href={`/admin/solicitudes?ficha=${row.contentEntryId}`}
                    className="text-muted-foreground transition-colors duration-300 hover:text-foreground"
                  >
                    {row.title}
                  </Link>
                  <span className="text-foreground">{row.views}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="movimientos">
          <SectionTitle>
            <span id="movimientos">Últimos movimientos</span>
          </SectionTitle>
          {metrics.movements.length === 0 ? (
            <EmptyState>Sin actividad registrada todavía.</EmptyState>
          ) : (
            <ul className="space-y-3 text-sm">
              {metrics.movements.map((movement) => {
                const transition = statusTransitionLabel(movement.metadata)

                return (
                  <li key={movement.id} className="border-b border-border/60 pb-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <Pill>{ACTIVITY_LABEL[movement.type as keyof typeof ACTIVITY_LABEL] ?? movement.type}</Pill>
                      <Link
                        href={`/admin/contactos/${movement.leadId}`}
                        className="text-foreground transition-colors duration-300 hover:text-accent"
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
    </div>
  )
}

function FunnelStep({ label, value, total }: { label: string; value: number; total: number }) {
  const width = total === 0 ? 0 : Math.round((value / total) * 100)
  return (
    <li>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground">
          {value}
          {total > 0 && value !== total && <span className="ml-2 text-xs text-muted-foreground">({width} %)</span>}
        </span>
      </div>
      <div className="mt-1 h-1 bg-secondary">
        <div className="h-1 bg-primary" style={{ width: `${width}%` }} />
      </div>
    </li>
  )
}
