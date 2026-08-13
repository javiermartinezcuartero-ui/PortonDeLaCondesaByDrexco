import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { ERROR_CODES, logError, resolveRequestId } from "@/lib/observability/log"

/**
 * Healthcheck para el balanceador o el monitor externo.
 *
 * Lo que **no** devuelve, y por qué:
 *
 * - **Ni versiones ni dependencias.** Un healthcheck que anuncia "Next 16.0.10,
 *   Prisma 6.19.3" es un catálogo gratis de vulnerabilidades conocidas para quien
 *   lo lea. Tampoco el commit ni el entorno.
 * - **Ni secretos ni configuración.** No se lista qué variables hay puestas: saber
 *   que SendGrid está configurado ya es información sobre el sistema.
 * - **Ni excepciones internas.** Si la base de datos no responde, la respuesta es un
 *   503 con un código operativo estable. El motivo real va al log del servidor con
 *   su `requestId`, no al cuerpo.
 *
 * Lo que sí hace: una consulta mínima para distinguir "el proceso vive" de "el
 * proceso vive y llega a su base de datos", que es la diferencia que le importa a un
 * monitor. Un healthcheck que solo devuelve 200 sin comprobar nada da falsa calma.
 */

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const requestId = resolveRequestId(request.headers)

  try {
    // Consulta trivial y sin datos: solo prueba que la conexión responde.
    await prisma.$queryRaw`SELECT 1`
  } catch (error) {
    logError("health.database_unreachable", { code: ERROR_CODES.persistence, requestId, error })

    return NextResponse.json(
      { status: "unhealthy", code: ERROR_CODES.persistence, requestId },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }

  return NextResponse.json({ status: "ok" }, { status: 200, headers: { "Cache-Control": "no-store" } })
}
