/**
 * Provisiona el bucket privado de media del CMS. Idempotente: si ya existe, no
 * lo modifica ni falla.
 *
 * Uso: npm run storage:bootstrap
 *
 * No importa `lib/storage/supabase.ts` porque ese módulo es `server-only` (solo
 * se resuelve dentro del bundler de Next). Aquí se crea el cliente con la misma
 * precedencia de claves que allí, para no divergir.
 */
import { createClient } from "@supabase/supabase-js"
import {
  BUCKET_ALLOWED_MIME_TYPES,
  BUCKET_FILE_SIZE_LIMIT,
  VIP_CONTENT_BUCKET,
} from "@/lib/storage/bucket"

// A diferencia de scripts/admin-bootstrap.ts (que carga .env indirectamente al
// inicializar Prisma), aquí no hay nada que lo haga: se carga explícitamente.
try {
  process.loadEnvFile()
} catch {
  // Sin .env: se avisa más abajo al comprobar las variables.
}

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error("Faltan SUPABASE_URL o la clave privilegiada (SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY).")
    process.exitCode = 1
    return
  }

  const storage = createClient(url, key, { auth: { persistSession: false } }).storage

  const { data: buckets, error: listError } = await storage.listBuckets()
  if (listError) throw listError

  const existing = buckets.find((bucket) => bucket.name === VIP_CONTENT_BUCKET)
  if (existing) {
    console.log(`El bucket "${VIP_CONTENT_BUCKET}" ya existe (público: ${existing.public}).`)

    // Un bucket creado a mano en el panel de Supabase no trae límites. Se
    // reconcilian aquí: endurecer los límites siempre es seguro, y son la
    // segunda barrera detrás de la validación de aplicación
    // (lib/storage/validate-image.ts).
    const needsSizeLimit = existing.file_size_limit !== BUCKET_FILE_SIZE_LIMIT
    const needsMimeLimit =
      !existing.allowed_mime_types ||
      BUCKET_ALLOWED_MIME_TYPES.some((mime) => !existing.allowed_mime_types?.includes(mime)) ||
      existing.allowed_mime_types.length !== BUCKET_ALLOWED_MIME_TYPES.length

    if (existing.public) {
      console.warn("ATENCIÓN: el bucket es público. Debería ser privado; cámbialo en el panel de Supabase.")
    }

    if (needsSizeLimit || needsMimeLimit) {
      const { error: updateError } = await storage.updateBucket(VIP_CONTENT_BUCKET, {
        public: false,
        fileSizeLimit: BUCKET_FILE_SIZE_LIMIT,
        allowedMimeTypes: [...BUCKET_ALLOWED_MIME_TYPES],
      })
      if (updateError) throw updateError
      console.log(
        `Límites reconciliados: privado, ${Math.round(BUCKET_FILE_SIZE_LIMIT / 1024 / 1024)} MB por archivo, ${BUCKET_ALLOWED_MIME_TYPES.join("/")}.`
      )
    } else {
      console.log("Sus límites ya son los correctos; no se modifica nada.")
    }
    return
  }

  const { error } = await storage.createBucket(VIP_CONTENT_BUCKET, {
    public: false,
    fileSizeLimit: BUCKET_FILE_SIZE_LIMIT,
    allowedMimeTypes: [...BUCKET_ALLOWED_MIME_TYPES],
  })
  if (error) throw error

  console.log(
    `Bucket "${VIP_CONTENT_BUCKET}" creado: privado, ${Math.round(BUCKET_FILE_SIZE_LIMIT / 1024 / 1024)} MB por archivo, ${BUCKET_ALLOWED_MIME_TYPES.join("/")}.`
  )
}

main().catch((error) => {
  console.error("No se ha podido provisionar el bucket:", error)
  process.exitCode = 1
})
