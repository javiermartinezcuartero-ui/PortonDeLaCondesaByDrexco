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
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      phoneNormalized,
      lastSource: input.source,
      lastActivityAt: new Date(),
    },
  })
}

/**
 * Anonimiza un Lead: sustituye los campos identificativos por valores no
 * reversibles y marca lifecycle = ANONYMIZED. Transaccional: si falla
 * cualquier paso, no queda el Lead a medio anonimizar.
 */
export async function anonymizeLead(leadId: string): Promise<Lead> {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId } })

    return tx.lead.update({
      where: { id: leadId },
      data: {
        email: `anonimizado+${lead.id}@example.invalid`,
        emailNormalized: `anonimizado+${lead.id}@example.invalid`,
        firstName: null,
        lastName: null,
        phone: null,
        phoneNormalized: null,
        lifecycle: "ANONYMIZED",
        anonymizedAt: new Date(),
      },
    })
  })
}
