"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { anonymizeLeadAction } from "../privacy-actions"

/**
 * Botón "eliminar" de la lista de Captaciones.
 *
 * No hay un borrado físico del contacto: el dato ya vive repartido en solicitudes,
 * notas, auditoría y consentimientos, y borrar la fila entera destruiría ese
 * historial (ver lib/domain/privacy.ts). Lo que hace este botón es la misma
 * anonimización irreversible que ya existía en la ficha del contacto
 * (privacy-panel.tsx), solo que accesible en un clic desde la lista, sin tener que
 * entrar antes en la ficha. Por eso pide la misma confirmación escrita: es una
 * operación igual de irreversible, se invoque desde donde se invoque.
 */

const CONFIRMATION = "ANONIMIZAR"

const botonClass =
  "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-[var(--admin-hover)] hover:text-destructive disabled:opacity-40"

export function DeleteLeadButton({ leadId, name }: { leadId: string; name: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const close = () => {
    setOpen(false)
    setConfirmation("")
    setError(null)
  }

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      const result = await anonymizeLeadAction({ leadId })
      if (!result.ok) {
        setError(result.errors.join(" "))
        return
      }
      close()
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        className={botonClass}
        title={`Eliminar contacto: ${name}`}
        aria-label={`Eliminar contacto: ${name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar a {name}</DialogTitle>
            <DialogDescription>
              Sustituye su email, nombre y teléfono por valores no reversibles, vacía el texto
              libre de sus solicitudes, borra sus notas internas y revoca sus accesos. Se
              conservan los datos agregables del CRM y la auditoría, así que la fila sigue
              apareciendo en el listado, ya anonimizada.{" "}
              <strong className="text-foreground">No se puede deshacer.</strong>
            </DialogDescription>
          </DialogHeader>

          <div>
            <label
              htmlFor="confirmar-eliminar-lead"
              className="block text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
            >
              Escribe {CONFIRMATION} para confirmar
            </label>
            <input
              id="confirmar-eliminar-lead"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-1 w-full border border-border bg-transparent px-2.5 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:border-foreground"
              autoComplete="off"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={close}
              className="px-4 py-2 text-xs tracking-[0.15em] uppercase text-muted-foreground border border-border transition-colors duration-300 hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isPending || confirmation !== CONFIRMATION}
              onClick={handleDelete}
              className="px-4 py-2 text-xs tracking-[0.15em] uppercase text-destructive border border-destructive/40 transition-colors duration-300 hover:bg-destructive/10 disabled:opacity-60"
            >
              {isPending ? "Eliminando…" : "Eliminar definitivamente"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
