import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createLeadRequest } from "@/lib/domain/lead-requests"
import { runAfterResponse } from "@/lib/notifications/after-response"
import { notifyNewLeadRequest } from "@/lib/notifications/lead-request-notification"
import { PRIVACY_POLICY_VERSION } from "@/lib/legal"
import { clientIdentifierFromHeaders, consumeRateLimit, pruneExpiredRateLimits } from "@/lib/security/rate-limit"
import { stripControlCharacters } from "@/lib/security/text"
import { ERROR_CODES, logError, resolveRequestId } from "@/lib/observability/log"
import {
  MAX_REQUEST_BODY_BYTES,
  MIN_FORM_FILL_MS,
  leadRequestSchema,
  normalizeLeadRequest,
  type LeadRequestErrorCode,
  type LeadRequestResponse,
} from "@/lib/validation/lead-request"

/**
 * Alta de una solicitud comercial desde los formularios públicos.
 *
 * Sustituye al envío directo del navegador a Web3Forms: ahora todo pasa por
 * aquí, y la interfaz nunca habla con Prisma. El orden de las comprobaciones es
 * deliberado —lo barato y lo que no toca la base de datos, primero— para que un
 * bot no consuma consultas:
 *
 *  1. mismo origen;                      6. honeypot (aceptación silenciosa);
 *  2. tipo de contenido;                 7. tiempo mínimo de formulario;
 *  3. tamaño del cuerpo;                 8. rate limit por IP y por email;
 *  4. JSON válido y esquema compartido;  9. verificación de la ficha de origen;
 *  5. versión de la política vigente;   10. transacción y aviso posterior.
 */

export const dynamic = "force-dynamic"

/** 5 envíos cada 15 minutos por IP. */
const IP_RATE_LIMIT = { windowSeconds: 900, max: 5 }
/** 3 envíos por hora y email: la misma persona no necesita más. */
const EMAIL_RATE_LIMIT = { windowSeconds: 3_600, max: 3 }

function fail(
  code: LeadRequestErrorCode,
  status: number,
  extra?: { fields?: string[]; retryAfterSeconds?: number; requestId?: string }
): NextResponse<LeadRequestResponse> {
  return NextResponse.json({ ok: false, code, ...extra }, { status })
}

/**
 * Rechaza peticiones de otro origen. Si no llega cabecera `Origin` no se
 * bloquea: las peticiones servidor-a-servidor legítimas (y `curl`) no la envían,
 * y este endpoint no depende de cookies, así que no hay sesión de la que un
 * tercero pueda aprovecharse.
 */
function isForeignOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return false

  const host = request.headers.get("host")
  if (!host) return true

  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

