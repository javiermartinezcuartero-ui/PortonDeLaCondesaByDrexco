import { prisma } from "@/lib/db"
import { normalizeEmail, normalizePhone } from "@/lib/domain/normalize"
import type { Lead } from "@prisma/client"
import type { Prisma, PrismaClient } from "@prisma/client"

type Db = PrismaClient | Prisma.TransactionClient

export type GetOrCreateLeadInput = {
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  source?: string
}

/**
 * Obtiene el Lead por email normalizado o lo crea si no existe, dentro de
 * una transacción. Es seguro ante peticiones concurrentes con el mismo email:
 * `emailNormalized` es único y el upsert se resuelve de forma atómica en la
 * base de datos (INSERT ... ON CONFLICT), nunca crea dos filas para el mismo
 * email aunque dos peticiones lleguen al mismo tiempo.
 */
export async function getOrCreateLead(input: GetOrCreateLeadInput, db: Db = prisma): Promise<Lead> {
  const emailNormalized = normalizeEmail(input.email)
  const phoneNormalized = input.phone ? normalizePhone(input.phone) : undefined

  return db.lead.upsert({
    where: { emailNormalized },
    create: {
      email: input.email,
      emailNormalized,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      phoneNormalized,
      firstSource: input.source,
      lastSource: input.source,
      lastActivityAt: new Date(),
    },
    update: {
      // `orIgnore`: una cadena vacía NO sobrescribe lo que ya hay.
      //
      // Prisma trata `undefined` como "no toques esta columna" y `""` como "escribe
      // cadena vacía". El endpoint público limpia los caracteres de control del
      // nombre antes de llegar aquí, y un valor formado **solo** por caracteres de
      // control queda en `""` después de pasar el esquema (`.trim()` de Zod no los
      // considera espacio en blanco). Sin esta guarda, cualquiera que conociese el
      // correo de un contacto podía dejar su ficha del CRM sin nombre con un solo
      // POST, y la pérdida era irreversible.
      firstName: orIgnore(input.firstName),
      lastName: orIgnore(input.lastName),
      phone: orIgnore(input.phone),
      phoneNormalized: orIgnore(phoneNormalized),
      lastSource: input.source,
      lastActivityAt: new Date(),
    },
  })
}

/**
 * Convierte "" en `undefined` para que Prisma no sobrescriba la columna.
 *
 * No confundir con un saneado: aquí no se transforma nada. Solo se distingue
 * "no me han dado este dato" de "me han dado un dato vacío", que para un `update`
 * son cosas opuestas y que Prisma solo diferencia por `undefined`.
 */
function orIgnore(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  return value.trim() === "" ? undefined : value
}

/**
 * La anonimización vive en `lib/domain/privacy.ts`.
 *
 * Estaba aquí y se movió en la fase de endurecimiento: la versión de este archivo
 * solo tocaba las columnas del propio `Lead`, lo que dejaba a la persona
 * identificable en el texto libre de sus solicitudes y en las notas del equipo.
 * Mantener dos funciones con el mismo nombre y distinto alcance era la vía directa
 * a llamar a la incompleta sin darse cuenta, así que aquí no queda ninguna.
 */
