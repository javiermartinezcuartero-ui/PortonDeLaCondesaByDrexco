import { z } from "zod"

/**
 * Contrato de la solicitud comercial pública (`POST /api/leads/requests`).
 *
 * Este módulo es **compartido entre cliente y servidor** a propósito: el
 * formulario valida con el mismo esquema que el endpoint, así el visitante ve
 * los errores al momento y el servidor no se fía de ello. Solo contiene lo que
 * es seguro exponer al navegador: vocabulario cerrado, límites y reglas de
 * forma. Todo lo que dependa de secretos o de base de datos (versión de política
 * vigente, rate limit, existencia de la ficha de origen) se comprueba únicamente
 * en servidor.
 *
 * Decisión de diseño: el esquema **solo valida, no transforma** (salvo recortar
 * espacios, que no cambia el tipo). Así los tipos de entrada y salida coinciden y
 * el mismo esquema sirve para `react-hook-form` sin acrobacias de genéricos. La
 * conversión a los tipos del dominio —cadena vacía a `undefined`, invitados a
 * entero, fecha a `Date`— es un paso explícito y posterior:
 * `normalizeLeadRequest`.
 */

// ---------------------------------------------------------------------------
// Contrato de respuesta
// ---------------------------------------------------------------------------

/**
 * Códigos de error en lugar de textos: el servidor no decide el idioma. El
 * formulario los traduce al idioma activo (ver components/sections/contact.tsx),
 * igual que hace el gate VIP.
 */
export type LeadRequestErrorCode =
  | "invalid-payload"
  | "policy-version-mismatch"
  | "too-fast"
  | "rate-limited"
  | "payload-too-large"
  | "persistence-failed"
  | "invalid-request"

export type LeadRequestResponse =
  | { ok: true; duplicate: boolean }
  | {
      ok: false
      code: LeadRequestErrorCode
      /** Solo en `invalid-payload`: nombres de campo con problemas, sin valores. */
      fields?: string[]
      retryAfterSeconds?: number
      /**
       * Identificador de la petición, solo cuando falla por causa del servidor.
       * Permite que alguien diga "me falló con este código" y se pueda encontrar la
       * traza, sin que el mensaje cuente nada sobre el fallo ni sobre la persona.
       */
      requestId?: string
    }

// ---------------------------------------------------------------------------
// Vocabulario cerrado
// ---------------------------------------------------------------------------

/**
 * Tipos de evento como **código estable**, no como etiqueta traducida: el CRM
 * tiene que poder agrupar "Boda" y "Wedding" en la misma categoría. El orden de
 * esta lista es el orden del desplegable; las etiquetas visibles viven en
 * `data/site-content.ts` / `data/site-content.en.ts`.
 */
export const EVENT_TYPES = [
  "WEDDING",
  "CIVIL_CEREMONY",
  "COMMUNION",
  "CHRISTENING",
  "ANNIVERSARY",
  "CORPORATE_EVENT",
  "CONGRESS",
  "EXTERNAL_CATERING",
  "OTHER",
] as const

export type EventTypeCode = (typeof EVENT_TYPES)[number]

export function isEventTypeCode(value: string): value is EventTypeCode {
  return (EVENT_TYPES as readonly string[]).includes(value)
}

/** Eventos que activan los campos de empresa, cargo y necesidades audiovisuales. */
export const CORPORATE_EVENT_TYPES: readonly EventTypeCode[] = ["CORPORATE_EVENT", "CONGRESS"]

export function isCorporateEventType(eventType: string): boolean {
  return (CORPORATE_EVENT_TYPES as readonly string[]).includes(eventType)
}

/** Opción explícita de "me da igual el espacio": es una respuesta válida, no un hueco. */
export const NO_SPACE_PREFERENCE = "sin-preferencia"

/**
 * Espacios seleccionables, por el mismo slug con el que la web los publica en
 * `data/site-content.ts`. No se importa esa lista desde aquí para no invertir
 * las capas (la validación no debe depender del contenido de presentación); a
 * cambio, `lead-request.test.ts` comprueba que ambas no se desvíen.
 */
