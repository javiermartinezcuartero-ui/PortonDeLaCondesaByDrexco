import { z } from "zod"
import { NOTE_MAX_LENGTH } from "@/lib/domain/notes"
import { MAX_RULE_POINTS } from "@/lib/domain/scoring"

/**
 * Validación de las mutaciones del CRM. Se aplica **en servidor**, dentro de cada
 * Server Action, antes de tocar el dominio. Los formularios del panel envían
 * `FormData`, así que estos esquemas parten de cadenas y las convierten.
 */

const LEAD_REQUEST_STATUSES = ["CONTACT", "PRESENTATION", "PROPOSAL", "CLIENT", "LOST"] as const

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const

export const cuidLike = z.string().trim().min(8).max(64)

/** Cadena vacía a `undefined`: un campo que no se rellenó no es una cadena vacía. */
const optionalId = z
  .string()
  .trim()
  .max(64)
  .optional()
  .transform((value) => (value ? value : undefined))

/** Fecha `YYYY-MM-DD` de un `<input type="date">`, a mediodía UTC. */
const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha no válido")
  .transform((value) => new Date(`${value}T12:00:00.000Z`))
  .refine((value) => !Number.isNaN(value.getTime()), "Fecha no válida")

const optionalDateOnly = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || /^\d{4}-\d{2}-\d{2}$/.test(value), "Formato de fecha no válido")
  .transform((value) => (value === undefined ? null : new Date(`${value}T12:00:00.000Z`)))
  .refine((value) => value === null || !Number.isNaN(value.getTime()), "Fecha no válida")

// ---------------------------------------------------------------------------
// Notas
// ---------------------------------------------------------------------------

export const leadNoteSchema = z.object({
  leadId: cuidLike,
  body: z.string().trim().min(1, "La nota no puede estar vacía").max(NOTE_MAX_LENGTH),
})

export const updateLeadNoteSchema = z.object({
  noteId: cuidLike,
  body: z.string().trim().min(1, "La nota no puede estar vacía").max(NOTE_MAX_LENGTH),
})

// ---------------------------------------------------------------------------
// Tareas
// ---------------------------------------------------------------------------

export const createTaskSchema = z.object({
  leadId: cuidLike,
  leadRequestId: optionalId,
  title: z.string().trim().min(3, "Describe la tarea").max(200),
  dueAt: dateOnly,
  assigneeId: optionalId,
  priority: z.enum(PRIORITIES).default("NORMAL"),
})

export const updateTaskSchema = z.object({
  taskId: cuidLike,
  title: z.string().trim().min(3, "Describe la tarea").max(200),
  dueAt: dateOnly,
  assigneeId: optionalId,
  priority: z.enum(PRIORITIES),
})

export const taskIdSchema = z.object({ taskId: cuidLike })

// ---------------------------------------------------------------------------
// Solicitudes
// ---------------------------------------------------------------------------

export const changeStatusSchema = z
  .object({
    requestId: cuidLike,
    nextStatus: z.enum(LEAD_REQUEST_STATUSES),
    lostReason: z.string().trim().max(500).optional(),
  })
  .superRefine((values, ctx) => {
    // Marcar una solicitud como perdida sin decir por qué destruye la única
    // información útil de esa pérdida. El dominio lo vuelve a exigir.
    if (values.nextStatus === "LOST" && !values.lostReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lostReason"],
        message: "Indica el motivo de la pérdida",
      })
    }
  })

export const updateRequestSchema = z.object({
  requestId: cuidLike,
  priority: z.enum(PRIORITIES),
  ownerId: optionalId,
  nextActionAt: optionalDateOnly,
  preferredSpace: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value ? value : null)),
  budgetRange: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((value) => (value ? value : null)),
})

export const requestIdSchema = z.object({ requestId: cuidLike })

// ---------------------------------------------------------------------------
// Configuración de scoring
// ---------------------------------------------------------------------------

export const scoringRuleSchema = z.object({
  key: z.string().trim().min(1).max(64),
  points: z.coerce.number().int().min(0).max(MAX_RULE_POINTS),
  active: z.coerce.boolean(),
})

// ---------------------------------------------------------------------------
// Lectura de parámetros de URL (filtros)
// ---------------------------------------------------------------------------

/**
 * Los filtros viven en la URL para que una vista filtrada se pueda compartir y
 * marcar. Eso significa que llegan de fuera, así que cada uno pasa por una lista
 * blanca: lo que no reconoce el parseador se ignora en silencio en vez de llegar
 * a la consulta.
 */
export function parseEnumParam<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  if (!value) return undefined
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined
}

export function parseDateParam(value: string | undefined): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

/** Fin de día para que un rango "hasta el 12" incluya el propio día 12. */
export function parseEndOfDayParam(value: string | undefined): Date | undefined {
  const parsed = parseDateParam(value)
  if (!parsed) return undefined
  return new Date(parsed.getTime() + 24 * 60 * 60 * 1000 - 1)
}

export function parsePageParam(value: string | undefined): number {
  const page = Number.parseInt(value ?? "1", 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

export function parsePositiveIntParam(value: string | undefined, max = 1_000_000): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) return undefined
  return parsed
}

export const LEAD_REQUEST_STATUS_VALUES = LEAD_REQUEST_STATUSES
export const PRIORITY_VALUES = PRIORITIES
