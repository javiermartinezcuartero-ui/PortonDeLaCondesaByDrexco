import { prisma } from "@/lib/db"
import { sanitizeMetadata } from "@/lib/domain/metadata"
import type { ActivityType, LeadActivity, Prisma, PrismaClient } from "@prisma/client"

type Db = PrismaClient | Prisma.TransactionClient

export type RecordActivityInput = {
  leadId: string
  type: ActivityType
  leadRequestId?: string
  contentEntryId?: string
  actorId?: string
  metadata?: Record<string, unknown>
}

/** Registra una actividad de CRM. `metadata` siempre se sanea antes de guardarse (ver lib/domain/metadata.ts). */
export async function recordActivity(input: RecordActivityInput, db: Db = prisma): Promise<LeadActivity> {
  return db.leadActivity.create({
    data: {
      leadId: input.leadId,
      type: input.type,
      leadRequestId: input.leadRequestId,
      contentEntryId: input.contentEntryId,
      actorId: input.actorId,
      metadata: input.metadata ? (sanitizeMetadata(input.metadata) as Prisma.InputJsonValue) : undefined,
    },
  })
}
