"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { FollowUpStatus, LeadRequestStatus, Priority } from "@prisma/client"
import {
  addLeadNoteAction,
  archiveRequestAction,
  cancelTaskAction,
  changeRequestStatusAction,
  completeTaskAction,
  createTaskAction,
  recalculateLeadScoreAction,
  updateLeadNoteAction,
  updateRequestAction,
  updateScoringRuleAction,
  updateTaskAction,
  type CrmActionResult,
} from "./crm-actions"
import { PRIORITY_LABEL, REQUEST_STATUS_LABEL } from "@/lib/crm/labels"

/**
 * Formularios del CRM. Todos siguen el mismo patrón:
 *
 * - llaman a una Server Action, que **vuelve a autorizar y a validar** en
 *   servidor (estos componentes no son la barrera de seguridad, solo la interfaz);
 * - muestran el error que devuelve la acción en vez de tragárselo;
 * - refrescan la ruta al terminar para que los datos mostrados sean los reales y
 *   no una versión optimista que podría no coincidir con la base de datos.
 */

const inputClass =
  "w-full border border-border bg-transparent px-2.5 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:border-foreground"
const labelClass = "block text-[10px] tracking-[0.15em] uppercase text-muted-foreground mb-1"
const primaryClass =
  "px-4 py-2 text-xs tracking-[0.15em] uppercase text-primary-foreground bg-primary transition-colors duration-300 hover:bg-primary/90 disabled:opacity-60"
const subtleClass =
  "px-3 py-1.5 text-xs tracking-[0.15em] uppercase text-muted-foreground border border-border transition-colors duration-300 hover:text-foreground disabled:opacity-60"

const PRIORITIES: Priority[] = ["LOW", "NORMAL", "HIGH", "URGENT"]

function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null
  return (
    <ul role="alert" className="space-y-1 text-sm text-destructive">
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  )
}

/** Envoltorio común: ejecuta la acción, guarda los errores y refresca si va bien. */
function useCrmAction() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<string[]>([])

  const run = (action: () => Promise<CrmActionResult>, onSuccess?: () => void) => {
    setErrors([])
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        onSuccess?.()
        router.refresh()
      } else {
        setErrors(result.errors)
      }
    })
  }

  return { run, isPending, errors }
}

// ---------------------------------------------------------------------------
// Notas
// ---------------------------------------------------------------------------

export function AddNoteForm({ leadId }: { leadId: string }) {
  const { run, isPending, errors } = useCrmAction()
  const [body, setBody] = useState("")

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        run(() => addLeadNoteAction({ leadId, body }), () => setBody(""))
      }}
      className="space-y-2"
    >
      <label htmlFor="nota-nueva" className={labelClass}>
        Nueva nota interna
      </label>
      <textarea
        id="nota-nueva"
        rows={3}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className={`${inputClass} resize-y`}
        placeholder="Qué se ha hablado, qué queda pendiente…"
      />
      <ErrorList errors={errors} />
      <button type="submit" disabled={isPending || body.trim().length === 0} className={primaryClass}>
        {isPending ? "Guardando…" : "Añadir nota"}
      </button>
    </form>
  )
}

export function EditNoteForm({ noteId, initialBody }: { noteId: string; initialBody: string }) {
  const { run, isPending, errors } = useCrmAction()
  const [isEditing, setIsEditing] = useState(false)
  const [body, setBody] = useState(initialBody)

  if (!isEditing) {
    return (
      <button type="button" onClick={() => setIsEditing(true)} className={subtleClass}>
        Editar
      </button>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        run(() => updateLeadNoteAction({ noteId, body }), () => setIsEditing(false))
      }}
      className="mt-2 space-y-2"
    >
      <label htmlFor={`nota-${noteId}`} className="sr-only">
        Editar nota
      </label>
      <textarea
        id={`nota-${noteId}`}
        rows={3}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className={`${inputClass} resize-y`}
      />
      <ErrorList errors={errors} />
      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className={primaryClass}>
          {isPending ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setBody(initialBody)
            setIsEditing(false)
          }}
          className={subtleClass}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Tareas
