import { budgetRangeLabels, eventTypeLabels, spacesContent } from "@/data/site-content"
import { NO_SPACE_PREFERENCE, isEventTypeCode } from "@/lib/validation/lead-request"
import type {
  ActivityType,
  FollowUpStatus,
  InteractionType,
  LeadLifecycle,
  LeadRequestStatus,
  Priority,
} from "@prisma/client"

/**
 * Etiquetas en español del panel. El panel es monolingüe a propósito: lo usa el
 * equipo de la finca, no visitantes, y mantener dos idiomas de la interfaz
 * interna sería trabajo sin destinatario.
 *
 * Los códigos de negocio (tipo de evento, espacio, presupuesto) se traducen
 * reutilizando la capa de contenido pública, para que el CRM y la web no puedan
 * llamar a la misma cosa de dos maneras distintas.
 */

export const REQUEST_STATUS_LABEL: Record<LeadRequestStatus, string> = {
  CONTACT: "Contacto",
  PRESENTATION: "Presentación",
  PROPOSAL: "Propuesta",
  CLIENT: "Cliente",
  LOST: "Perdida",
}

/**
 * Vocabulario de las nueve fases anteriores.
 *
 * No es código muerto: el historial de cada contacto y la auditoría guardan la
 * transición tal como se anotó en su día —`{from: "CONTACTED", to: "QUALIFIED"}`—, y
 * esos registros **no se reescriben** en la migración a cinco fases, porque reescribir
 * una pista de auditoría es falsearla. Sin este mapa, un movimiento antiguo se
 * mostraría con el código en crudo.
 */
const LEGACY_STATUS_LABEL: Record<string, string> = {
  NEW: "Nueva",
  CONTACTED: "Contactada",
  QUALIFIED: "Cualificada",
  VISIT_SCHEDULED: "Visita agendada",
  PROPOSAL_SENT: "Propuesta enviada",
  NEGOTIATION: "En negociación",
  WON: "Ganada",
  NURTURING: "En seguimiento",
}

/** Orden de las columnas del tablero: el recorrido comercial de izquierda a derecha. */
export const PIPELINE_COLUMN_ORDER: LeadRequestStatus[] = [
  "CONTACT",
  "PRESENTATION",
  "PROPOSAL",
  "CLIENT",
  "LOST",
]

/**
 * Tono de cada fase, tipo semáforo. Vive aquí y no en el tablero porque ahora lo usan
 * tres pantallas —tablero, listado de solicitudes y gráficas de los informes— y dos
 * copias del mismo criterio de color acaban discrepando.
 */
export const PIPELINE_TONE: Record<LeadRequestStatus, "gris" | "azul" | "ambar" | "verde" | "rojo"> = {
  CONTACT: "gris",
  PRESENTATION: "azul",
  PROPOSAL: "ambar",
  CLIENT: "verde",
  LOST: "rojo",
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: "Baja",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
}

export const LIFECYCLE_LABEL: Record<LeadLifecycle, string> = {
  ACTIVE: "Activo",
  UNSUBSCRIBED: "Baja",
  ANONYMIZED: "Anonimizado",
}

export const TASK_STATUS_LABEL: Record<FollowUpStatus, string> = {
  PENDING: "Pendiente",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
}

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  FORM_SUBMITTED: "Formulario enviado",
  VIP_ACCESSED: "Acceso VIP concedido",
  DOSSIER_DOWNLOADED: "Dossier descargado",
  EMAIL_SENT: "Email enviado",
  EMAIL_OPENED: "Email abierto",
  LINK_CLICKED: "Enlace pulsado",
  CALL: "Llamada",
  WHATSAPP: "WhatsApp",
  NOTE: "Anotación",
  STATUS_CHANGED: "Cambio de estado",
  VISIT: "Visita",
  PROPOSAL: "Propuesta",
}

export const INTERACTION_LABEL: Record<InteractionType, string> = {
  GATE_GRANTED: "Acceso concedido",
  SECTION_VIEWED: "Biblioteca consultada",
  CONTENT_VIEWED: "Ficha consultada",
  CTA_CLICKED: "CTA pulsado",
}

