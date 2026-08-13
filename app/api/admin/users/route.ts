import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { ForbiddenError, UnauthenticatedError, requirePermission } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

/**
 * Lista de usuarios internos. Exige `users:manage` (hoy, solo ADMIN).
 *
 * Se autoriza con `requirePermission` y no con `requireRole(["ADMIN"])`: la
 * política vive en `PERMISSIONS` y duplicarla con un literal aquí era la vía a que
 * un cambio en la tabla dejase la página y el endpoint diciendo cosas distintas.
 *
 * `no-store` explícito: la respuesta lleva el nombre, el correo y el rol de todo el
 * personal interno. El middleware que fija esa cabecera solo cubre `/admin` y sus
 * subrutas (`matcher` de middleware.ts), no `/api`, así que aquí hay que ponerla a
 * mano — como ya hacían los otros dos endpoints del panel.
 */
export async function GET(request: Request) {
  try {
    await requirePermission("users:manage", request.headers)
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }
    throw error
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })

  return NextResponse.json({ users }, { headers: { "Cache-Control": "no-store" } })
}
