import type { Metadata } from "next"
import Link from "next/link"
import { requireCrmAccess } from "../guards"
import { listAssignableUsers } from "@/lib/domain/crm-requests"
import { isTaskView, listTasks, type TaskView } from "@/lib/domain/tasks"
import { leadName, toDateInputValue } from "@/lib/crm/labels"
import { parsePageParam } from "@/lib/validation/crm"
import { EmptyState, Pagination } from "../crm-ui"
import { TasksTable, type TaskRowData } from "./tasks-table"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Acciones",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

/**
 * Rótulo de una vista recibida por URL.
 *
 * Las seis pestañas de filtro se retiraron a petición del titular: la pantalla es una tabla
 * con todas las acciones. Pero el parámetro `vista` **sigue funcionando**, sin interfaz que
 * lo genere, porque los anillos de Estatus Plataforma enlazan aquí acotados —«vencidas»,
 * «próximos 7 días»—, y ese salto desde una cifra a su detalle es la mitad de la utilidad
 * de un panel. Cuando llega acotado se dice en una línea, con salida a la vista completa;
 * lo que no hay es un bloque de filtros que ocupe pantalla cuando nadie lo ha pedido.
 */
const VIEW_LABEL: Record<TaskView, string> = {
  mias: "las asignadas a ti",
  vencidas: "las vencidas",
  hoy: "las que vencen hoy",
  semana: "las de los próximos 7 días",
  completadas: "las ya cerradas",
  todas: "todas",
}

type SearchParams = { vista?: string; pagina?: string }

export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireCrmAccess()
  const params = await searchParams

  // El valor por defecto es «todas», no «mías»: la pantalla que se pidió es la tabla
  // completa, y arrancar filtrado por la persona que mira era otra forma de filtrar.
  const view: TaskView = params.vista && isTaskView(params.vista) ? (params.vista as TaskView) : "todas"
  const page = parsePageParam(params.pagina)
  const now = new Date()

  const [{ tasks, total, totalPages }, users] = await Promise.all([
    listTasks(view, user.id, now, page),
    listAssignableUsers(),
  ])

  // Se entrega a la tabla solo lo que pinta, y las fechas ya convertidas. El cálculo de
  // «vencida» se hace **aquí**, con el reloj del servidor: hacerlo en el cliente daría un
  // resultado distinto según la hora del equipo de quien mire.
  const rows: TaskRowData[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    dueAt: toDateInputValue(task.dueAt),
    priority: task.priority,
    assigneeId: task.assigneeId ?? "",
    status: task.status,
    overdue: task.status === "PENDING" && task.dueAt < now,
    lead: { id: task.lead.id, name: leadName(task.lead) },
  }))

  const buildHref = (nextPage: number) => `/admin/tareas?vista=${view}&pagina=${nextPage}`

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl font-light text-foreground">Acciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Llamadas, visitas y recordatorios del seguimiento comercial. Se editan aquí mismo: cada celda guarda al
          modificarla. Se crean desde la ficha de cada interesado, para que nazcan siempre ligadas a alguien.
        </p>
      </div>

      {view !== "todas" && (
        <p className="flex flex-wrap items-center gap-2 border border-border px-3 py-2 text-[13px] text-muted-foreground">
          Mostrando solo {VIEW_LABEL[view]}.
          <Link href="/admin/tareas" className="underline transition-colors duration-200 hover:text-foreground">
            Ver todas
          </Link>
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState>
          {view === "todas"
            ? "Todavía no hay ninguna acción. Se crean desde la ficha de un interesado."
            : "No hay ninguna acción en esta selección."}
        </EmptyState>
      ) : (
        <TasksTable rows={rows} users={users} />
      )}

      <Pagination page={page} totalPages={totalPages} total={total} noun="acciones" buildHref={buildHref} />
    </div>
  )
}
