import { prisma } from "@/lib/db"
import type { ConsentEvent, ConsentPurpose, Prisma, PrismaClient } from "@prisma/client"

type Db = PrismaClient | Prisma.TransactionClient

export type RecordConsentInput = {
  leadId: string
  purpose: ConsentPurpose
  granted: boolean
  policyVersion: string
  source?: string
}

/**
 * Registra un evento de consentimiento. Nunca actualiza uno anterior: es un
 * registro inmutable de auditoría (una revocación es un evento nuevo con
 * granted=false).
 *
 * Acepta un cliente de transacción para poder anotarse en el mismo commit que
 * la solicitud que lo originó: o se guarda la solicitud **y** su base legal, o
 * no se guarda ninguna de las dos.
 */
export async function recordConsent(input: RecordConsentInput, db: Db = prisma): Promise<ConsentEvent> {
  return db.consentEvent.create({
    data: {
      leadId: input.leadId,
      purpose: input.purpose,
      granted: input.granted,
      policyVersion: input.policyVersion,
      source: input.source,
    },
  })
}

/** Último consentimiento conocido para un propósito (granted vigente o no). */
export async function getLatestConsent(leadId: string, purpose: ConsentPurpose): Promise<ConsentEvent | null> {
  return prisma.consentEvent.findFirst({
    where: { leadId, purpose },
    orderBy: { createdAt: "desc" },
  })
}