export const PREFERRED_SPACES: readonly string[] = [
  "salon-porton",
  "salon-zafiro",
  "salon-cristal",
  "salon-conde",
  NO_SPACE_PREFERENCE,
]

/**
 * Horquillas de presupuesto para cualificar la solicitud.
 *
 * TODO(negocio): los tramos son una propuesta de trabajo, no tarifas de la
 * finca. Pendiente de confirmación del cliente antes de producción (anotado en
 * README §Limitaciones conocidas). El campo es opcional y `por-definir` permite enviar la
 * solicitud sin comprometerse a ninguno.
 */
export const BUDGET_RANGES = ["hasta-10000", "10000-20000", "20000-35000", "mas-35000", "por-definir"] as const

export type BudgetRangeCode = (typeof BUDGET_RANGES)[number]

/**
 * Formularios que pueden emitir una solicitud. Enum cerrado para que la
 * atribución del CRM no se llene de valores libres inventados por el cliente.
 */
export const SOURCE_FORMS = ["contact-home", "vip-story-cta"] as const

export type SourceFormCode = (typeof SOURCE_FORMS)[number]

// ---------------------------------------------------------------------------
// Límites documentados
// ---------------------------------------------------------------------------

/** Tope de invitados. No es la capacidad de la finca: es un límite anti-abuso. */
export const MAX_GUEST_COUNT = 600

/** Antigüedad máxima admitida en la fecha del evento: se acepta hoy, no ayer. */
export const MAX_EVENT_DATE_YEARS_AHEAD = 5

/**
 * Tiempo mínimo entre que el formulario se pinta y se envía. Un bot rellena y
 * envía en milisegundos; una persona no. No es una defensa criptográfica (el
 * valor lo manda el cliente y es falsificable), es un filtro de automatismos
 * ingenuos que se suma al honeypot y al rate limit.
 */
export const MIN_FORM_FILL_MS = 3_000

export const FIELD_LIMITS = {
  name: 120,
  email: 320,
  phone: 32,
  company: 160,
  jobTitle: 120,
  audiovisualNeeds: 1_000,
  subject: 160,
  message: 4_000,
  /** Rutas, referrer y UTMs: cadenas de atribución, no texto libre del usuario. */
  attribution: 300,
  submissionId: 64,
  contentId: 64,
} as const

/** Tamaño máximo del cuerpo JSON aceptado por el endpoint. */
export const MAX_REQUEST_BODY_BYTES = 32 * 1024

// ---------------------------------------------------------------------------
// Piezas reutilizables
// ---------------------------------------------------------------------------

/**
 * Texto opcional. Se admite la cadena vacía porque es lo que envía un input que
 * la persona no rellenó; `normalizeLeadRequest` la convierte en `undefined` para
 * que la base de datos guarde NULL y no una cadena vacía.
 */
const optionalText = (max: number) => z.string().trim().max(max).optional()

const attributionText = optionalText(FIELD_LIMITS.attribution)

/** Al menos un carácter que no sea de control (C0/C1) ni espacio en blanco. */
const PRINTABLE = /[^\p{Cc}\s]/u

/**
 * Un campo obligatorio de texto.
 *
 * `.min(1)` sobre el valor recortado no basta: el `.trim()` de JavaScript solo
 * quita espacio en blanco, y los caracteres de control (C0/C1) no lo son. Un valor
 * como `""` medía 2, pasaba el esquema, y el servidor lo dejaba en `""`
 * al limpiar los caracteres de control antes de persistir —así que un campo
 * declarado obligatorio acababa guardado vacío—. Se exige al menos un carácter
 * imprimible para que el rechazo ocurra en el borde, con un 400, en lugar de
 * convertirse en un dato vacío tres capas más abajo.
 */
const requiredText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => PRINTABLE.test(value), "debe contener al menos un carácter visible")

