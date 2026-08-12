import { randomUUID } from "node:crypto"

/**
 * Genera la ruta de un objeto en el bucket privado. El nombre lo decide
 * siempre el servidor: el nombre de archivo aportado por el usuario no se usa
 * ni siquiera saneado (evita colisiones, `../`, caracteres de control, nombres
 * reservados de Windows y filtración del nombre original del archivo).
 *
 * La extensión sí se toma del resultado de `validateImage`, que la deriva de
 * un conjunto cerrado tras comprobar la firma real de bytes.
 */
export function buildStorageObjectPath(contentEntryId: string, extension: string): string {
  return `${contentEntryId}/${randomUUID()}${extension}`
}
