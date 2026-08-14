"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Loader2, TriangleAlert, X } from "lucide-react"
import type { FollowUpStatus, Priority } from "@prisma/client"
import { PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/lib/crm/labels"
import { cancelTaskAction, completeTaskAction, updateTaskAction } from "../crm-actions"
import type { AssignableUser } from "../crm-forms"
import { Pill } from "../crm-ui"

/**
 * Tabla de acciones editable en línea.
 *
 * Sustituye a la lista de tarjetas con seis pestañas de filtro y un botón «Editar» que
 * abría un formulario dentro de cada tarjeta. Lo pedido era «una tabla tipo CRM de Google
 * con todas las tareas, modificables desde la misma tabla, rápido y funcional», y eso es
 * literalmente lo que hay: una fila por acción y cada campo editable donde está.
 *
 * Tres cosas que conviene entender antes de tocar esto:
 *
 * 1. **Cada campo guarda la fila entera.** `updateTaskAction` recibe título, fecha,
 *    prioridad y responsable juntos, porque el dominio valida la tarea completa —el título
 *    tiene mínimo, la fecha tiene que ser una fecha—. Enviar solo el campo tocado exigiría
 *    una acción por campo y cuatro validaciones parciales del mismo objeto. Con la fila
 *    completa, la validación es la que ya existe y el resultado es el mismo.
 *
 * 2. **El texto guarda al salir del campo; los desplegables y la fecha, al cambiar.** No es
 *    una inconsistencia: guardar al teclear enviaría una petición por letra, y guardar un
 *    desplegable al «salir» obliga a un clic de más que nadie entiende.
 *
 * 3. **Una acción cerrada no se edita, y eso lo decide el dominio**, no esta tabla
 *    (`updateFollowUpTask` rechaza cualquier tarea que no esté pendiente). Aquí los campos
 *    se pintan como texto cuando está cerrada, que es la interfaz honesta de esa regla:
 *    ofrecer un desplegable que el servidor va a rechazar es peor que no ofrecerlo.
 *
 * El estado de cada guardado se ve en la última columna y **se anuncia** en una región
 * `aria-live`: sin ella, una tabla que guarda sola no da ninguna señal a quien no ve el
 * icono aparecer.
 */

export type TaskRowData = {
  id: string
  title: string
  /** `yyyy-mm-dd`, listo para un `<input type="date">`. */
  dueAt: string
  priority: Priority
  assigneeId: string
  status: FollowUpStatus
  /** Calculado en el servidor con su reloj: pendiente y ya pasada de fecha. */
  overdue: boolean
  lead: { id: string; name: string }
}

const PRIORITIES: Priority[] = ["LOW", "NORMAL", "HIGH", "URGENT"]

/** Tono de la prioridad, con la misma paleta que las fases del pipeline. */
const PRIORITY_TONE: Record<Priority, string> = {
  LOW: "gris",
  NORMAL: "azul",
  HIGH: "ambar",
  URGENT: "rojo",
}

const celdaInput =
  "w-full border border-transparent bg-transparent px-2 py-1.5 text-[13px] text-foreground transition-colors duration-200 hover:border-border focus-visible:border-foreground/60 focus-visible:outline-none"

export function TasksTable({ rows, users }: { rows: TaskRowData[]; users: AssignableUser[] }) {
  const [aviso, setAviso] = useState("")

  return (
    <>
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {aviso}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <caption className="sr-only">
            Acciones de seguimiento comercial. Cada celda se guarda al modificarla.
          </caption>
          <thead>
            <tr className="border-b border-border text-xs uppercase text-muted-foreground">
              {/* El 32 % es para el título, que es el único campo de texto libre de la
                  fila: sin reservarle ancho, la tabla le daba el sobrante de las otras seis
                  columnas y una acción como «Necesitamos agendarlo cuando sea posible»
                  cabía a medias en su propio campo. */}
              <th scope="col" className="py-2.5 pr-3 w-[32%]">Acción</th>
              <th scope="col" className="py-2.5 pr-3">Interesado</th>
              <th scope="col" className="py-2.5 pr-3">Vence</th>
              <th scope="col" className="py-2.5 pr-3">Prioridad</th>
              <th scope="col" className="py-2.5 pr-3">Responsable</th>
              <th scope="col" className="py-2.5 pr-3">Estado</th>
              <th scope="col" className="py-2.5 w-10">
                <span className="sr-only">Guardado</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <TaskRow key={row.id} row={row} users={users} onAviso={setAviso} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

type Estado = "reposo" | "guardando" | "guardado" | "error"

function TaskRow({
  row,
  users,
  onAviso,
}: {
  row: TaskRowData
  users: AssignableUser[]
  onAviso: (mensaje: string) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [estado, setEstado] = useState<Estado>("reposo")
  const [error, setError] = useState("")

  const [title, setTitle] = useState(row.title)
  const [dueAt, setDueAt] = useState(row.dueAt)
  const [priority, setPriority] = useState<Priority>(row.priority)
  const [assigneeId, setAssigneeId] = useState(row.assigneeId)

  const editable = row.status === "PENDING"

  /**
   * Guarda la fila con los valores que se le pasen encima de los actuales.
   *
   * Recibe un parche en vez de leer el estado porque un `onChange` de `<select>` tiene el
   * valor nuevo en el evento, pero el `useState` correspondiente todavía no: guardar
   * leyendo el estado enviaría el valor anterior en cada cambio de desplegable.
   */
  function guardar(parche: Partial<Pick<TaskRowData, "title" | "dueAt" | "priority" | "assigneeId">> = {}) {
    const datos = { title, dueAt, priority, assigneeId, ...parche }
    if (datos.title.trim() === row.title && datos.dueAt === row.dueAt && datos.priority === row.priority && datos.assigneeId === row.assigneeId) {
      return
    }

    setEstado("guardando")
    setError("")
    startTransition(async () => {
      const result = await updateTaskAction({ taskId: row.id, ...datos })
      if (result.ok) {
        setEstado("guardado")
        onAviso(`«${datos.title}» guardada.`)
        router.refresh()
      } else {
        setEstado("error")
        setError(result.errors.join(" "))
        onAviso(`No se ha podido guardar «${datos.title}»: ${result.errors.join(" ")}`)
      }
    })
  }

  function cambiarEstado(siguiente: FollowUpStatus) {
    if (siguiente === row.status) return
    setEstado("guardando")
    setError("")
    startTransition(async () => {
      const result =
        siguiente === "COMPLETED" ? await completeTaskAction({ taskId: row.id }) : await cancelTaskAction({ taskId: row.id })
      if (result.ok) {
        setEstado("guardado")
        onAviso(`«${title}» marcada como ${TASK_STATUS_LABEL[siguiente].toLowerCase()}.`)
        router.refresh()
      } else {
        setEstado("error")
        setError(result.errors.join(" "))
        onAviso(`No se ha podido cambiar «${title}»: ${result.errors.join(" ")}`)
      }
    })
  }

  return (
    <tr className="align-middle" data-cerrada={editable ? undefined : "si"}>
      <td className="py-1.5 pr-3">
        {editable ? (
          <input
            value={title}
            aria-label={`Acción: ${row.title}`}
            onChange={(event) => setTitle(event.target.value)}
            // Al salir del campo y al pulsar Intro. Lo segundo porque escribir y pulsar
            // Intro es el gesto reflejo en una tabla, y sin él parece que no ha guardado.
            onBlur={() => guardar()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                event.currentTarget.blur()
              }
            }}
            className={celdaInput}
          />
        ) : (
          <span className="block px-2 py-1.5 text-[13px] text-muted-foreground line-through">{title}</span>
        )}
        {error && (
          <p role="alert" className="mt-0.5 px-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </td>

      <td className="py-1.5 pr-3">
        <Link
          href={`/admin/contactos/${row.lead.id}`}
          className="text-[13px] text-muted-foreground transition-colors duration-200 hover:text-foreground"
        >
          {row.lead.name}
        </Link>
      </td>

      <td className="py-1.5 pr-3 whitespace-nowrap">
        {editable ? (
          <span className="flex items-center gap-1.5">
            <input
              type="date"
              value={dueAt}
              aria-label={`Fecha de vencimiento de ${row.title}`}
              onChange={(event) => {
                setDueAt(event.target.value)
                if (event.target.value) guardar({ dueAt: event.target.value })
              }}
              className={celdaInput}
            />
            {row.overdue && (
              <span title="Vencida" className="shrink-0 text-destructive">
                <TriangleAlert className="size-3.5" aria-hidden />
                <span className="sr-only">Vencida</span>
              </span>
            )}
          </span>
        ) : (
          <span className="block px-2 py-1.5 text-[13px] text-muted-foreground">{dueAt || "—"}</span>
        )}
      </td>

      <td className="py-1.5 pr-3">
        {editable ? (
          <select
            value={priority}
            aria-label={`Prioridad de ${row.title}`}
            onChange={(event) => {
              const valor = event.target.value as Priority
              setPriority(valor)
              guardar({ priority: valor })
            }}
            className={celdaInput}
          >
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {PRIORITY_LABEL[value]}
              </option>
            ))}
          </select>
        ) : (
          <span className="pipe-pill" data-tono={PRIORITY_TONE[priority]}>
            {PRIORITY_LABEL[priority]}
          </span>
        )}
      </td>

      <td className="py-1.5 pr-3">
        {editable ? (
          <select
            value={assigneeId}
            aria-label={`Responsable de ${row.title}`}
            onChange={(event) => {
              setAssigneeId(event.target.value)
              guardar({ assigneeId: event.target.value })
            }}
            className={celdaInput}
          >
            <option value="">Sin asignar</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="block px-2 py-1.5 text-[13px] text-muted-foreground">
            {users.find((user) => user.id === assigneeId)?.name ?? "Sin asignar"}
          </span>
        )}
      </td>

      <td className="py-1.5 pr-3">
        {editable ? (
          // Solo hacia delante: el dominio no reabre una tarea cerrada, así que el
          // desplegable de una cerrada no tendría ninguna opción válida que ofrecer.
          <select
            value=""
            aria-label={`Cerrar ${row.title}`}
            onChange={(event) => {
              if (event.target.value) cambiarEstado(event.target.value as FollowUpStatus)
            }}
            className={celdaInput}
          >
            <option value="">Pendiente</option>
            <option value="COMPLETED">Marcar completada</option>
            <option value="CANCELLED">Marcar cancelada</option>
          </select>
        ) : (
          <Pill tone={row.status === "CANCELLED" ? "alert" : "accent"}>{TASK_STATUS_LABEL[row.status]}</Pill>
        )}
      </td>

      <td className="py-1.5 text-right">
        <EstadoDeGuardado estado={isPending ? "guardando" : estado} />
      </td>
    </tr>
  )
}

/** Señal de guardado. Tres estados y ninguno depende solo del color. */
function EstadoDeGuardado({ estado }: { estado: Estado }) {
  if (estado === "guardando") {
    return (
      <span title="Guardando" className="inline-flex text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        <span className="sr-only">Guardando</span>
      </span>
    )
  }
  if (estado === "guardado") {
    return (
      <span title="Guardado" className="inline-flex text-[oklch(0.52_0.15_148)]">
        <Check className="size-4" aria-hidden />
        <span className="sr-only">Guardado</span>
      </span>
    )
  }
  if (estado === "error") {
    return (
      <span title="No se ha guardado" className="inline-flex text-destructive">
        <X className="size-4" aria-hidden />
        <span className="sr-only">No se ha guardado</span>
      </span>
    )
  }
  return null
}
