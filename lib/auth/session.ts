import { headers as nextHeaders } from "next/headers"
import type { Role } from "@prisma/client"
import { auth } from "@/lib/auth"

export class UnauthenticatedError extends Error {
  constructor() {
    super("Sesión requerida")
    this.name = "UnauthenticatedError"
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("Rol no autorizado para esta operación")
    this.name = "ForbiddenError"
  }
}

export type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
}

/**
 * Permisos agrupados por área funcional. No es una abstracción genérica de
 * ACL: son exactamente las áreas descritas en el Prompt 3 (CRM/CMS/usuarios),
 * cada una con la lista fija de roles a los que aplica.
 */
const PERMISSIONS = {
  "users:manage": ["ADMIN"],
  "crm:access": ["ADMIN", "SALES"],
  "cms:access": ["ADMIN", "CONTENT"],
} as const satisfies Record<string, readonly Role[]>

export type Permission = keyof typeof PERMISSIONS

async function resolveHeaders(providedHeaders?: Headers): Promise<Headers> {
  if (providedHeaders) return providedHeaders
  // Sin argumento: se asume una llamada desde un Server Component, layout o
  // Server Action dentro del scope de una petición real de Next.js.
  return await nextHeaders()
}

/** Devuelve el usuario de la sesión actual, o `null` si no hay sesión. */
export async function getSessionUser(providedHeaders?: Headers): Promise<SessionUser | null> {
  const headers = await resolveHeaders(providedHeaders)
  const result = await auth.api.getSession({ headers })
  if (!result) return null
  return result.user as unknown as SessionUser
}

/** Exige una sesión válida. Lanza `UnauthenticatedError` si no existe. */
export async function requireSession(providedHeaders?: Headers): Promise<SessionUser> {
  const user = await getSessionUser(providedHeaders)
  if (!user) throw new UnauthenticatedError()
  return user
}

/** Exige sesión y uno de los roles indicados. Lanza `ForbiddenError` si no coincide. */
export async function requireRole(roles: readonly Role[], providedHeaders?: Headers): Promise<SessionUser> {
  const user = await requireSession(providedHeaders)
  if (!roles.includes(user.role)) throw new ForbiddenError()
  return user
}

/** Exige sesión y el permiso indicado (ver `PERMISSIONS`). */
export async function requirePermission(permission: Permission, providedHeaders?: Headers): Promise<SessionUser> {
  return requireRole(PERMISSIONS[permission], providedHeaders)
}
