import { getSessionUser } from "@/lib/auth/session"
import { prisma } from "@/lib/db"
import { UsersTable } from "./users-table"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage() {
  const user = await getSessionUser()

  if (user?.role !== "ADMIN") {
    return (
      <div className="max-w-md space-y-2">
        <h1 className="font-serif text-2xl font-light text-foreground">Acceso no autorizado</h1>
        <p className="text-muted-foreground">Esta sección solo está disponible para el rol ADMIN.</p>
      </div>
    )
  }

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