/** Ruta interna: se guarda como origen y nunca se usa para redirigir. */
const internalPath = z
  .string()
  .trim()
  .min(1)
  .max(FIELD_LIMITS.attribution)
  .refine((value) => value.startsWith("/") && !value.startsWith("//"), "sourcePage debe ser una ruta interna")

/**
 * Teléfono flexible pero limitado: se admiten prefijos, espacios, puntos,
 * guiones y paréntesis porque la gente los escribe de mil formas, pero se exige
 * un mínimo de dígitos reales para descartar basura. La normalización a E.164 la
 * hace el dominio (`lib/domain/normalize.ts`), no este esquema: el valor tal como
 * lo escribió la persona se conserva.
 */
const phoneField = optionalText(FIELD_LIMITS.phone)
  .refine((value) => !value || /^[+()\d\s.\-]+$/.test(value), "El teléfono contiene caracteres no válidos")
  .refine((value) => !value || value.replace(/\D/g, "").length >= 6, "El teléfono es demasiado corto")

/** Fecha `YYYY-MM-DD` que no esté evidentemente en el pasado. */
const eventDateField = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), "Formato de fecha no válido")
  .refine((value) => !value || isPlausibleEventDate(value), "La fecha del evento no es válida")

/**
 * Invitados. Llega como cadena desde un `<input type="number">` (vacío = `""`) y
 * como número desde cualquier otro consumidor de la API; se aceptan ambos.
 */
const guestCountField = z
  .union([z.string().trim(), z.number()])
  .optional()
  .refine((value) => isValidGuestCount(value), `El número de invitados debe ser un entero entre 1 y ${MAX_GUEST_COUNT}`)

