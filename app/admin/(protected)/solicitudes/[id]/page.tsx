import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { requireCrmAccess } from "../../guards"
import {
  findPossibleDuplicates,
  getRequestDetail,
  getRequestSourceContent,
  listAssignableUsers,
} from "@/lib/domain/crm-requests"
import { allowedTransitionsFrom } from "@/lib/domain/lead-requests"
import { budgetRangeLabels, spacesContent } from "@/data/site-content"
import { BUDGET_RANGES, NO_SPACE_PREFERENCE } from "@/lib/validation/lead-request"
import {
  ACTIVITY_LABEL,
  PRIORITY_LABEL,
  REQUEST_STATUS_LABEL,
  activityActionLabel,
  budgetLabel,
  eventTypeLabel,
  formatDate,
  formatDateTime,
  leadName,
  spaceLabel,
  statusTransitionLabel,
  toDateInputValue,
} from "@/lib/crm/labels"
import { ArchiveRequestButton, ChangeStatusForm, RequestDetailsForm } from "../../crm-forms"
import { ContactLinks } from "../../contactos/contact-links"
import { EmptyState, Pill, SectionTitle } from "../../crm-ui"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Solicitud",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

const SPACE_OPTIONS = [
  ...spacesContent.map((space) => ({ value: space.slug, label: space.name })),
  { value: NO_SPACE_PREFERENCE, label: "Sin preferencia" },
]

