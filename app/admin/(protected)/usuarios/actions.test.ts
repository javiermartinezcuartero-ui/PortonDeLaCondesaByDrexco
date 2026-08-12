import { afterEach, describe, expect, vi } from "vitest"
import { prisma } from "@/lib/db"
import { createAuthTestUser, signInHeaders } from "@/lib/auth/test-helpers"
import { itDb } from "@/lib/domain/test-helpers"
import { updateUserRoleAction } from "./actions"

// `updateUserRoleAction` llama a `requireRole` sin pasarle headers, así que
// internamente usa `headers()` de "next/headers" (el camino real dentro de
// una Server Action de Next.js). Fuera del runtime de Next no hay un scope de
// petición, así que se simula aquí para poder invocar la acción directamente.
let currentHeaders = new Headers()
vi.mock("next/headers", () => ({
  headers: async () => currentHeaders,
}))

const createdUserIds: string[] = []
afterEach(async () => {
  currentHeaders = new Headers()
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
    createdUserIds.length = 0
  }
})

describe("updateUserRoleAction (Server Action)", () => {
  itDb("rechaza la llamada sin sesión", async () => {
    const { id: targetId } = await createAuthTestUser("SALES")
    createdUserIds.push(targetId)

    await expect(updateUserRoleAction(targetId, "ADMIN")).rejects.toThrow()
  })

  itDb("rechaza la llamada con una sesión que no es ADMIN", async () => {
    const { id: actorId, email } = await createAuthTestUser("SALES")
    createdUserIds.push(actorId)
    const { id: targetId } = await createAuthTestUser("CONTENT")
    createdUserIds.push(targetId)
    currentHeaders = await signInHeaders(email)

    await expect(updateUserRoleAction(targetId, "ADMIN")).rejects.toThrow()

    const target = await prisma.user.findUniqueOrThrow({ where: { id: targetId } })
    expect(target.role).toBe("CONTENT")
  })

  itDb("una sesión ADMIN puede cambiar el rol de otro usuario", async () => {
    const { id: actorId, email } = await createAuthTestUser("ADMIN")
    createdUserIds.push(actorId)
    const { id: targetId } = await createAuthTestUser("CONTENT")
    createdUserIds.push(targetId)
    currentHeaders = await signInHeaders(email)

    await updateUserRoleAction(targetId, "SALES")

    const target = await prisma.user.findUniqueOrThrow({ where: { id: targetId } })
    expect(target.role).toBe("SALES")
  })
})
