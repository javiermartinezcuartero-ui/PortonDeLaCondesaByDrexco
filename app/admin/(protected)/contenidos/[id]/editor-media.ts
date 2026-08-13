import type { ContentMedia } from "@prisma/client"

/**
 * Forma de un archivo tal y como lo maneja el editor.
 *
 * Vive aquí, y no dentro del componente de cliente, porque hacen falta en tres
 * sitios que no pueden importarse entre sí: la página que carga la ficha, la
 * acción de servidor que sube un archivo nuevo y el propio editor. Antes solo lo
 * construía la página, y eso dejaba a la acción devolviendo un `{ id }` suelto
 * que el editor no sabía colocar.
 */
export type EditorMedia = {
  id: string
  type: ContentMedia["type"]
  /** URL firmada temporal del objeto privado. Null si Storage no está configurado. */
  previewUrl: string | null
  thumbnailUrl: string | null
  alt: string
  caption: string
  sortOrder: number
  isHero: boolean
  inGallery: boolean
  isExternal: boolean
  dimensions: string | null
}

/**
 * Convierte una fila `ContentMedia` en lo que el editor necesita.
 *
 * Una sola función para los dos caminos —cargar la ficha y subir un archivo— para
 * que un archivo recién subido se vea exactamente igual que los que ya estaban.
 */
export function toEditorMedia(item: ContentMedia, previewUrl: string | null): EditorMedia {
  return {
    id: item.id,
    type: item.type,
    previewUrl,
    thumbnailUrl: item.thumbnailUrl,
    alt: item.alt ?? "",
    caption: item.caption ?? "",
    sortOrder: item.sortOrder,
    isHero: item.isHero,
    inGallery: item.inGallery,
    isExternal: !item.storagePath,
    dimensions: item.width && item.height ? `${item.width}×${item.height}` : null,
  }
}