export async function POST(request: Request): Promise<NextResponse<LeadRequestResponse>> {
  const requestId = resolveRequestId(request.headers)

  if (isForeignOrigin(request)) return fail("invalid-request", 403)

  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) return fail("invalid-request", 415)

  const declaredLength = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    return fail("payload-too-large", 413)
  }

  const raw = await request.text()
  // El `content-length` puede faltar o mentir (transferencia troceada): el
  // tamaño real se vuelve a medir sobre el cuerpo ya leído.
  if (Buffer.byteLength(raw, "utf8") > MAX_REQUEST_BODY_BYTES) return fail("payload-too-large", 413)

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return fail("invalid-payload", 400)
  }

  const parsed = leadRequestSchema.safeParse(payload)
  if (!parsed.success) {
    // Solo los nombres de campo: ni valores recibidos ni detalles internos.
    const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "payload")))]
    return fail("invalid-payload", 400, { fields })
  }

  // La versión de la política la fija el servidor: si el navegador tenía la
  // página abierta desde antes de un cambio de política, el consentimiento que
  // enviaría no es el del texto vigente y hay que recargar.
  if (parsed.data.policyVersion !== PRIVACY_POLICY_VERSION) {
    return fail("policy-version-mismatch", 409)
  }

  // Honeypot relleno: se responde como si todo hubiera ido bien y no se guarda
  // nada. Un bot no aprende qué le delató y no consume base de datos.
  if (parsed.data.honeypot) {
    return NextResponse.json({ ok: true, duplicate: false }, { status: 202 })
  }

  // Tiempo mínimo de formulario. Se responde con un error recuperable en vez de
  // descartar en silencio: una persona que va muy rápido reenvía y pasa, porque
  // el contador sigue corriendo desde que se pintó el formulario.
  if (parsed.data.formElapsedMs !== undefined && parsed.data.formElapsedMs < MIN_FORM_FILL_MS) {
    return fail("too-fast", 400)
  }

  const values = normalizeLeadRequest(parsed.data)

  const ipLimit = await consumeRateLimit("lead-request-ip", clientIdentifierFromHeaders(request.headers), IP_RATE_LIMIT)
  if (!ipLimit.allowed) {
    return fail("rate-limited", 429, { retryAfterSeconds: ipLimit.retryAfterSeconds })
  }

  const emailLimit = await consumeRateLimit("lead-request-email", values.email.toLowerCase(), EMAIL_RATE_LIMIT)
  if (!emailLimit.allowed) {
    return fail("rate-limited", 429, { retryAfterSeconds: emailLimit.retryAfterSeconds })
  }

  // La ficha de origen se comprueba contra contenido publicado. Si no cuadra, la
  // solicitud se guarda igual sin atribución de ficha: perder el origen es
  // preferible a perder el lead.
  const sourceContentId = await resolvePublishedContentId(values.sourceContentId)

  try {
    const { lead, leadRequest, duplicate } = await createLeadRequest({
      email: values.email,
      firstName: stripControlCharacters(values.firstName),
      lastName: stripControlCharacters(values.lastName),
      phone: values.phone,
      eventType: values.eventType,
      eventDate: values.eventDate,
      guestCount: values.guestCount,
      company: stripControlCharacters(values.company),
      jobTitle: stripControlCharacters(values.jobTitle),
      audiovisualNeeds: stripControlCharacters(values.audiovisualNeeds),
      preferredSpace: values.preferredSpace,
      budgetRange: values.budgetRange,
      subject: stripControlCharacters(values.subject),
      message: stripControlCharacters(values.message),
      sourcePage: values.sourcePage,
      sourceForm: values.sourceForm,
      sourceContentId,
      referrer: values.referrer,
      utmSource: values.utmSource,
      utmMedium: values.utmMedium,
      utmCampaign: values.utmCampaign,
      utmContent: values.utmContent,
      utmTerm: values.utmTerm,
      submissionId: values.submissionId,
      consents: {
        privacyConsent: true,
        marketingConsent: values.marketingConsent,
        policyVersion: values.policyVersion,
      },
    })

    // Avisos por correo: **después** del commit y después de responder. `after()`
    // mantiene viva la invocación hasta que el envío termina sin retrasar la
    // respuesta al visitante (ver lib/notifications/after-response.ts). Que no
    // haya proveedor configurado, o que falle, no cambia lo ya guardado ni lo que
    // ve quien envió el formulario.
    if (!duplicate) runAfterResponse(() => notifyNewLeadRequest(lead, leadRequest))

    void pruneExpiredRateLimits()

    return NextResponse.json({ ok: true, duplicate }, { status: duplicate ? 200 : 201 })
  } catch (error) {
    // No se filtra el motivo real: podría describir el esquema de la base de
    // datos. El detalle va al log estructurado del servidor —sin stack, sin cuerpo
    // y sin datos personales— junto al `requestId` que sí se devuelve, para poder
    // cruzar una queja concreta con su traza.
    logError("leads.persistence_failed", {
      code: ERROR_CODES.persistence,
      requestId,
      sourceForm: values.sourceForm,
      error,
    })
    return fail("persistence-failed", 503, { requestId })
  }
}

async function resolvePublishedContentId(candidate: string | undefined): Promise<string | undefined> {
  if (!candidate) return undefined

  const entry = await prisma.contentEntry
    .findFirst({ where: { id: candidate, status: "PUBLISHED" }, select: { id: true } })
    .catch(() => null)

  return entry?.id
}