const BUDGET_OPTIONS = BUDGET_RANGES.map((code) => ({ value: code, label: budgetRangeLabels[code] }))

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCrmAccess()

  const { id } = await params
  const request = await getRequestDetail(id)
  if (!request) notFound()

  const [users, sourceContent, duplicates] = await Promise.all([
    listAssignableUsers(),
    getRequestSourceContent(request.sourceContentId),
    findPossibleDuplicates(request.leadId),
  ])

  const name = leadName(request.lead)

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/admin/solicitudes"
          className="text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors duration-300 hover:text-foreground"
        >
          ← Solicitudes
        </Link>
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <h1 className="font-serif text-3xl font-light text-foreground">
            {request.subject ?? eventTypeLabel(request.eventType)}
          </h1>
          <Pill tone={request.status === "LOST" ? "alert" : request.status === "WON" ? "accent" : "neutral"}>
            {REQUEST_STATUS_LABEL[request.status]}
          </Pill>
          {request.archivedAt && <Pill tone="alert">Archivada</Pill>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Alta {formatDateTime(request.createdAt)} ·{" "}
          <Link href={`/admin/contactos/${request.leadId}`} className="underline hover:text-foreground">
            {name}
          </Link>
        </p>
      </div>

      {duplicates.length > 0 && (
        <div role="status" className="border border-border bg-secondary/40 p-4">
          <p className="text-sm text-foreground">
            Hay {duplicates.length} {duplicates.length === 1 ? "contacto" : "contactos"} que podrían ser la misma persona
            (mismo teléfono o mismo nombre y apellidos).
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {duplicates.map((duplicate) => (
              <li key={duplicate.id}>
                <Link href={`/admin/contactos/${duplicate.id}`} className="text-muted-foreground underline hover:text-foreground">
                  {leadName(duplicate)} · {duplicate.email}
                </Link>
                <span className="text-xs text-muted-foreground"> ({duplicate._count.requests} solicitudes)</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Es solo un aviso: no se fusiona nada automáticamente. Decidir qué consentimiento y qué historial sobreviven a
            una fusión no es algo que deba resolver una coincidencia de datos, y las solicitudes no se unen nunca.
          </p>
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          <section aria-labelledby="lo-que-pidio">
            <SectionTitle hint="Tal como lo escribió la persona. El CRM no reescribe su mensaje.">
              <span id="lo-que-pidio">La solicitud</span>
            </SectionTitle>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Field label="Tipo de evento" value={eventTypeLabel(request.eventType)} />
              <Field label="Fecha prevista" value={formatDate(request.eventDate)} />
              <Field label="Invitados" value={request.guestCount ?? "—"} />
              <Field label="Espacio de interés" value={spaceLabel(request.preferredSpace) ?? "—"} />
              <Field label="Presupuesto" value={budgetLabel(request.budgetRange) ?? "—"} />
              {request.company && <Field label="Empresa" value={request.company} />}
              {request.jobTitle && <Field label="Cargo" value={request.jobTitle} />}
            </dl>
            {request.audiovisualNeeds && (
              <div className="mt-4">
                <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Necesidades audiovisuales
                </span>
                <p className="whitespace-pre-wrap text-sm text-foreground">{request.audiovisualNeeds}</p>
              </div>
            )}
            {request.message && (
              <div className="mt-4 border-l-2 border-border pl-4">
                <p className="whitespace-pre-wrap text-sm text-foreground">{request.message}</p>
              </div>
            )}
          </section>

          <section aria-labelledby="pipeline-solicitud">
            <SectionTitle hint="Solo se ofrecen las transiciones válidas desde el estado actual; el servidor las vuelve a comprobar.">
              <span id="pipeline-solicitud">Estado</span>
            </SectionTitle>
            <ChangeStatusForm
              requestId={request.id}
              currentStatus={request.status}
              allowed={allowedTransitionsFrom(request.status)}
            />
            {request.lostReason && (
              <p className="mt-3 text-sm text-destructive">Motivo de la pérdida: {request.lostReason}</p>
            )}
          </section>

          <section aria-labelledby="gestion">
            <SectionTitle>
              <span id="gestion">Gestión</span>
            </SectionTitle>
            <RequestDetailsForm
              requestId={request.id}
              users={users}
              spaces={SPACE_OPTIONS}
              budgets={BUDGET_OPTIONS}
              initial={{
                priority: request.priority,
                ownerId: request.ownerId ?? "",
                nextActionAt: toDateInputValue(request.nextActionAt),
                preferredSpace: request.preferredSpace ?? "",
                budgetRange: request.budgetRange ?? "",
              }}
            />
          </section>

          <section aria-labelledby="historial-solicitud">
            <SectionTitle>
              <span id="historial-solicitud">Historial de esta solicitud</span>
            </SectionTitle>
            {request.activities.length === 0 ? (
              <EmptyState>Sin movimientos todavía.</EmptyState>
            ) : (
              <ol className="space-y-2 text-sm">
                {request.activities.map((activity) => {
                  const transition = statusTransitionLabel(activity.metadata)
                  const action = activityActionLabel(activity.metadata)
                  return (
                    <li key={activity.id} className="border-b border-border/60 pb-2">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <Pill>{ACTIVITY_LABEL[activity.type]}</Pill>
                        {transition && <span className="text-muted-foreground">{transition}</span>}
                        {action && <span className="text-muted-foreground">{action}</span>}
                        {activity.actor && <span className="text-xs text-muted-foreground">· {activity.actor.name}</span>}
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDateTime(activity.createdAt)}</span>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        </div>

        <div className="space-y-10">
          <section aria-labelledby="contacto-solicitud">
            <SectionTitle>
              <span id="contacto-solicitud">Contacto</span>
            </SectionTitle>
            <dl className="space-y-2 text-sm">
              <Field label="Nombre" value={name} />
              <Field label="Email" value={request.lead.email} />
              <Field label="Teléfono" value={request.lead.phone ?? "—"} />
              <Field label="Puntuación" value={request.lead.score} />
              <Field label="Solicitudes en total" value={request.lead._count.requests} />
            </dl>
            <div className="mt-3">
              <ContactLinks
                email={request.lead.email}
                phone={request.lead.phone}
                name={name}
                subject={`Tu solicitud · ${request.subject ?? eventTypeLabel(request.eventType)}`}
              />
            </div>
          </section>

          <section aria-labelledby="atribucion">
            <SectionTitle>
              <span id="atribucion">Origen</span>
            </SectionTitle>
            <dl className="space-y-2 text-sm">
              <Field label="Página" value={request.sourcePage ?? "—"} />
              <Field label="Formulario" value={request.sourceForm ?? "—"} />
              <Field label="Referente" value={request.referrer ?? "—"} />
              <Field label="utm_source" value={request.utmSource ?? "—"} />
              <Field label="utm_medium" value={request.utmMedium ?? "—"} />
              <Field label="utm_campaign" value={request.utmCampaign ?? "—"} />
              <Field label="utm_content" value={request.utmContent ?? "—"} />
              <Field label="utm_term" value={request.utmTerm ?? "—"} />
            </dl>
            {sourceContent && (
              <p className="mt-3 text-sm">
                Vino de la ficha{" "}
                <Link href={`/admin/contenidos/${sourceContent.id}`} className="underline hover:text-foreground">
                  {sourceContent.translations[0]?.title ?? sourceContent.slug}
                </Link>
              </p>
            )}
            {request.sourceContentId && !sourceContent && (
              <p className="mt-3 text-xs text-muted-foreground">
                La ficha de origen ya no existe. Se conserva su identificador en la solicitud.
              </p>
            )}
          </section>

          <section aria-labelledby="acciones">
            <SectionTitle>
              <span id="acciones">Acciones</span>
            </SectionTitle>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Prioridad actual: {PRIORITY_LABEL[request.priority]}
              </p>
              {!request.archivedAt && <ArchiveRequestButton requestId={request.id} />}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</dt>
      <dd className="break-words text-foreground">{value}</dd>
    </div>
  )
}
