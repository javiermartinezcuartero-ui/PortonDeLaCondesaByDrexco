import { prisma } from "@/lib/db"
import type { FollowUpTask, Priority } from "@prisma/client"

export type CreateFollowUpTaskInput = {
  leadId: string
  title: string
  dueAt: Date
  assigneeId?: string
  priority?: Priority
}

export async function createFollowUpTask(input: CreateFollowUpTaskInput): Promise<FollowUpTask> {
  return prisma.followUpTask.create({
    data: {
      leadId: input.leadId,
      title: input.title,
      dueAt: input.dueAt,
      assigneeId: input.assigneeId,
      priority: input.priority,
    },
  })
}

export async function completeFollowUpTask(id: string): Promise<FollowUpTask> {
  return prisma.followUpTask.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  })
}

export async function cancelFollowUpTask(id: string): Promise<FollowUpTask> {
  return prisma.followUpTask.update({
    where: { id },
    data: { status: "CANCELLED" },
  })
}
