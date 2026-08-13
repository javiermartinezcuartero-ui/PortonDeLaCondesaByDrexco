import type { Metadata } from "next"
import Link from "next/link"
import { requireCrmAccess } from "../guards"
import { listAssignableUsers } from "@/lib/domain/crm-requests"
import { TASK_VIEWS, countTasksByView, isTaskView, listTasks, type TaskView } from "@/lib/domain/tasks"
import { PRIORITY_LABEL, TASK_STATUS_LABEL, formatDate, leadName, toDateInputValue } from "@/lib/crm/labels"
import { parsePageParam } from "@/lib/validation/crm"
import { EditTaskForm, TaskRowActions } from "../crm-forms"
import { EmptyState, Pagination, Pill } from "../crm-ui"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Tareas",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

const VIEW_LABEL: Record<TaskView, string> = {
  mias: "Mías",
  vencidas: "Vencidas",
  hoy: "Hoy",
  semana: "Esta semana",
  completadas: "Cerradas",
  todas: "Todas",
}

type SearchParams = { vista?: string; pagina?: string }

export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireCrmAccess()
  const params = await searchParams

  const view: TaskView = params.vista && isTaskView(params.vista) ? (params.vista as TaskView) : "mias"
  const page = parsePageParam(params.pagina)
  const now = new Date()

  const [{ tasks, total, totalPages }, counts, users] = await Promise.all([
    listTasks(view, user.id, now, page),
    countTasksByView(user.id, now),
    listAssignableUsers(),
  ])

  const buildHref = (nextPage: number) => `/admin/tareas?vista=${view}&pagina=${nextPage}`

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-light text-foreground">Tareas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Las tareas se crean desde la ficha de cada contacto, para que nazcan siempre ligadas a alguien.
        </p>
      </div>

      <nav aria-label="Vistas de tareas" className="flex flex-wrap gap-1 border-b border-border">
        {TASK_VIEWS.map((key) => {
          const isActive = key === view
          return (
            <Link
              key={key}
              href={`/admin/tareas?vista=${key}`}
              aria-current={isActive ? "page" : undefined}
              className={`-mb-px border-b-2 px-4 py-2.5 text-xs tracking-[0.15em] uppercase transition-colors duration-300 ${
                isActive ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {VIEW_LABEL[key]} ({counts[key]})
            </Link>
          )
        })}
      </nav>

      {tasks.length === 0 ? (
        <EmptyState>
          {view === "mias"
            ? "No tienes tareas pendientes asignadas."
            : view === "vencidas"
              ? "No hay tareas vencidas. "
              : "No hay tareas en esta vista."}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => {
            const isOverdue = task.status === "PENDING" && task.dueAt < now
            return (
              <li key={task.id} className="border border-border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <span className="text-sm text-foreground">{task.title}</span>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <Link
                        href={`/admin/contactos/${task.lead.id}`}
                        className="underline transition-colors duration-300 hover:text-foreground"
                      >
                        {leadName(task.lead)}
                      </Link>
                      {" · "}
                      Vence {formatDate(task.dueAt)} · {PRIORITY_LABEL[task.priority]} ·{" "}
                      {task.assignee?.name ?? "Sin asignar"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isOverdue && <Pill tone="alert">Vencida</Pill>}
                    <Pill>{TASK_STATUS_LABEL[task.status]}</Pill>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
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
            )
          })}
        </ul>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} noun="tareas" buildHref={buildHref} />
    </div>
  )
}
