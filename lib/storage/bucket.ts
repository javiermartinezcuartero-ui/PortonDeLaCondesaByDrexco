/**
 * Configuración del bucket de media del CMS. Vive aparte de
 * `lib/storage/supabase.ts` (que es `server-only`) porque estas constantes las
 * necesitan también el script de provisión (`scripts/ensure-storage-bucket.ts`)
 * y los tests, que no corren dentro del bundler de Next.
 *
 * No contiene ninguna credencial.
 */
export const VIP_CONTENT_BUCKET = "vip-content"

/** Debe coincidir con MAX_IMAGE_BYTES (lib/storage/validate-image.ts): 10 MB. */
export const BUCKET_FILE_SIZE_LIMIT = 10 * 1024 * 1024

export const BUCKET_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
