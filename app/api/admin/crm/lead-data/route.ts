import { NextResponse } from "next/server"
import { ForbiddenError, UnauthenticatedError, requirePermission } from "@/lib/auth/session"
import { DomainError } from "@/lib/domain/errors"
import { exportLeadPersonalData } from "@/lib/domain/privacy"

/**
 * Copia de los datos personales de **un** contacto, en JSON.
 *
 * Es el derecho de acceso del RGPD, y por eso es un endpoint distinto de la
 * exportación comercial (`/api/admin/crm/export`): esa saca columnas de muchos
 * contactos para trabajar el CRM; esta saca **todo** lo que consta de una persona,
 * incluidas sus notas internas, para poder entregárselo.
 *
 * Solo ADMIN (`crm:export`). Cada llamada deja un `AuditEvent`: si alguien pide una
 * copia de los datos de una persona, tiene que quedar registrado quién y cuándo.
 */

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const user = await requirePermission("crm:export", request.headers)

    const leadId = new URL(request.url).searchParams.get("lead")?.trim()
    if (!leadId) {
      return NextResponse.json({ error: "Falta el parámetro lead" }, { status: 400 })
    }

    const data = await exportLeadPersonalData(leadId, user.id)

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="datos-contacto-${leadId}.json"`,
        // Un archivo con datos personales no se queda en ninguna caché.
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    throw error
  }
}
