"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ContentStatus } from "@prisma/client"
import {
  archiveContentEntryAction,
  duplicateContentEntryAction,
  publishContentEntryAction,
  unpublishContentEntryAction,
} from "./actions"

const actionClass =
  "text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors duration-300 disabled:opacity-50"

/**
 * Acciones por fila. No existe "eliminar": una ficha publicada no se borra
 * físicamente desde la UI (requisito de la Fase 4); el camino es despublicar
 * y archivar, que conserva la trazabilidad.
 */
export function ContentRowActions({
  id,
  status,
  title,
}: {
  id: string
  status: ContentStatus
  title: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const run = (operation: () => Promise<{ ok: boolean; errors?: string[] }>) => {
    setError(null)
    startTransition(async () => {
      const result = await operation()
      if (!result.ok) {
        setError(result.errors?.join(" ") ?? "No se ha podido completar la operación.")
        return
      }
      router.refresh()
    })
  }

  const confirmArchive = () => {
    // Archivar retira la ficha de las secciones públicas: se confirma antes.
    if (!window.confirm(`¿Archivar "${title}"? Dejará de estar disponible en la web pública.`)) return
    run(() => archiveContentEntryAction(id))
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        <Link href={`/admin/contenidos/${id}`} className={actionClass}>
          Editar
        </Link>
        <Link href={`/admin/contenidos/${id}/preview`} className={actionClass}>
          Previsualizar
        </Link>
        <button type="button" className={actionClass} disabled={isPending} onClick={() => run(() => duplicateContentEntryAction(id))}>
          Duplicar
        </button>
        {status === "PUBLISHED" ? (
          <button
            type="button"
            className={actionClass}
            disabled={isPending}
            onClick={() => run(() => unpublishContentEntryAction(id))}
          >
            Despublicar
          </button>
        ) : (
          <button
            type="button"
            className={actionClass}
            disabled={isPending}
            onClick={() => run(() => publishContentEntryAction(id))}
          >
            Publicar
          </button>
        )}
        {status !== "ARCHIVED" && (
          <button type="button" className={actionClass} disabled={isPending} onClick={confirmArchive}>
            Archivar
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="max-w-[280px] text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
