import { prisma } from "@/lib/db"
import { sanitizeMetadata } from "@/lib/domain/metadata"
import type { AuditEvent, Prisma } from "@prisma/client"

export type RecordAuditEventInput = {
  entityType: string
  entityId: string
  action: string
  actorId?: string
  metadata?: Record<string, unknown>
}

export async function recordAuditEvent(input: RecordAuditEventInput): Promise<AuditEvent> {
  return prisma.auditEvent.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorId: input.actorId,
      metadata: input.metadata ? (sanitizeMetadata(input.metadata) as Prisma.InputJsonValue) : undefined,
    },
  })
}