// ---------------------------------------------------------------------------

export type AssignableUser = { id: string; name: string }

export function CreateTaskForm({
  leadId,
  requests,
  users,
}: {
  leadId: string
  requests: Array<{ id: string; label: string }>
  users: AssignableUser[]
}) {
  const { run, isPending, errors } = useCrmAction()
  const [title, setTitle] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [assigneeId, setAssigneeId] = useState("")
  const [priority, setPriority] = useState<Priority>("NORMAL")
  const [leadRequestId, setLeadRequestId] = useState("")

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        run(
          () => createTaskAction({ leadId, title, dueAt, assigneeId, priority, leadRequestId }),
          () => {
            setTitle("")
            setDueAt("")
            setLeadRequestId("")
          }
        )
      }}
      className="space-y-3"
    >
      <div>
        <label htmlFor="tarea-titulo" className={labelClass}>
          Tarea
        </label>
        <input
          id="tarea-titulo"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={inputClass}
          placeholder="Llamar para confirmar la visita"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="tarea-fecha" className={labelClass}>
            Vence el
          </label>
          <input
            id="tarea-fecha"
            type="date"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="tarea-prioridad" className={labelClass}>
            Prioridad
          </label>
          <select
            id="tarea-prioridad"
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
            className={inputClass}
          >
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {PRIORITY_LABEL[value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tarea-responsable" className={labelClass}>
            Responsable
          </label>
          <select
            id="tarea-responsable"
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
            className={inputClass}
          >
            <option value="">Sin asignar</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
        {requests.length > 0 && (
          <div>
            <label htmlFor="tarea-solicitud" className={labelClass}>
              Solicitud relacionada
            </label>
            <select
              id="tarea-solicitud"
              value={leadRequestId}
              onChange={(event) => setLeadRequestId(event.target.value)}
              className={inputClass}
            >
              <option value="">Ninguna en concreto</option>
              {requests.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <ErrorList errors={errors} />
      <button type="submit" disabled={isPending} className={primaryClass}>
        {isPending ? "Creando…" : "Crear tarea"}
      </button>
    </form>
  )
}

export function TaskRowActions({ taskId, status }: { taskId: string; status: FollowUpStatus }) {
  const { run, isPending, errors } = useCrmAction()

  if (status !== "PENDING") {
    return <span className="text-xs text-muted-foreground">Cerrada</span>
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={isPending} onClick={() => run(() => completeTaskAction({ taskId }))} className={subtleClass}>
          Completar
        </button>
        <button type="button" disabled={isPending} onClick={() => run(() => cancelTaskAction({ taskId }))} className={subtleClass}>
          Cancelar
        </button>
      </div>
      <ErrorList errors={errors} />
    </div>
  )
}

export function EditTaskForm({
  taskId,
  initial,
  users,
}: {
  taskId: string
  initial: { title: string; dueAt: string; assigneeId: string; priority: Priority }
  users: AssignableUser[]
}) {
  const { run, isPending, errors } = useCrmAction()
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(initial.title)
  const [dueAt, setDueAt] = useState(initial.dueAt)
  const [assigneeId, setAssigneeId] = useState(initial.assigneeId)
  const [priority, setPriority] = useState<Priority>(initial.priority)

  if (!isEditing) {
    return (
      <button type="button" onClick={() => setIsEditing(true)} className={subtleClass}>
        Editar
      </button>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        run(() => updateTaskAction({ taskId, title, dueAt, assigneeId, priority }), () => setIsEditing(false))
      }}
      className="mt-2 space-y-2"
    >
      <input aria-label="Tarea" value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} />
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          aria-label="Vence el"
          type="date"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
          className={inputClass}
        />
        <select
          aria-label="Prioridad"
          value={priority}
          onChange={(event) => setPriority(event.target.value as Priority)}
          className={inputClass}
        >
          {PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {PRIORITY_LABEL[value]}
            </option>
          ))}
        </select>
        <select
          aria-label="Responsable"
          value={assigneeId}
          onChange={(event) => setAssigneeId(event.target.value)}
          className={inputClass}
        >
          <option value="">Sin asignar</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>
      <ErrorList errors={errors} />
      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className={primaryClass}>
          {isPending ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={() => setIsEditing(false)} className={subtleClass}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Estado del pipeline
// ---------------------------------------------------------------------------

export function ChangeStatusForm({
  requestId,
  currentStatus,
  allowed,
  compact = false,
}: {
  requestId: string
  currentStatus: LeadRequestStatus
  allowed: readonly LeadRequestStatus[]
  compact?: boolean
}) {
  const { run, isPending, errors } = useCrmAction()
  const [nextStatus, setNextStatus] = useState<string>("")
  const [lostReason, setLostReason] = useState("")

  if (allowed.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {REQUEST_STATUS_LABEL[currentStatus]} es un estado final: no admite más movimientos.
      </p>
    )
  }

  const requiresReason = nextStatus === "LOST"

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        run(() => changeRequestStatusAction({ requestId, nextStatus, lostReason }), () => {
          setNextStatus("")
          setLostReason("")
        })
      }}
      className="space-y-2"
    >
      <div className={compact ? "space-y-2" : "flex flex-wrap items-end gap-2"}>
        <div className={compact ? "" : "min-w-[200px]"}>
          <label htmlFor={`estado-${requestId}`} className={labelClass}>
            Mover a
          </label>
          <select
            id={`estado-${requestId}`}
            value={nextStatus}
            onChange={(event) => setNextStatus(event.target.value)}
            className={inputClass}
          >
            <option value="">Selecciona un estado</option>
            {/* Solo las transiciones que el dominio permite desde el estado
                actual. El servidor las vuelve a comprobar de todos modos. */}
            {allowed.map((status) => (
              <option key={status} value={status}>
                {REQUEST_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>
        {!compact && (
          <button type="submit" disabled={isPending || nextStatus === ""} className={primaryClass}>
            {isPending ? "Moviendo…" : "Mover"}
          </button>
        )}
      </div>

      {requiresReason && (
        <div>
          <label htmlFor={`motivo-${requestId}`} className={labelClass}>
            Motivo de la pérdida (obligatorio)
          </label>
          <input
            id={`motivo-${requestId}`}
            value={lostReason}
            onChange={(event) => setLostReason(event.target.value)}
            className={inputClass}
            placeholder="Presupuesto, fecha no disponible, eligió otra finca…"
          />
        </div>
      )}

      <ErrorList errors={errors} />

      {compact && (
        <button type="submit" disabled={isPending || nextStatus === ""} className={subtleClass}>
          {isPending ? "Moviendo…" : "Mover"}
        </button>
      )}
    </form>
  )
}

// ---------------------------------------------------------------------------
// Gestión de la solicitud
// ---------------------------------------------------------------------------

export function RequestDetailsForm({
  requestId,
  initial,
  users,
  spaces,
  budgets,
}: {
  requestId: string
  initial: {
    priority: Priority
    ownerId: string
    nextActionAt: string
    preferredSpace: string
    budgetRange: string
  }
  users: AssignableUser[]
  spaces: Array<{ value: string; label: string }>
  budgets: Array<{ value: string; label: string }>
}) {
  const { run, isPending, errors } = useCrmAction()
  const [priority, setPriority] = useState<Priority>(initial.priority)
  const [ownerId, setOwnerId] = useState(initial.ownerId)
  const [nextActionAt, setNextActionAt] = useState(initial.nextActionAt)
  const [preferredSpace, setPreferredSpace] = useState(initial.preferredSpace)
  const [budgetRange, setBudgetRange] = useState(initial.budgetRange)
  const [saved, setSaved] = useState(false)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        setSaved(false)
        run(
          () => updateRequestAction({ requestId, priority, ownerId, nextActionAt, preferredSpace, budgetRange }),
          () => setSaved(true)
        )
      }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="sol-prioridad" className={labelClass}>
            Prioridad
          </label>
          <select
            id="sol-prioridad"
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
            className={inputClass}
          >
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {PRIORITY_LABEL[value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sol-responsable" className={labelClass}>
            Responsable
          </label>
          <select id="sol-responsable" value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className={inputClass}>
            <option value="">Sin asignar</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sol-proxima" className={labelClass}>
            Próxima acción
          </label>
          <input
            id="sol-proxima"
            type="date"
            value={nextActionAt}
            onChange={(event) => setNextActionAt(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="sol-espacio" className={labelClass}>
            Espacio
          </label>
          <select
            id="sol-espacio"
            value={preferredSpace}
            onChange={(event) => setPreferredSpace(event.target.value)}
            className={inputClass}
          >
            <option value="">Sin definir</option>
            {spaces.map((space) => (
              <option key={space.value} value={space.value}>
                {space.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sol-presupuesto" className={labelClass}>
            Presupuesto
          </label>
          <select
            id="sol-presupuesto"
            value={budgetRange}
            onChange={(event) => setBudgetRange(event.target.value)}
            className={inputClass}
          >
            <option value="">Sin definir</option>
            {budgets.map((budget) => (
              <option key={budget.value} value={budget.value}>
                {budget.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <ErrorList errors={errors} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending} className={primaryClass}>
          {isPending ? "Guardando…" : "Guardar gestión"}
        </button>
        <span aria-live="polite" className="text-xs text-muted-foreground">
          {saved && !isPending ? "Guardado" : ""}
        </span>
      </div>
    </form>
  )
}

export function ArchiveRequestButton({ requestId }: { requestId: string }) {
  const { run, isPending, errors } = useCrmAction()
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={subtleClass}>
        Archivar
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Archivar la saca de listados y tablero, pero <strong className="text-foreground">no la borra</strong>: sigue en la
        ficha del contacto.
      </p>
      <ErrorList errors={errors} />
      <div className="flex gap-2">
        <button type="button" disabled={isPending} onClick={() => run(() => archiveRequestAction({ requestId }))} className={primaryClass}>
          {isPending ? "Archivando…" : "Confirmar"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className={subtleClass}>
          No archivar
        </button>
      </div>
    </div>
  )
}

export function RecalculateScoreButton({ leadId }: { leadId: string }) {
  const { run, isPending, errors } = useCrmAction()

  return (
    <div className="space-y-1">
      <button type="button" disabled={isPending} onClick={() => run(() => recalculateLeadScoreAction({ leadId }))} className={subtleClass}>
        {isPending ? "Recalculando…" : "Recalcular puntuación"}
      </button>
      <ErrorList errors={errors} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Configuración de scoring
// ---------------------------------------------------------------------------

export function ScoringRuleForm({
  ruleKey,
  label,
  initialPoints,
  initialActive,
}: {
  ruleKey: string
  label: string
  initialPoints: number
  initialActive: boolean
}) {
  const { run, isPending, errors } = useCrmAction()
  const [points, setPoints] = useState(String(initialPoints))
  const [active, setActive] = useState(initialActive)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        run(() => updateScoringRuleAction({ key: ruleKey, points, active }))
      }}
      className="flex flex-wrap items-end gap-3 border-b border-border/60 py-3"
    >
      <div className="min-w-[240px] flex-1">
        <span className="block text-sm text-foreground">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{ruleKey}</span>
      </div>
      <div className="w-24">
        <label htmlFor={`puntos-${ruleKey}`} className={labelClass}>
          Puntos
        </label>
        <input
          id={`puntos-${ruleKey}`}
          type="number"
          min={0}
          max={100}
          value={points}
          onChange={(event) => setPoints(event.target.value)}
          className={inputClass}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
        Activa
      </label>
      <button type="submit" disabled={isPending} className={subtleClass}>
        {isPending ? "Guardando…" : "Guardar"}
      </button>
      <div className="w-full">
        <ErrorList errors={errors} />
      </div>
    </form>
  )
}
