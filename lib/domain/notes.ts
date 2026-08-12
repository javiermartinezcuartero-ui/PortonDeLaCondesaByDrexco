import { prisma } from "@/lib/db"
import type { LeadNote } from "@prisma/client"

export async function addLeadNote(input: { leadId: string; body: string; authorId?: string }): Promise<LeadNote> {
  return prisma.leadNote.create({
    data: { leadId: input.leadId, body: input.body, authorId: input.authorId },
  })
}
