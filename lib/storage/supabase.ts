import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export { VIP_CONTENT_BUCKET } from "@/lib/storage/bucket"

/**
 * Cliente de Supabase Storage con clave privilegiada. `server-only` impide
 * que este módulo se importe desde un componente cliente: si alguien lo
 * intenta, el build falla en vez de filtrar la clave al bundle del navegador.
 *
 * Se usa la clave privilegiada porque el bucket `vip-content` es privado y no
 * hay políticas RLS que permitan operar con la clave pública: toda subida,
 * borrado y firma de URL pasa por servidor, tras validar rol CONTENT/ADMIN
 * (ver lib/domain/content-media.ts).
 */

let cached: SupabaseClient | null = null

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Supabase Storage no está configurado (falta SUPABASE_URL o la clave privilegiada).")
    this.name = "StorageNotConfiguredError"
  }
}

function readPrivilegedKey(): string | undefined {
  // Formato nuevo (sb_secret_...) con la clave legacy service_role como
  // alternativa, en ese orden: ver .env.example y README §7.
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
}

export function isStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && readPrivilegedKey())
}

export function getStorageClient(): SupabaseClient {
  if (cached) return cached

  const url = process.env.SUPABASE_URL
  const key = readPrivilegedKey()
  if (!url || !key) throw new StorageNotConfiguredError()

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
