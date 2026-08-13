"use server"

import { requirePermission } from "@/lib/auth/session"
import { changeUserRole } from "@/lib/domain/users"

/**
 * Cambia el rol de un usuario del panel.
 *
 * La autorización usa `requirePermission("users:manage")` y no
 * `requireRole(["ADMIN"])`: la política vive en la tabla `PERMISSIONS` de
 * `lib/auth/session.ts` y este era uno de los dos sitios que la duplicaban con un
 * literal, lo que permitiría que un cambio en `PERMISSIONS` abriese la página y
 * dejase la acción cerrada (o al contrario).
 *
 * La lógica —rol válido, no cambiarse a uno mismo, no dejar el sistema sin
 * administrador, y auditar— está en `lib/domain/users.ts`. Aquí solo se autoriza y
 * se delega.
 */
export async function updateUserRoleAction(userId: string, role: string): Promise<void> {
  const actor = await requirePermission("users:manage")

  await changeUserRole({ userId, role, actorId: actor.id })
}