/**
 * Agrupación de las reglas de puntuación para la pantalla de Puntuación Visitantes.
 *
 * Es presentación, no dominio: `lib/domain/scoring.ts` no necesita saber que los hitos se
 * enseñan en tres bloques. Vive aquí, con el resto de las etiquetas, y la pantalla trata
 * como «Otros» cualquier clave que aparezca en la base de datos y no esté listada —así una
 * regla nueva se ve aunque nadie haya venido a clasificarla, en vez de desaparecer—.
 */
export const SCORING_GROUPS: Array<{ title: string; hint: string; keys: string[] }> = [
  {
    title: "Lo que cuenta en el formulario",
    hint: "Datos que la persona entrega al pedir información",
    keys: ["FORM_SUBMITTED", "PHONE_PROVIDED", "EVENT_DATE_PROVIDED", "GUEST_COUNT_PROVIDED"],
  },
  {
    title: "Lo que hace en las bibliotecas",
    hint: "Interés demostrado navegando por bodas reales y catering",
    keys: ["VIP_ACCESS", "CONTENT_VIEWED_3PLUS", "DOSSIER_DOWNLOAD"],
  },
  {
    title: "Lo que pide expresamente",
    hint: "Señales de intención registradas por el equipo",
    keys: ["VISIT_REQUESTED"],
  },
]

export const SECTION_LABEL = {
  REAL_WEDDING: "Bodas reales",
  CATERING_EVENT: "Catering",
} as const

const SPACE_LABEL: Record<string, string> = {
  ...Object.fromEntries(spacesContent.map((space) => [space.slug, space.name])),
  [NO_SPACE_PREFERENCE]: "Sin preferencia",
}

/**
 * Traduce un código guardado a su etiqueta. Si el valor no está en el
 * vocabulario, **se muestra tal cual** en vez de un "—": puede venir de una
 * solicitud antigua o de un dato importado, y ocultarlo sería peor que verlo.
 */
export function eventTypeLabel(code: string): string {
  return isEventTypeCode(code) ? eventTypeLabels[code] : code
}

export function spaceLabel(code: string | null): string | null {
  if (!code) return null
  return SPACE_LABEL[code] ?? code
}

export function budgetLabel(code: string | null): string | null {
  if (!code) return null
  return (budgetRangeLabels as Record<string, string>)[code] ?? code
}

export function requestStatusLabel(code: string): string {
  return REQUEST_STATUS_LABEL[code as LeadRequestStatus] ?? LEGACY_STATUS_LABEL[code] ?? code
}

/**
 * Lee la transición de estado de la metadata de una actividad.
 *
 * La metadata es JSON sin tipar (pasa por `sanitizeMetadata` antes de guardarse),
 * así que se comprueba su forma en vez de confiar en ella: si no trae `from` y
 * `to` como cadenas, no hay transición que mostrar y devuelve `null`.
 */
export function statusTransitionLabel(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null
  const record = metadata as Record<string, unknown>
  const from = typeof record.from === "string" ? record.from : null
  const to = typeof record.to === "string" ? record.to : null
  if (!from || !to) return null
  return `${requestStatusLabel(from)} → ${requestStatusLabel(to)}`
}

/** Etiqueta legible de las anotaciones internas (`metadata.accion`). */
const ACTION_LABEL: Record<string, string> = {
  asignacion: "Cambio de responsable",
  archivada: "Solicitud archivada",
  "tarea-creada": "Tarea creada",
  "tarea-reasignada": "Tarea reasignada",
  "tarea-completada": "Tarea completada",
  "tarea-cancelada": "Tarea cancelada",
}

export function activityActionLabel(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null
  const action = (metadata as Record<string, unknown>).accion
  if (typeof action !== "string") return null
  return ACTION_LABEL[action] ?? action
}

export function leadName(lead: { firstName: string | null; lastName: string | null; email: string }): string {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ")
  return name || lead.email
}

/** Fecha corta para tablas. */
export function formatDate(value: Date | null | undefined): string {
  if (!value) return "—"
  return value.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function formatDateTime(value: Date | null | undefined): string {
  if (!value) return "—"
  return value.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Valor de un `<input type="date">` a partir de una fecha. */
export function toDateInputValue(value: Date | null | undefined): string {
  if (!value) return ""
  return value.toISOString().slice(0, 10)
}
