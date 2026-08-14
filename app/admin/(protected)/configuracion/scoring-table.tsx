"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, X } from "lucide-react"
import { updateScoringRuleAction } from "../crm-actions"

/**
 * Tabla de reglas de puntuación, editable en línea y agrupada.
 *
 * Sustituye a la pila de ocho formularios —uno por regla, cada uno con su etiqueta, su
 * campo, su casilla y su botón «Guardar»—. El resultado eran ocho botones idénticos en
 * vertical y ocho formularios que había que enviar de uno en uno para cambiar los pesos.
 *
 * **La agrupación es lo que hace que los pesos se puedan comparar.** Las ocho reglas no
 * miden lo mismo: unas dicen «esta persona ha dado un dato de contacto», otras «ha mostrado
 * interés navegando» y otras «ha pedido algo concreto». Puestas en una sola lista alfabética
 * —que es como llegan de la base de datos, `orderBy: key`— no hay forma de ver si los pesos
 * son coherentes entre sí. Agrupadas, la pregunta «¿vale lo mismo dejar el teléfono que
 * pedir una visita?» se responde de un vistazo, y cada grupo lleva su subtotal.
 *
 * El total de cada grupo y el general se calculan **en el cliente y en vivo**: al subir un
 * peso, el total se mueve antes de guardar. Es lo que permite repartir 100 puntos sin
 * calcularlo a mano.
 */

export type ScoringRow = {
  key: string
  label: string
  points: number
  active: boolean
}

export type ScoringGroup = {
  title: string
  hint: string
  rows: ScoringRow[]
}

const celdaInput =
  "w-20 border border-transparent bg-transparent px-2 py-1 text-[13px] text-foreground transition-colors duration-200 hover:border-border focus-visible:border-foreground/60 focus-visible:outline-none"

/**
 * `maxPoints` llega por props y no se importa de `lib/domain/scoring`, aunque la constante
 * viva allí. Ese módulo importa `prisma`: traerlo a un componente de cliente metería el
 * cliente de base de datos en el bundle del navegador por una constante numérica.
 */
export function ScoringTable({ groups, maxPoints }: { groups: ScoringGroup[]; maxPoints: number }) {
  const [valores, setValores] = useState<Record<string, { points: string; active: boolean }>>(() =>
    Object.fromEntries(
      groups.flatMap((group) => group.rows.map((row) => [row.key, { points: String(row.points), active: row.active }]))
    )
  )
  const [aviso, setAviso] = useState("")

  // Solo cuentan las reglas activas: una regla desactivada conserva su peso pero no suma,
  // así que incluirla en el total daría un máximo que ningún contacto puede alcanzar.
  const totalGeneral = Object.values(valores).reduce(
    (sum, valor) => sum + (valor.active ? Number.parseInt(valor.points, 10) || 0 : 0),
    0
  )

  return (
    <>
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {aviso}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <caption className="sr-only">
            Puntos por hito de cada visitante, agrupados. Cada fila se guarda al modificarla.
          </caption>
          <thead>
            <tr className="border-b border-border text-xs uppercase text-muted-foreground">
              <th scope="col" className="py-2.5 pr-3">Hito del visitante</th>
              <th scope="col" className="py-2.5 pr-3 w-24">Puntos</th>
              <th scope="col" className="py-2.5 pr-3 w-24">Cuenta</th>
              <th scope="col" className="py-2.5 w-10">
                <span className="sr-only">Guardado</span>
              </th>
            </tr>
          </thead>
          {groups.map((group) => {
            const subtotal = group.rows.reduce((sum, row) => {
              const valor = valores[row.key]
              if (!valor?.active) return sum
              return sum + (Number.parseInt(valor.points, 10) || 0)
            }, 0)

            return (
              <tbody key={group.title}>
                {/* Cabecera de grupo dentro de la misma tabla, y no una tabla por grupo:
                    así las columnas quedan alineadas entre grupos, que es justo lo que
                    permite comparar los pesos de uno con los de otro. */}
                <tr>
                  <th
                    colSpan={4}
                    scope="colgroup"
                    className="py-2.5 text-left text-[13px] font-semibold text-foreground"
                  >
                    {group.title}
                    <span className="ml-2 font-normal text-xs text-muted-foreground">
                      {group.hint} · suma {subtotal} pts
                    </span>
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <ScoringRowEditor
                    key={row.key}
                    row={row}
                    valor={valores[row.key] ?? { points: String(row.points), active: row.active }}
                    maxPoints={maxPoints}
                    onCambio={(siguiente) => setValores((previo) => ({ ...previo, [row.key]: siguiente }))}
                    onAviso={setAviso}
                  />
                ))}
              </tbody>
            )
          })}
          <tfoot>
            <tr>
              <th scope="row" className="py-3 pr-3 text-left text-[13px] font-semibold text-foreground">
                Máximo alcanzable con las reglas activas
              </th>
              <td className="py-3 pr-3">
                <span className="font-serif text-lg text-foreground">{totalGeneral}</span>
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  )
}

type Estado = "reposo" | "guardando" | "guardado" | "error"

function ScoringRowEditor({
  row,
  valor,
  maxPoints,
  onCambio,
  onAviso,
}: {
  row: ScoringRow
  valor: { points: string; active: boolean }
  maxPoints: number
  onCambio: (siguiente: { points: string; active: boolean }) => void
  onAviso: (mensaje: string) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [estado, setEstado] = useState<Estado>("reposo")
  const [error, setError] = useState("")

  function guardar(siguiente: { points: string; active: boolean }) {
    setEstado("guardando")
    setError("")
    startTransition(async () => {
      const result = await updateScoringRuleAction({ key: row.key, points: siguiente.points, active: siguiente.active })
      if (result.ok) {
        setEstado("guardado")
        onAviso(`«${row.label}»: ${siguiente.points} puntos, ${siguiente.active ? "activa" : "desactivada"}.`)
        router.refresh()
      } else {
        setEstado("error")
        setError(result.errors.join(" "))
        onAviso(`No se ha podido guardar «${row.label}»: ${result.errors.join(" ")}`)
      }
    })
  }

  return (
    <tr>
      <td className="py-1.5 pr-3">
        <span className="text-[13px] text-foreground">{row.label}</span>
        <span className="ml-2 font-mono text-[11px] text-muted-foreground">{row.key}</span>
        {error && (
          <p role="alert" className="mt-0.5 text-xs text-destructive">
            {error}
          </p>
        )}
      </td>
      <td className="py-1.5 pr-3">
        <input
          type="number"
          min={0}
          max={maxPoints}
          value={valor.points}
          aria-label={`Puntos por ${row.label}`}
          onChange={(event) => onCambio({ ...valor, points: event.target.value })}
          // Al salir del campo, no al teclear: escribir "25" pasa por "2", y guardar al
          // teclear grabaría ese 2 y una entrada de auditoría por él.
          onBlur={() => {
            if (valor.points !== String(row.points)) guardar(valor)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
          className={celdaInput}
        />
      </td>
      <td className="py-1.5 pr-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={valor.active}
            aria-label={`${row.label} cuenta para la puntuación`}
            onChange={(event) => {
              const siguiente = { ...valor, active: event.target.checked }
              onCambio(siguiente)
              guardar(siguiente)
            }}
            className="size-3.5"
          />
          {valor.active ? "Sí" : "No"}
        </label>
      </td>
      <td className="py-1.5 text-right">
        <SenalDeGuardado estado={isPending ? "guardando" : estado} />
      </td>
    </tr>
  )
}

function SenalDeGuardado({ estado }: { estado: Estado }) {
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
