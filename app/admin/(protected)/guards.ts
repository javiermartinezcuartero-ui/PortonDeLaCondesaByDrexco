import { notFound, redirect } from "next/navigation"
import {
  ForbiddenError,
  UnauthenticatedError,
  requirePermission,
  type Permission,
  type SessionUser,
} from "@/lib/auth/session"

/**
 * Guardas de página del panel.
 *
 * `requirePermission` lanza, y una excepción sin capturar en un Server Component
 * acaba en una página de error 500. Eso protege, pero informa mal: un 500 sugiere
 * que algo se ha roto. Estas guardas traducen el fallo a la respuesta correcta:
 *
 * - **sin sesión** → redirección al login, que es lo que la persona necesita;
 * - **con sesión y sin permiso** → 404, no un 403. Un 403 confirma que el
 *   apartado existe; un 404 no dice nada. Es coherente con ocultar el enlace en
 *   la navegación: para quien no tiene permiso, ese apartado no existe.
 *
 * Esto es la autorización real de cada página, no un adorno: se ejecuta en
 * servidor antes de cualquier consulta.
 */
async function guard(permission: Permission): Promise<SessionUser> {
  try {
    return await requirePermission(permission)
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/admin/login")
    if (error instanceof ForbiddenError) notFound()
    throw error
  }
}

/** CRM comercial: ADMIN y SALES. */
export function requireCrmAccess(): Promise<SessionUser> {
  return guard("crm:access")
}

/** Contenido de las bibliotecas VIP: ADMIN y CONTENT. */
export function requireCmsAccess(): Promise<SessionUser> {
  return guard("cms:access")
}

/** Configuración del CRM: solo ADMIN. */
export function requireSettingsAccess(): Promise<SessionUser> {
  return guard("settings:manage")
}

/** Alta y cambio de rol de usuarios del panel: solo ADMIN. */
export function requireUsersAccess(): Promise<SessionUser> {
  return guard("users:manage")
}
