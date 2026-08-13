import { prisma } from "@/lib/db"
import { requireUsersAccess } from "../guards"
import { UsersTable } from "./users-table"

export const dynamic = "force-dynamic"

/**
 * Era la única página del panel que comprobaba el rol a mano y devolvía un 200
 * con el mensaje "Acceso no autorizado". Autorizaba bien —nunca llegaba a
 * consultar los usuarios—, pero se apartaba de la guarda compartida en dos
 * cosas: confirmaba con un 200 que el apartado existe, y era el único sitio
 * donde una comprobación de rol podía quedarse desincronizada de `PERMISSIONS`.
 * Ahora usa `requireUsersAccess()` como el resto (404 para quien no es ADMIN).
 * Lo destapó la prueba E2E del escenario 11.
 */
export default async function AdminUsersPage() {
  await requireUsersAccess()

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true },
  })

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-serif text-3xl font-light text-foreground">Usuarios</h1>
      <UsersTable users={users} />
    </div>
  )
}
