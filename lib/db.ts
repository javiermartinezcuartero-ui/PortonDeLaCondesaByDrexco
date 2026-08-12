import { PrismaClient } from "@prisma/client"

// Singleton de PrismaClient recomendado por Next.js para evitar agotar el
// pool de conexiones con el hot-reload de `next dev`.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
