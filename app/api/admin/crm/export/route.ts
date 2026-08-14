import { NextResponse } from "next/server"
import type { InteractionType } from "@prisma/client"
import { ForbiddenError, UnauthenticatedError, requirePermission } from "@/lib/auth/session"
import { exportLeadsTable, exportRequestsTable, type ExportTable } from "@/lib/domain/crm-export"
import { buildWorkbook } from "@/lib/domain/crm-workbook"
import { REQUEST_SORTS, type RequestSortKey } from "@/lib/domain/crm-requests"
import {
  LEAD_REQUEST_STATUS_VALUES,
  PRIORITY_VALUES,
  parseDateParam,
  parseEndOfDayParam,
  parseEnumParam,
  parsePositiveIntParam,
} from "@/lib/validation/crm"

/**
 * Descarga en Excel (`.xlsx`) de contactos y solicitudes.
 *
 * Antes se servía un CSV. El cambio a Excel lo pidió el titular; qué aporta —tipos
 * reales en las celdas y el fin de la inyección de fórmulas— está en
 * `lib/domain/crm-workbook.ts`.
 *
 * Es un Route Handler y no una Server Action porque tiene que devolver un archivo con
 * sus cabeceras, no un valor a un componente.
 *
 * Tres cosas que lo protegen:
 *
 * - **`crm:export` = solo ADMIN.** Un archivo con datos personales sobrevive a
 *   cualquier control de acceso posterior: quien puede consultar el CRM no puede
 *   necesariamente sacárselo.
 * - **Los mismos filtros que la pantalla.** Se parsean con los mismos validadores
 *   que el listado, así que lo que se descarga es exactamente lo que se veía.
 * - **`no-store`.** Un archivo con PII no se queda en ninguna caché intermedia.
 */

export const dynamic = "force-dynamic"

const INTERACTION_VALUES: InteractionType[] = ["GATE_GRANTED", "SECTION_VIEWED", "CONTENT_VIEWED", "CTA_CLICKED"]

/** Tipo MIME de un `.xlsx`. Es largo, y escribirlo mal hace que el navegador lo trate como binario anónimo. */
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

function fileName(prefix: string): string {
  // Sin `Date.now()` en el nombre para que sea estable dentro del mismo día y no
  // llene la carpeta de descargas de variantes idénticas.
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.xlsx`
}

export async function GET(request: Request) {
  try {
    // Las cabeceras se pasan explícitamente: un Route Handler ya tiene la
    // petición en la mano y no necesita el almacenamiento asíncrono de Next
    // (que además no existe fuera de una petición real, como en los tests).
    const user = await requirePermission("crm:export", request.headers)

    const url = new URL(request.url)
    const params = url.searchParams
    const dataset = params.get("conjunto")

    let table: ExportTable
    let name: string
    let sheet: string

    if (dataset === "contactos") {
      table = await exportLeadsTable(
        {
          search: params.get("q") ?? undefined,
          source: params.get("origen") ?? undefined,
          tag: params.get("etiqueta") ?? undefined,
          minScore: parsePositiveIntParam(params.get("score") ?? undefined, 1_000),
          interaction: parseEnumParam(params.get("interaccion") ?? undefined, INTERACTION_VALUES),
          marketingConsent:
            params.get("marketing") === "si" ? true : params.get("marketing") === "no" ? false : undefined,
          from: parseDateParam(params.get("desde") ?? undefined),
          to: parseEndOfDayParam(params.get("hasta") ?? undefined),
        },
        {
          actorId: user.id,
          // Las notas internas solo salen si se piden explícitamente en la URL, y
          // la decisión queda registrada en el AuditEvent de la exportación.
          includeNotes: params.get("notas") === "si",
        }
      )
      name = fileName("contactos")
      sheet = "Contactos"
    } else if (dataset === "solicitudes") {
      const sortKeys = Object.keys(REQUEST_SORTS) as RequestSortKey[]
      table = await exportRequestsTable(
        {
          search: params.get("q") ?? undefined,
          status: parseEnumParam(params.get("estado") ?? undefined, LEAD_REQUEST_STATUS_VALUES),
          priority: parseEnumParam(params.get("prioridad") ?? undefined, PRIORITY_VALUES),
          eventType: params.get("tipo") ?? undefined,
          preferredSpace: params.get("espacio") ?? undefined,
          ownerId:
            params.get("responsable") && params.get("responsable") !== "sin-asignar"
              ? (params.get("responsable") as string)
              : undefined,
          unassigned: params.get("responsable") === "sin-asignar",
          utmSource: params.get("origen") ?? undefined,
          utmCampaign: params.get("campana") ?? undefined,
          sourceContentId: params.get("ficha") ?? undefined,
          minGuests: parsePositiveIntParam(params.get("minInvitados") ?? undefined, 10_000),
          maxGuests: parsePositiveIntParam(params.get("maxInvitados") ?? undefined, 10_000),
          from: parseDateParam(params.get("desde") ?? undefined),
          to: parseEndOfDayParam(params.get("hasta") ?? undefined),
          sort: parseEnumParam(params.get("orden") ?? undefined, sortKeys) ?? "recientes",
        },
        { actorId: user.id }
      )
      name = fileName("solicitudes")
      sheet = "Solicitudes"
    } else {
      return NextResponse.json({ error: "Conjunto no válido. Usa conjunto=contactos o conjunto=solicitudes." }, { status: 400 })
    }

    const workbook = await buildWorkbook(sheet, table.headers, table.rows)

    // `Uint8Array` y no el `Buffer` tal cual: es lo que espera el cuerpo de una
    // respuesta web estándar, y evita depender de que el runtime tenga Buffer.
    return new NextResponse(new Uint8Array(workbook), {
      status: 200,
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(workbook.byteLength),
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
    throw error
  }
}
