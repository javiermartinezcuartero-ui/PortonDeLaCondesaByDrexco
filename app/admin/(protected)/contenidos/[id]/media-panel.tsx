"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { ALLOWED_IMAGE_EXTENSIONS, MAX_IMAGE_BYTES } from "@/lib/storage/validate-image"
import type { EditorMedia } from "./content-editor"

type ActionOutcome = { ok: boolean; errors?: string[] }
type UploadOutcome = { ok: true; data: { media: EditorMedia } } | { ok: false; errors: string[] }

const labelClass = "text-xs tracking-[0.2em] uppercase text-muted-foreground"
const smallButtonClass =
  "text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors duration-300 disabled:opacity-50"

const MAX_MB = Math.round(MAX_IMAGE_BYTES / 1024 / 1024)

/**
 * Gestión de la media de una ficha. Subir y borrar son operaciones inmediatas
 * (tocan Supabase Storage, no pueden esperar al "Guardar"); el orden, el alt y
 * cuál es la hero se guardan con el resto del formulario.
 */
export function MediaPanel({
  contentEntryId,
  media,
  storageConfigured,
  onChange,
  onUpload,
  onDelete,
}: {
  contentEntryId: string
  media: EditorMedia[]
  storageConfigured: boolean
  onChange: (media: EditorMedia[]) => void
  onUpload: (formData: FormData) => Promise<UploadOutcome>
  onDelete: (mediaId: string) => Promise<ActionOutcome>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setErrors([])

    const formData = new FormData()
    formData.set("contentEntryId", contentEntryId)
    formData.set("file", file)

    startTransition(async () => {
      const result = await onUpload(formData)
      if (fileInputRef.current) fileInputRef.current.value = ""
      if (!result.ok) {
        setErrors(result.errors ?? ["No se ha podido subir el archivo."])
        return
      }

      // El archivo se añade a la lista con lo que devuelve la acción, **no** se
      // espera a que el refresco lo traiga: el editor guarda la ficha en estado
      // de cliente inicializado una sola vez, así que un `router.refresh()` no
      // repuebla esta lista y el archivo no se veía hasta recargar la página.
      // El refresco se mantiene además para que los avisos de "falta para
      // publicar", que sí se calculan en servidor, queden al día.
      onChange([...media, result.data.media])
      router.refresh()
    })
  }

  const handleDelete = (item: EditorMedia) => {
    if (!window.confirm("¿Quitar este archivo de la ficha?")) return
    setErrors([])
    startTransition(async () => {
      const result = await onDelete(item.id)
      if (!result.ok) {
        setErrors(result.errors ?? ["No se ha podido borrar el archivo."])
        return
      }
      // Mismo motivo que en la subida: se quita de la lista aquí.
      onChange(media.filter((current) => current.id !== item.id))
      router.refresh()
    })
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= media.length) return
    const next = [...media]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const setHero = (id: string) => {
    // Solo una hero: marcar una desmarca el resto.
    onChange(media.map((item) => ({ ...item, isHero: item.id === id })))
  }

  const updateItem = (index: number, patch: Partial<EditorMedia>) => {
    const next = [...media]
    next[index] = { ...next[index], ...patch }
    onChange(next)
  }

  return (
    <div className="space-y-5">
      {!storageConfigured && (
        <p className="border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
          Supabase Storage no está configurado en este entorno: no se pueden subir ni borrar archivos. El resto del
          editor funciona con normalidad.
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="media-upload" className={labelClass}>
          Subir imagen
        </label>
        <Input
          id="media-upload"
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_IMAGE_EXTENSIONS.join(",")}
          disabled={isPending || !storageConfigured}
          onChange={handleUpload}
        />
        <p className="text-xs text-muted-foreground">
          {ALLOWED_IMAGE_EXTENSIONS.join(", ")} · máximo {MAX_MB} MB por imagen. Se valida el contenido real del
          archivo en servidor, no solo su extensión.
        </p>
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm text-destructive">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      {media.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay archivos en esta ficha.</p>
      ) : (
        <ul className="space-y-3">
          {media.map((item, index) => {
            const preview = item.thumbnailUrl ?? item.previewUrl
            return (
              <li key={item.id} className="flex flex-wrap gap-4 border border-border p-3">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden bg-secondary">
                  {preview ? (
                    // Imagen dentro del panel privado: es una URL firmada
                    // temporal (o externa), no un asset del proyecto, así que
                    // no pasa por next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      Sin vista
                    </span>
                  )}
                </div>

                <div className="min-w-[240px] flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="uppercase tracking-[0.15em]">#{index + 1}</span>
                    <span>{item.type === "IMAGE" ? "Imagen" : item.type === "REEL" ? "Reel" : "Vídeo"}</span>
                    {item.isExternal && <span>Externa</span>}
                    {item.dimensions && <span>{item.dimensions}</span>}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor={`media-alt-${item.id}`} className={labelClass}>
                      Texto alternativo (alt)
                    </label>
                    <Input
                      id={`media-alt-${item.id}`}
                      value={item.alt}
                      onChange={(event) => updateItem(index, { alt: event.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor={`media-caption-${item.id}`} className={labelClass}>
                      Pie de foto
                    </label>
                    <Input
                      id={`media-caption-${item.id}`}
                      value={item.caption}
                      onChange={(event) => updateItem(index, { caption: event.target.value })}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <label className="flex items-center gap-2 text-xs text-foreground">
                      <input
                        type="radio"
                        name="hero-media"
                        checked={item.isHero}
                        onChange={() => setHero(item.id)}
                      />
                      Imagen principal
                    </label>
                    <label className="flex items-center gap-2 text-xs text-foreground">
                      <input
                        type="checkbox"
                        checked={item.inGallery}
                        onChange={(event) => updateItem(index, { inGallery: event.target.checked })}
                      />
                      En la galería
                    </label>
                    <button type="button" className={smallButtonClass} onClick={() => move(index, -1)} disabled={index === 0}>
                      Subir
                    </button>
                    <button
                      type="button"
                      className={smallButtonClass}
                      onClick={() => move(index, 1)}
                      disabled={index === media.length - 1}
                    >
                      Bajar
                    </button>
                    <button type="button" className={smallButtonClass} onClick={() => handleDelete(item)} disabled={isPending}>
                      Quitar
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
