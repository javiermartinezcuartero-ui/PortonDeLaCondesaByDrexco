import { describe, expect, it } from "vitest"
import { REQUEST_SORTS, isRequestSortKey } from "@/lib/domain/crm-requests"
import { TASK_VIEWS, isTaskView } from "@/lib/domain/tasks"
import {
  LEAD_REQUEST_STATUS_VALUES,
  changeStatusSchema,
  createTaskSchema,
  leadNoteSchema,
  parseDateParam,
  parseEndOfDayParam,
  parseEnumParam,
  parsePageParam,
  parsePositiveIntParam,
  scoringRuleSchema,
  updateRequestSchema,
} from "@/lib/validation/crm"

describe("lectura de parámetros de URL", () => {
  it("descarta un valor de enumeración que no está en la lista blanca", () => {
    expect(parseEnumParam("CONTACT", LEAD_REQUEST_STATUS_VALUES)).toBe("CONTACT")
    expect(parseEnumParam("INVENTADO", LEAD_REQUEST_STATUS_VALUES)).toBeUndefined()
    expect(parseEnumParam(undefined, LEAD_REQUEST_STATUS_VALUES)).toBeUndefined()
  })

  it("solo acepta fechas en formato YYYY-MM-DD", () => {
    expect(parseDateParam("2027-06-12")?.toISOString()).toBe("2027-06-12T00:00:00.000Z")
    expect(parseDateParam("12/06/2027")).toBeUndefined()
    expect(parseDateParam("hoy")).toBeUndefined()
    expect(parseDateParam(undefined)).toBeUndefined()
  })

  it("el fin de rango incluye el propio día", () => {
    // Un filtro "hasta el 12" que cortara a medianoche perdería todo el día 12.
    const end = parseEndOfDayParam("2027-06-12")
    expect(end?.toISOString()).toBe("2027-06-12T23:59:59.999Z")
  })

  it("una página inválida cae a la primera en vez de romper la consulta", () => {
    expect(parsePageParam("3")).toBe(3)
    expect(parsePageParam("0")).toBe(1)
    expect(parsePageParam("-5")).toBe(1)
    expect(parsePageParam("abc")).toBe(1)
    expect(parsePageParam(undefined)).toBe(1)
  })

  it("descarta enteros fuera de rango", () => {
    expect(parsePositiveIntParam("120", 600)).toBe(120)
    expect(parsePositiveIntParam("9999", 600)).toBeUndefined()
    expect(parsePositiveIntParam("-1", 600)).toBeUndefined()
    expect(parsePositiveIntParam("muchos", 600)).toBeUndefined()
  })
})

describe("orden seguro del listado de solicitudes", () => {
  it("solo admite las claves declaradas", () => {
    for (const key of Object.keys(REQUEST_SORTS)) {
      expect(isRequestSortKey(key)).toBe(true)
    }
    expect(isRequestSortKey("lead.email")).toBe(false)
    expect(isRequestSortKey("__proto__")).toBe(false)
    expect(isRequestSortKey("constructor")).toBe(false)
  })

  it("ninguna ordenación expone una columna sensible", () => {
    const serialized = JSON.stringify(REQUEST_SORTS)
    for (const forbidden of ["password", "token", "hash", "submissionId"]) {
      expect(serialized).not.toContain(forbidden)
    }
  })
})

describe("vistas de tareas", () => {
  it("solo admite las vistas declaradas", () => {
    for (const view of TASK_VIEWS) expect(isTaskView(view)).toBe(true)
    expect(isTaskView("otras")).toBe(false)
  })
})

describe("changeStatusSchema", () => {
  it("exige el motivo al marcar como perdida", () => {
    const result = changeStatusSchema.safeParse({ requestId: "abcdefghij", nextStatus: "LOST" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "lostReason")).toBe(true)
    }
  })

  it("acepta la pérdida con motivo", () => {
    const result = changeStatusSchema.safeParse({
      requestId: "abcdefghij",
      nextStatus: "LOST",
      lostReason: "Eligió otra finca",
    })
    expect(result.success).toBe(true)
  })

  it("no exige motivo en el resto de estados", () => {
    expect(changeStatusSchema.safeParse({ requestId: "abcdefghij", nextStatus: "PRESENTATION" }).success).toBe(true)
  })

  it("rechaza un estado que no existe", () => {
    expect(changeStatusSchema.safeParse({ requestId: "abcdefghij", nextStatus: "ARCHIVADA" }).success).toBe(false)
  })
})

describe("esquemas de tareas y notas", () => {
  it("exige un título con contenido y una fecha válida", () => {
    expect(createTaskSchema.safeParse({ leadId: "abcdefghij", title: "ok", dueAt: "2027-06-12" }).success).toBe(false)
    expect(
      createTaskSchema.safeParse({ leadId: "abcdefghij", title: "Llamar al contacto", dueAt: "12-06-2027" }).success
    ).toBe(false)
    expect(
      createTaskSchema.safeParse({ leadId: "abcdefghij", title: "Llamar al contacto", dueAt: "2027-06-12" }).success
    ).toBe(true)
  })

  it("rechaza una nota vacía o solo con espacios", () => {
    expect(leadNoteSchema.safeParse({ leadId: "abcdefghij", body: "   " }).success).toBe(false)
    expect(leadNoteSchema.safeParse({ leadId: "abcdefghij", body: "Llamada de 10 minutos" }).success).toBe(true)
  })

  it("rechaza una nota por encima del límite", () => {
    expect(leadNoteSchema.safeParse({ leadId: "abcdefghij", body: "x".repeat(4_001) }).success).toBe(false)
  })
})

describe("updateRequestSchema", () => {
  it("convierte los campos vacíos en null para poder desasignar", () => {
    const result = updateRequestSchema.parse({
      requestId: "abcdefghij",
      priority: "NORMAL",
      ownerId: "",
      nextActionAt: "",
      preferredSpace: "",
      budgetRange: "",
    })
    expect(result.ownerId).toBeUndefined()
    expect(result.nextActionAt).toBeNull()
    expect(result.preferredSpace).toBeNull()
    expect(result.budgetRange).toBeNull()
  })
})

describe("scoringRuleSchema", () => {
  it("acepta el rango permitido y rechaza lo demás", () => {
    expect(scoringRuleSchema.safeParse({ key: "FORM_SUBMITTED", points: "15", active: "true" }).success).toBe(true)
    expect(scoringRuleSchema.safeParse({ key: "FORM_SUBMITTED", points: "-1", active: "true" }).success).toBe(false)
    expect(scoringRuleSchema.safeParse({ key: "FORM_SUBMITTED", points: "500", active: "true" }).success).toBe(false)
    expect(scoringRuleSchema.safeParse({ key: "FORM_SUBMITTED", points: "1.5", active: "true" }).success).toBe(false)
  })
})
