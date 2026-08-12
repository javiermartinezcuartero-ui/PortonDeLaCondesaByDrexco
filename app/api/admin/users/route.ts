import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { ForbiddenError, UnauthenticatedError, requireRole } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

/** Lista de usuarios internos. Solo ADMIN. Ver PRUEBAS del Prompt 3. */
export async function GET(request: Request) {
  try {
    await requireRole(["ADMIN"], request.headers)
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

  return NextResponse.json({ users })
}
