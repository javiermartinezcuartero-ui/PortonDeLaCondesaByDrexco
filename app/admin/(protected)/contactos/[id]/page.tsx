import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { requireCrmAccess } from "../../guards"
import { roleHasPermission } from "@/lib/auth/session"
import { PrivacyPanel } from "./privacy-panel"
import { countActiveVipSessions, getLeadDetail } from "@/lib/domain/crm-leads"
import { listAssignableUsers } from "@/lib/domain/crm-requests"
import {
  ACTIVITY_LABEL,
  INTERACTION_LABEL,
  LIFECYCLE_LABEL,
  PRIORITY_LABEL,
  REQUEST_STATUS_LABEL,
  SECTION_LABEL,
  TASK_STATUS_LABEL,
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
import { AddNoteForm, CreateTaskForm, EditNoteForm, EditTaskForm, RecalculateScoreButton, TaskRowActions } from "../../crm-forms"
import { EmptyState, MetricCard, Pill, SectionTitle } from "../../crm-ui"
import { ContactLinks } from "../contact-links"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Ficha de contacto",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireCrmAccess()

  const { id } = await params
  const [lead, users] = await Promise.all([getLeadDetail(id), listAssignableUsers()])
  if (!lead) notFound()

  const name = leadName(lead)
  const marketing = lead.consents.find((consent) => consent.purpose === "MARKETING")
  const privacy = lead.consents.find((consent) => consent.purpose === "PRIVACY")

  // El panel de privacidad solo se pinta para ADMIN. Las acciones vuelven a
  // exigirlo en servidor: esconder el bloque no autoriza nada.
  const canManagePrivacy = roleHasPermission(viewer.role, "crm:export")
  const activeVipSessions = await countActiveVipSessions(lead.id)

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/admin/contactos"
          className="text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors duration-300 hover:text-foreground"
        >
          ← Contactos
        </Link>
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <h1 className="font-serif text-3xl font-light text-foreground">{name}</h1>
          {lead.lifecycle !== "ACTIVE" && <Pill tone="alert">{LIFECYCLE_LABEL[lead.lifecycle]}</Pill>}
          {lead.tags.map((entry) => (
            <Pill key={entry.tag.id}>{entry.tag.name}</Pill>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Puntuación" value={lead.score} hint={<RecalculateScoreButton leadId={lead.id} />} />
        <MetricCard label="Solicitudes" value={lead.requests.length} />
        <MetricCard label="Interacciones" value={lead.interactions.length} />
        <MetricCard label="Última actividad" value={formatDate(lead.lastActivityAt)} />
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          <section aria-labelledby="solicitudes">
            <SectionTitle>
              <span id="solicitudes">Solicitudes</span>
            </SectionTitle>
            {lead.requests.length === 0 ? (
              <EmptyState>Este contacto llegó por el gate y todavía no ha enviado ninguna solicitud.</EmptyState>
            ) : (
              <ul className="space-y-3">
                {lead.requests.map((request) => (
                  <li key={request.id} className="border border-border p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link
                        href={`/admin/solicitudes/${request.id}`}
                        className="text-foreground transition-colors duration-300 hover:text-accent"
                      >
                        {request.subject ?? eventTypeLabel(request.eventType)}
                      </Link>
                      <Pill tone={request.status === "LOST" ? "alert" : request.status === "WON" ? "accent" : "neutral"}>
                        {REQUEST_STATUS_LABEL[request.status]}
                      </Pill>
                    </div>
                    <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <Field label="Tipo" value={eventTypeLabel(request.eventType)} />
                      <Field label="Fecha del evento" value={formatDate(request.eventDate)} />
                      <Field label="Invitados" value={request.guestCount ?? "—"} />
                      <Field label="Espacio" value={spaceLabel(request.preferredSpace) ?? "—"} />
                      <Field label="Presupuesto" value={budgetLabel(request.budgetRange) ?? "—"} />
                      <Field label="Responsable" value={request.owner?.name ?? "Sin asignar"} />
                      <Field label="Prioridad" value={PRIORITY_LABEL[request.priority]} />
                      <Field label="Alta" value={formatDate(request.createdAt)} />
                    </dl>
                    {request.lostReason && (
                      <p className="mt-2 text-xs text-destructive">Motivo de la pérdida: {request.lostReason}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="contenido-consultado">
            <SectionTitle>
              <span id="contenido-consultado">Contenido consultado</span>
            </SectionTitle>
            {lead.interactions.length === 0 ? (
              <EmptyState>Sin interacciones con las bibliotecas.</EmptyState>
            ) : (
              <ul className="space-y-2 text-sm">
                {lead.interactions.map((interaction) => (
                  <li key={interaction.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">
                      <Pill>{INTERACTION_LABEL[interaction.type]}</Pill>{" "}
                      {interaction.contentEntry
                        ? (interaction.contentEntry.translations[0]?.title ?? interaction.contentEntry.slug)
                        : SECTION_LABEL[interaction.section]}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(interaction.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="timeline">
            <SectionTitle hint="Actividad registrada por el sistema y por el equipo.">
              <span id="timeline">Historial</span>
            </SectionTitle>
            {lead.activities.length === 0 ? (
              <EmptyState>Sin actividad registrada.</EmptyState>
            ) : (
              <ol className="space-y-2 text-sm">
                {lead.activities.map((activity) => {
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

          <section aria-labelledby="notas">
            <SectionTitle hint="Solo para el equipo. No se muestran a la persona.">
              <span id="notas">Notas internas</span>
            </SectionTitle>
            <div className="space-y-4">
              <AddNoteForm leadId={lead.id} />
              {lead.notes.length === 0 ? (
                <EmptyState>Todavía no hay notas.</EmptyState>
              ) : (
                <ul className="space-y-3">
                  {lead.notes.map((note) => (
                    <li key={note.id} className="border border-border p-3">
                      {/* Interpolado en JSX: React escapa el contenido, así que una
                          nota con etiquetas se lee como texto. No hay HTML aquí. */}
                      <p className="whitespace-pre-wrap text-sm text-foreground">{note.body}</p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          {note.author?.name ?? "Sistema"} · {formatDateTime(note.createdAt)}
                          {note.updatedAt.getTime() !== note.createdAt.getTime() &&
                            ` · editada ${formatDateTime(note.updatedAt)}`}
                        </span>
                        <EditNoteForm noteId={note.id} initialBody={note.body} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-10">
          <section aria-labelledby="datos">
            <SectionTitle>
              <span id="datos">Datos de contacto</span>
            </SectionTitle>
            <dl className="space-y-2 text-sm">
              <Field label="Email" value={lead.email} />
              <Field label="Teléfono" value={lead.phone ?? "—"} />
              <Field label="Origen inicial" value={lead.firstSource ?? "—"} />
              <Field label="Origen reciente" value={lead.lastSource ?? "—"} />
              <Field label="Primera visita" value={formatDate(lead.firstSeenAt)} />
            </dl>
            <div className="mt-3">
              <ContactLinks email={lead.email} phone={lead.phone} name={name} />
            </div>
          </section>

          <section aria-labelledby="consentimientos">
            <SectionTitle>
              <span id="consentimientos">Consentimientos</span>
            </SectionTitle>
            <dl className="space-y-2 text-sm">
              <Field
                label="Privacidad"
                value={privacy ? `Aceptada (${privacy.policyVersion}) el ${formatDate(privacy.createdAt)}` : "Sin registro"}
              />
              <Field
                label="Marketing"
                value={
                  marketing
                    ? `${marketing.granted ? "Concedido" : "Revocado"} (${marketing.policyVersion}) el ${formatDate(marketing.createdAt)}`
                    : "No concedido"
                }
              />
            </dl>
            {lead.consents.length > 2 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {lead.consents.length} eventos de consentimiento registrados en total. El historial no se sobrescribe.
              </p>
            )}
          </section>

          <section aria-labelledby="tareas-contacto">
            <SectionTitle>
              <span id="tareas-contacto">Tareas</span>
            </SectionTitle>
            <div className="space-y-4">
              <CreateTaskForm
                leadId={lead.id}
                users={users}
                requests={lead.requests.map((request) => ({
                  id: request.id,
                  label: request.subject ?? eventTypeLabel(request.eventType),
                }))}
              />
              {lead.followUps.length === 0 ? (
                <EmptyState>Sin tareas.</EmptyState>
              ) : (
                <ul className="space-y-3">
                  {lead.followUps.map((task) => (
                    <li key={task.id} className="border border-border p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm text-foreground">{task.title}</span>
                        <Pill tone={task.status === "PENDING" && task.dueAt < new Date() ? "alert" : "neutral"}>
                          {TASK_STATUS_LABEL[task.status]}
                        </Pill>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Vence {formatDate(task.dueAt)} · {PRIORITY_LABEL[task.priority]} ·{" "}
                        {task.assignee?.name ?? "Sin asignar"}
                      </span>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <TaskRowActions taskId={task.id} status={task.status} />
                        {task.status === "PENDING" && (
                          <EditTaskForm
                            taskId={task.id}
                            users={users}
                            initial={{
                              title: task.title,
                              dueAt: toDateInputValue(task.dueAt),
                              assigneeId: task.assigneeId ?? "",
                              priority: task.priority,
                            }}
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {canManagePrivacy && (
            <section aria-labelledby="privacidad">
              <SectionTitle hint="Solo administración. Cada operación queda auditada.">
                <span id="privacidad">Privacidad</span>
              </SectionTitle>
              <PrivacyPanel
                leadId={lead.id}
                isAnonymized={lead.lifecycle === "ANONYMIZED"}
                activeVipSessions={activeVipSessions}
                hasMarketingConsent={marketing?.granted === true}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  )
}