export function isPlausibleEventDate(value: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  // Mediodía UTC: el día no se desplaza al convertir a hora local.
  const parsed = new Date(`${value}T12:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return false
  // Rechaza fechas imposibles que `Date` "corrige" sola (p. ej. 2027-02-31).
  if (parsed.toISOString().slice(0, 10) !== value) return false

  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  if (parsed.getTime() < todayStart) return false

  return parsed.getUTCFullYear() <= now.getUTCFullYear() + MAX_EVENT_DATE_YEARS_AHEAD
}

export function isValidGuestCount(value: string | number | undefined): boolean {
  if (value === undefined || value === "") return true
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_GUEST_COUNT
}

// ---------------------------------------------------------------------------
// Esquema del formulario (lo que escribe la persona)
// ---------------------------------------------------------------------------

const formShape = {
  // --- Contacto ---
  firstName: requiredText(FIELD_LIMITS.name),
  lastName: requiredText(FIELD_LIMITS.name),
  email: z.string().trim().min(1).max(FIELD_LIMITS.email).email(),
  phone: phoneField,

  // --- Solicitud ---
  // El `: boolean` es deliberado. Sin él, TypeScript infiere un type predicate
  // (5.5+) y Zod estrecha la salida a `EventTypeCode`, pero el formulario parte
  // de cadena vacía y necesita que el tipo siga siendo `string`.
  eventType: z.string().refine((value): boolean => isEventTypeCode(value), "Tipo de evento no válido"),
  eventDate: eventDateField,
  guestCount: guestCountField,
  company: optionalText(FIELD_LIMITS.company),
  jobTitle: optionalText(FIELD_LIMITS.jobTitle),
  audiovisualNeeds: optionalText(FIELD_LIMITS.audiovisualNeeds),
  preferredSpace: z.string().trim().refine((value) => PREFERRED_SPACES.includes(value), "Espacio no válido"),
  budgetRange: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || (BUDGET_RANGES as readonly string[]).includes(value), "Presupuesto no válido"),
  subject: requiredText(FIELD_LIMITS.subject),
  message: requiredText(FIELD_LIMITS.message),

  // --- Consentimientos ---
  /** Obligatorio: sin base legal no se guarda nada. */
  privacyConsent: z.boolean().refine((value) => value === true, "Debes aceptar la política de privacidad"),
  /** Separado del anterior, opcional y desmarcado de origen. */
  marketingConsent: z.boolean().optional(),

  /**
   * Honeypot: una persona nunca lo rellena. **No se valida como vacío a
   * propósito**: si el esquema lo rechazara, el endpoint devolvería un 400 y le
   * diría al bot que existe. Se acepta y es el endpoint quien decide (respuesta
   * genérica de éxito sin guardar nada).
   */
  honeypot: optionalText(FIELD_LIMITS.attribution),
}

/** Regla condicional de eventos corporativos, común a cliente y servidor. */
const corporateRule = (
  values: { eventType: string; company?: string },
  ctx: z.RefinementCtx
) => {
  // En un evento corporativo la empresa es el dato que permite cualificar la
  // solicitud; cargo y necesidades audiovisuales se ofrecen pero no se exigen
  // (ver README §Gate de acceso y captación para el criterio).
  if (isCorporateEventType(values.eventType) && !values.company) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["company"],
      message: "Indica la empresa u organización",
    })
  }
}

/**
 * Esquema que usa el formulario. Mismas reglas que el endpoint, sin transporte, con
 * tres diferencias que son de **pantalla** y no de dominio:
 *
 * - `firstName` y `lastName` se cambian por un único `fullName`. El titular pidió un
 *   solo campo de nombre; el CRM sigue guardando los dos por separado, porque ordena,
 *   busca y saluda con ellos. `splitFullName` es quien los separa al enviar, y por eso
 *   `fullName` exige dos palabras: con una sola no habría apellido, y rellenarlo con
 *   un guion o repitiendo el nombre sería meter basura en la ficha del cliente.
 * - `preferredSpace` pasa a opcional: se retiró de la pantalla, y quien no lo
 *   pregunta envía `NO_SPACE_PREFERENCE` —«sin preferencia, aconsejadme»—, que es
 *   exactamente lo que significa. El endpoint lo sigue exigiendo.
 * - `budgetRange` también sale de la pantalla; ya era opcional, así que deja de
 *   enviarse sin más.
 * - `subject` pasa a opcional. Se retiró el campo de la pantalla —dos cajas de texto
 *   seguidas para decir una sola cosa—, pero **no del dominio**: el panel ordena y
 *   lee las solicitudes por su asunto, y dejarlo en blanco llenaría el CRM de fichas
 *   indistinguibles. Sigue siendo opcional aquí en lugar de desaparecer porque el CTA
 *   de las fichas VIP lo rellena por debajo («Quiero una boda así»), y ese dato es la
 *   mejor descripción posible de la solicitud. Cuando no llega, el formulario lo
 *   deriva del tipo de evento antes de enviar.
 *
 * **El contrato del endpoint no se toca.** `leadRequestSchema` sigue construido sobre
 * `formShape` con nombre y apellidos separados, y el espacio y el asunto obligatorios:
 * la simplificación vive en el formulario, no en la API.
 */
export const leadRequestFormSchema = z
  .object(formShape)
  .omit({ firstName: true, lastName: true, preferredSpace: true, subject: true })
  .extend({
    fullName: requiredText(FIELD_LIMITS.name * 2).refine(
      (value) => value.trim().split(/\s+/).length >= 2,
      "Escribe tu nombre y tus apellidos"
    ),
    preferredSpace: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || PREFERRED_SPACES.includes(value), "Espacio no válido"),
    subject: optionalText(FIELD_LIMITS.subject),
  })
  .superRefine(corporateRule)

export type LeadRequestFormValues = z.infer<typeof leadRequestFormSchema>

/**
 * Parte «Ana María Pérez Gómez» en nombre y apellidos.
 *
 * La primera palabra es el nombre y el resto los apellidos. Es una convención, no una
 * verdad: hay nombres compuestos («Ana María») que quedarán partidos. Se acepta a
 * conciencia porque la alternativa —adivinar dónde acaba un nombre compuesto— falla
 * más y de forma menos predecible, y porque en el panel ambos campos son editables:
 * quien atienda la solicitud lo corrige en dos segundos si hace falta.
 *
 * El esquema garantiza que hay al menos dos palabras, así que `lastName` nunca sale
 * vacío por esta vía.
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  }
}

// ---------------------------------------------------------------------------
// Esquema completo del endpoint (formulario + transporte y atribución)
// ---------------------------------------------------------------------------

export const leadRequestSchema = z
  .object({
    ...formShape,

    /** Versión de la política aceptada. El servidor la compara con la vigente. */
    policyVersion: z.string().trim().min(1).max(32),

    // --- Atribución ---
    sourcePage: internalPath,
    sourceForm: z.string().refine((value) => (SOURCE_FORMS as readonly string[]).includes(value), "Origen no válido"),
    sourceContentId: optionalText(FIELD_LIMITS.contentId),
    referrer: attributionText,
    utmSource: attributionText,
    utmMedium: attributionText,
    utmCampaign: attributionText,
    utmContent: attributionText,
    utmTerm: attributionText,

    // --- Antispam / idempotencia ---
    /** Milisegundos que la persona tardó en enviar. Ver `MIN_FORM_FILL_MS`. */
    formElapsedMs: z.number().int().nonnegative().optional(),
    /** Clave de idempotencia generada por el formulario en cada envío. */
    submissionId: z.string().trim().min(8).max(FIELD_LIMITS.submissionId),
  })
  .superRefine(corporateRule)

export type LeadRequestValues = z.infer<typeof leadRequestSchema>

// ---------------------------------------------------------------------------
// Normalización a los tipos del dominio
// ---------------------------------------------------------------------------

export type NormalizedLeadRequest = {
  firstName: string
  lastName: string
  email: string
  phone?: string
  eventType: string
  eventDate?: Date
  guestCount?: number
  company?: string
  jobTitle?: string
  audiovisualNeeds?: string
  preferredSpace: string
  budgetRange?: string
  subject: string
  message: string
  marketingConsent: boolean
  policyVersion: string
  sourcePage: string
  sourceForm: string
  sourceContentId?: string
  referrer?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  submissionId: string
}

/** Cadena vacía a `undefined`: NULL en base de datos, no `''`. */
const orUndefined = (value: string | undefined): string | undefined => (value ? value : undefined)

/**
 * Convierte un payload ya validado a los tipos que espera el dominio.
 *
 * Aquí se descartan también los campos que solo tienen sentido en un evento
 * corporativo cuando el evento no lo es: si alguien escribe la empresa y luego
 * cambia el desplegable, ese dato residual no debe llegar al CRM.
 */
export function normalizeLeadRequest(values: LeadRequestValues): NormalizedLeadRequest {
  const corporate = isCorporateEventType(values.eventType)

  return {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    phone: orUndefined(values.phone),
    eventType: values.eventType,
    eventDate: values.eventDate ? new Date(`${values.eventDate}T12:00:00.000Z`) : undefined,
    guestCount:
      values.guestCount === undefined || values.guestCount === ""
        ? undefined
        : Number(values.guestCount),
    company: corporate ? orUndefined(values.company) : undefined,
    jobTitle: corporate ? orUndefined(values.jobTitle) : undefined,
    audiovisualNeeds: corporate ? orUndefined(values.audiovisualNeeds) : undefined,
    preferredSpace: values.preferredSpace,
    budgetRange: orUndefined(values.budgetRange),
    subject: values.subject,
    message: values.message,
    marketingConsent: values.marketingConsent === true,
    policyVersion: values.policyVersion,
    sourcePage: values.sourcePage,
    sourceForm: values.sourceForm,
    sourceContentId: orUndefined(values.sourceContentId),
    referrer: orUndefined(values.referrer),
    utmSource: orUndefined(values.utmSource),
    utmMedium: orUndefined(values.utmMedium),
    utmCampaign: orUndefined(values.utmCampaign),
    utmContent: orUndefined(values.utmContent),
    utmTerm: orUndefined(values.utmTerm),
    submissionId: values.submissionId,
  }
}
