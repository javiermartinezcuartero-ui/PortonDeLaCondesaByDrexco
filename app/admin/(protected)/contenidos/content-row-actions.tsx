"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Archive, Copy, Eye, EyeOff, Globe, Pencil } from "lucide-react"
import type { ContentStatus } from "@prisma/client"
import {
  archiveContentEntryAction,
  duplicateContentEntryAction,
  publishContentEntryAction,
  unpublishContentEntryAction,
} from "./actions"

/**
 * Acciones por fila, **solo con iconos**.
 *
 * Eran cinco enlaces de texto en mayúsculas por fila: con seis fichas, treinta palabras
 * apiladas en la última columna, que era la columna más ancha de la tabla. En iconos ocupan
 * una fila de 24 px y la tabla vuelve a ser legible, que es lo que se pidió.
 *
 * **Un icono sin nombre accesible no es un botón, es un adorno.** Cada uno lleva dos cosas
 * distintas y las dos hacen falta:
 *
 * - `title`: la sugerencia que el navegador muestra al parar el ratón encima. Es el
 *   «tooltip» pedido, y se usa el nativo en vez de uno propio a propósito: un tooltip hecho
 *   a mano tiene que resolver el posicionamiento en el borde de la pantalla, el retardo, el
 *   cierre al salir y el equivalente para teclado, y aquí no aporta nada que el del
 *   navegador no dé ya.
 * - `aria-label`: el nombre que lee un lector de pantalla. No se hereda del `title` de forma
 *   fiable en todos los lectores, así que se escribe.
 *
 * Los dos incluyen el título de la ficha —«Editar Boda de Ana y Luis»— porque en una tabla
 * de seis filas hay seis botones «Editar», y sin el título son indistinguibles al navegar
 * por controles.
 *
 * Lo que sigue sin existir es **eliminar**: una ficha publicada no se borra desde la
 * interfaz (requisito de la Fase 4); el camino es despublicar y archivar, que conserva la
 * trazabilidad.
 */

const botonClass =
  "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-[var(--admin-hover)] hover:text-foreground disabled:opacity-40"

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
    <div className="space-y-1">
      <div className="flex items-center gap-0.5">
        <Link href={`/admin/contenidos/${id}`} className={botonClass} title={`Editar ${title}`} aria-label={`Editar ${title}`}>
          <Pencil className="size-4" aria-hidden />
        </Link>
        <Link
          href={`/admin/contenidos/${id}/preview`}
          className={botonClass}
          title={`Previsualizar ${title}`}
          aria-label={`Previsualizar ${title}`}
        >
          <Eye className="size-4" aria-hidden />
        </Link>
        <button
          type="button"
          className={botonClass}
          disabled={isPending}
          title={`Duplicar ${title}`}
          aria-label={`Duplicar ${title}`}
          onClick={() => run(() => duplicateContentEntryAction(id))}
        >
          <Copy className="size-4" aria-hidden />
        </button>
        {status === "PUBLISHED" ? (
          <button
            type="button"
            className={botonClass}
            disabled={isPending}
            title={`Despublicar ${title}`}
            aria-label={`Despublicar ${title}`}
            onClick={() => run(() => unpublishContentEntryAction(id))}
          >
            <EyeOff className="size-4" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            className={botonClass}
            disabled={isPending}
            title={`Publicar ${title}`}
            aria-label={`Publicar ${title}`}
            onClick={() => run(() => publishContentEntryAction(id))}
          >
            <Globe className="size-4" aria-hidden />
          </button>
        )}
        {status !== "ARCHIVED" && (
          <button
            type="button"
            className={botonClass}
            disabled={isPending}
            title={`Archivar ${title}`}
            aria-label={`Archivar ${title}`}
            onClick={confirmArchive}
          >
            <Archive className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="max-w-[240px] text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
