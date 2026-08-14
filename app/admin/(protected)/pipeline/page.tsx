import type { Metadata } from "next"
import type { LeadRequestStatus } from "@prisma/client"
import { requireCrmAccess } from "../guards"
import { listRequestsForPipeline } from "@/lib/domain/crm-requests"
import { allowedTransitionsFrom } from "@/lib/domain/lead-requests"
import { PIPELINE_COLUMN_ORDER } from "@/lib/crm/labels"
import { EmptyState } from "../crm-ui"
import { PipelineBoard, type BoardCard } from "./pipeline-board"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Seguimiento clientes",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

/**
 * Tablero del pipeline. **Solo tablero**: la vista de tabla se retiró a petición del
 * titular, junto con el desplegable «Mover a» de cada tarjeta, porque el movimiento se
 * hace ahora arrastrando. El arrastre y su alternativa de teclado están en
 * `pipeline-board.tsx`.
 *
 * Esta página se queda con lo que le toca a un componente de servidor: consultar, y
 * entregar al cliente **solo los campos que el tablero pinta**. No se le pasa la
 * solicitud entera: un tablero no necesita el mensaje que escribió la persona ni su
 * teléfono, y lo que no se serializa no puede acabar en el HTML de una pantalla que
 * alguien deja abierta.
 *
 * Las transiciones válidas también viajan desde aquí, calculadas con la misma función
 * que usa el dominio. Así el tablero no tiene su propia copia de la máquina de estados
 * —dos copias se desincronizan— y sigue siendo el servidor quien valida cada
 * movimiento.
 */
export default async function PipelinePage() {
  await requireCrmAccess()

  const cards = await listRequestsForPipeline()

  const board: BoardCard[] = cards.map((card) => ({
    id: card.id,
    status: card.status,
    subject: card.subject,
    eventType: card.eventType,
    // Las fechas van como ISO y no como `Date`: cruzar la frontera al cliente las
    // serializa igualmente, y declararlo aquí evita que el tipo prometa un `Date` que
    // en el cliente llega como cadena.
    eventDate: card.eventDate?.toISOString() ?? null,
    priority: card.priority,
    ownerName: card.owner?.name ?? null,
    nextActionAt: card.nextActionAt?.toISOString() ?? null,
    lead: { firstName: card.lead.firstName, lastName: card.lead.lastName, email: card.lead.email },
  }))

  const transitions = Object.fromEntries(
    PIPELINE_COLUMN_ORDER.map((status) => [status, [...allowedTransitionsFrom(status)]])
  ) as Record<LeadRequestStatus, LeadRequestStatus[]>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-light text-foreground">Seguimiento clientes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Las cinco fases por las que pasa una solicitud: Contacto, Presentación, Propuesta, Cliente y Perdida.
          {" "}
          {cards.length} en curso. Arrastra una tarjeta a otra columna para moverla; cada movimiento valida la
          transición y queda registrado.
        </p>
      </div>

      {cards.length === 0 ? (
        <EmptyState>No hay solicitudes activas en el pipeline.</EmptyState>
      ) : (
        <PipelineBoard cards={board} transitions={transitions} />
      )}
    </div>
  )
}
