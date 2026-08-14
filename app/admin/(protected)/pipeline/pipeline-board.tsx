"use client"

import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { LeadRequestStatus } from "@prisma/client"
import {
  PIPELINE_COLUMN_ORDER,
  PIPELINE_TONE,
  PRIORITY_LABEL,
  REQUEST_STATUS_LABEL,
  eventTypeLabel,
  formatDate,
  leadName,
} from "@/lib/crm/labels"
import { changeRequestStatusAction } from "../crm-actions"
import { Pill } from "../crm-ui"

/**
 * Tablero del pipeline con arrastrar y soltar.
 *
 * **Esto revierte una decisión anterior**, y conviene que quede dicho: la versión
 * previa no tenía arrastre a propósito, y el motivo era bueno —un tablero con drag and
 * drop accesible exige alternativa de teclado, anuncios en vivo y manejo del foco—. El
 * titular pidió el arrastre y que desapareciera el desplegable «Mover a». Se hace lo
 * pedido **sin perder el acceso por teclado**, que se resuelve así:
 *
 * - Cada tarjeta es un elemento enfocable con `Tab`.
 * - Con la tarjeta enfocada, `Ctrl`/`Cmd` + flecha izquierda o derecha la mueve al
 *   estado válido anterior o siguiente. Nada de esto ocupa un píxel de pantalla, que
 *   era la objeción: el desplegable ya no está.
 * - Cada movimiento —arrastrado o teclado— se anuncia en una región `aria-live`, que es
 *   la única forma de que alguien que no ve el tablero sepa qué acaba de pasar.
 *
 * Lo que **no** cambia es quién decide: la transición la valida el dominio
 * (`ALLOWED_TRANSITIONS`). Aquí solo se impide intentar lo imposible —las columnas que
 * no aceptan la tarjeta se marcan y no reciben la suelta—, y el servidor vuelve a
 * comprobarlo. Que una columna se pinte o no nunca es la garantía.
 */

/** Lo que el tablero necesita de una solicitud. Se acota para no arrastrar el modelo entero al cliente. */
export type BoardCard = {
  id: string
  status: LeadRequestStatus
  subject: string | null
  eventType: string
  eventDate: string | null
  priority: keyof typeof PRIORITY_LABEL
  ownerName: string | null
  nextActionAt: string | null
  lead: { firstName: string | null; lastName: string | null; email: string }
}

