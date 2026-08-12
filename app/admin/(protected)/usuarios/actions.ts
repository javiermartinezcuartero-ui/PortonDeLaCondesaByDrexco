"use server"

import type { Role } from "@prisma/client"
import { requireRole } from "@/lib/auth/session"
import { prisma } from "@/lib/db"

const VALID_ROLES: readonly Role[] = ["ADMIN", "SALES", "CONTENT"]

/** Cambia el rol de un usuario. Solo ADMIN puede invocarla. */
export async function updateUserRoleAction(userId: string, role: string): Promise<void> {
  await requireRole(["ADMIN"])

  if (!VALID_ROLES.includes(role as Role)) {
    throw new Error("Rol inválido")
  }

  await prisma.user.update({ where: { id: userId }, data: { role: role as Role } })
}