export function PipelineBoard({
  cards,
  transitions,
}: {
  cards: BoardCard[]
  /** Transiciones válidas por estado, tal y como las define el dominio. */
  transitions: Record<LeadRequestStatus, LeadRequestStatus[]>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [arrastrando, setArrastrando] = useState<BoardCard | null>(null)
  const [aviso, setAviso] = useState("")
  const [error, setError] = useState("")
  /** Suelta en «Perdida» pendiente de motivo: el dominio lo exige para cerrar así. */
  const [pidiendoMotivo, setPidiendoMotivo] = useState<BoardCard | null>(null)
  const motivoRef = useRef<HTMLTextAreaElement>(null)

  const porEstado = new Map<LeadRequestStatus, BoardCard[]>()
  for (const status of PIPELINE_COLUMN_ORDER) porEstado.set(status, [])
  for (const card of cards) porEstado.get(card.status)?.push(card)

  const permitido = (card: BoardCard | null, destino: LeadRequestStatus) =>
    Boolean(card) && card!.status !== destino && transitions[card!.status].includes(destino)

  function mover(card: BoardCard, destino: LeadRequestStatus, lostReason?: string) {
    setError("")
    // El aviso se escribe antes de la respuesta: describe la intención, y si falla se
    // sustituye por el error. Al revés, quien usa lector de pantalla se queda sin saber
    // que su gesto se registró siquiera.
    setAviso(`Moviendo «${titulo(card)}» a ${REQUEST_STATUS_LABEL[destino]}…`)

    startTransition(async () => {
      const result = await changeRequestStatusAction({ requestId: card.id, nextStatus: destino, lostReason })
      if (result.ok) {
        setAviso(`«${titulo(card)}» ahora está en ${REQUEST_STATUS_LABEL[destino]}.`)
        setPidiendoMotivo(null)
        router.refresh()
      } else {
        setAviso("")
        setError(result.errors.join(" "))
      }
    })
  }

  /** Punto único de entrada: desde el arrastre y desde el teclado. */
  function intentarMover(card: BoardCard, destino: LeadRequestStatus) {
    if (!permitido(card, destino)) return
    if (destino === "LOST") {
      setPidiendoMotivo(card)
      // El foco va al motivo en el siguiente pintado, no aquí: el elemento todavía no
      // existe en el DOM cuando esto se ejecuta.
      setTimeout(() => motivoRef.current?.focus(), 0)
      return
    }
    mover(card, destino)
  }

  /** Mueve al estado válido anterior o siguiente, en el orden de las columnas. */
  function moverConTeclado(card: BoardCard, direccion: 1 | -1) {
    const validos = PIPELINE_COLUMN_ORDER.filter((status) => permitido(card, status))
    if (validos.length === 0) {
      setAviso(`«${titulo(card)}» está en ${REQUEST_STATUS_LABEL[card.status]}, que no admite más movimientos.`)
      return
    }
    const actual = PIPELINE_COLUMN_ORDER.indexOf(card.status)
    const candidatos = direccion === 1
      ? validos.filter((status) => PIPELINE_COLUMN_ORDER.indexOf(status) > actual)
      : validos.filter((status) => PIPELINE_COLUMN_ORDER.indexOf(status) < actual).reverse()

    const destino = candidatos[0] ?? validos[direccion === 1 ? 0 : validos.length - 1]
    intentarMover(card, destino)
  }

  return (
    <div className="space-y-3">
      {/* Instrucción de teclado. Visible solo al recibir el foco: quien usa el ratón no
          necesita leerla, y quien navega con teclado la encuentra justo antes de entrar
          en el tablero. */}
      <p className="sr-only focus-within:not-sr-only text-xs text-muted-foreground" tabIndex={0}>
        Tablero del pipeline. Con una tarjeta enfocada, Control o Comando más flecha izquierda o derecha
        la mueve al estado válido anterior o siguiente.
      </p>

      {error && (
        <p role="alert" className="border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-foreground">
          {error}
        </p>
      )}

      {/* Región de anuncios. Vacía en pantalla, imprescindible para un lector. */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {aviso}
      </p>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4">
          {PIPELINE_COLUMN_ORDER.map((status) => {
            const columna = porEstado.get(status) ?? []
            const aceptaAhora = arrastrando ? permitido(arrastrando, status) : null

            return (
              <section
                key={status}
                aria-labelledby={`col-${status}`}
                data-suelta={aceptaAhora === null ? undefined : aceptaAhora ? "permitida" : "bloqueada"}
                // Cinco columnas en vez de nueve: `flex-1` con un ancho mínimo, para que
                // el tablero ocupe el ancho disponible en lugar de dejar media pantalla
                // vacía. Con nueve columnas hacía falta desplazamiento horizontal
                // siempre; con cinco solo en pantallas estrechas.
                className="pipe-columna w-72 shrink-0 rounded-xl p-1 transition-opacity duration-200 lg:w-auto lg:min-w-56 lg:flex-1"
                onDragOver={(event) => {
                  // `preventDefault` solo donde se puede soltar: es lo que hace que el
                  // cursor muestre «permitido» o «prohibido» sin escribir nada más.
                  if (aceptaAhora) event.preventDefault()
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (arrastrando && aceptaAhora) intentarMover(arrastrando, status)
                  setArrastrando(null)
                }}
              >
                <h2 id={`col-${status}`} className="mb-3 flex">
                  <span className="pipe-pill" data-tono={PIPELINE_TONE[status]}>
                    {REQUEST_STATUS_LABEL[status]}
                    <span className="pipe-pill__cuenta">{columna.length}</span>
                  </span>
                </h2>

                {columna.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                    Vacío
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {columna.map((card) => {
                      const movible = transitions[card.status].length > 0
                      return (
                        <li
                          key={card.id}
                          // `draggable` solo si hay algún destino válido: una tarjeta en
                          // «Ganada» no se puede mover a ninguna parte, y dejarla
                          // arrastrable prometería algo que no va a ocurrir.
                          draggable={movible && !isPending}
                          data-movible={movible ? "si" : "no"}
                          data-arrastrando={arrastrando?.id === card.id ? "si" : undefined}
                          tabIndex={0}
                          aria-label={`${titulo(card)}. Estado ${REQUEST_STATUS_LABEL[card.status]}.`}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move"
                            // Aunque el estado se lleva en React, se escribe también en
                            // el dataTransfer: sin ningún dato, Firefox cancela el
                            // arrastre antes de empezar.
                            event.dataTransfer.setData("text/plain", card.id)
                            setArrastrando(card)
                          }}
                          onDragEnd={() => setArrastrando(null)}
                          onKeyDown={(event) => {
                            if (!event.ctrlKey && !event.metaKey) return
                            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
                            event.preventDefault()
                            moverConTeclado(card, event.key === "ArrowRight" ? 1 : -1)
                          }}
                          className="pipe-tarjeta rounded-lg border border-border p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Link
                            href={`/admin/solicitudes/${card.id}`}
                            className="text-sm text-foreground transition-colors duration-300 hover:text-accent"
                          >
                            {titulo(card)}
                          </Link>
                          <p className="mt-0.5 text-xs text-muted-foreground">{leadName(card.lead)}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {card.priority !== "NORMAL" && (
                              <Pill tone={card.priority === "URGENT" ? "alert" : "neutral"}>
                                {PRIORITY_LABEL[card.priority]}
                              </Pill>
                            )}
                            {card.eventDate && <Pill>{formatDate(new Date(card.eventDate))}</Pill>}
                          </div>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {card.ownerName ?? "Sin asignar"}
                            {card.nextActionAt ? ` · próxima acción ${formatDate(new Date(card.nextActionAt))}` : ""}
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      </div>

      {pidiendoMotivo && (
        <MotivoDePerdida
          card={pidiendoMotivo}
          textareaRef={motivoRef}
          isPending={isPending}
          onCancelar={() => setPidiendoMotivo(null)}
          onConfirmar={(motivo) => mover(pidiendoMotivo, "LOST", motivo)}
        />
      )}
    </div>
  )
}

/**
 * Motivo de la pérdida.
 *
 * No es un adorno del formulario: el dominio rechaza pasar a «Perdida» sin motivo, así
 * que soltar una tarjeta ahí **tiene** que preguntarlo. Es la única transición del
 * tablero que no se puede completar con el gesto solo.
 */
function MotivoDePerdida({
  card,
  textareaRef,
  isPending,
  onCancelar,
  onConfirmar,
}: {
  card: BoardCard
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  isPending: boolean
  onCancelar: () => void
  onConfirmar: (motivo: string) => void
}) {
  const [motivo, setMotivo] = useState("")

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="motivo-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancelar()
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (motivo.trim()) onConfirmar(motivo)
        }}
        className="admin-chrome w-full max-w-md rounded-2xl border border-border p-5 shadow-2xl"
      >
        <h2 id="motivo-titulo" className="text-sm font-semibold text-foreground">
          Marcar «{titulo(card)}» como perdida
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          El motivo es obligatorio y queda registrado con el movimiento.
        </p>
        <textarea
          ref={textareaRef}
          rows={3}
          value={motivo}
          onChange={(event) => setMotivo(event.target.value)}
          className="mt-3 w-full rounded-lg border border-border bg-transparent px-2.5 py-2 text-sm text-foreground focus-visible:border-foreground focus-visible:outline-none"
          placeholder="Presupuesto fuera de rango, fecha no disponible…"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending || !motivo.trim()}
            className="admin-pill admin-pill--danger rounded-full px-4 py-2 text-xs uppercase tracking-[0.15em] disabled:opacity-50"
          >
            {isPending ? "Guardando…" : "Marcar perdida"}
          </button>
        </div>
      </form>
    </div>
  )
}

/** Título de la tarjeta: el asunto si hay, y si no el tipo de evento. */
function titulo(card: BoardCard): string {
  return card.subject ?? eventTypeLabel(card.eventType)
}
