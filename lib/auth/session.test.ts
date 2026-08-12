import { afterEach, describe, expect } from "vitest"
import { prisma } from "@/lib/db"
import {
  ForbiddenError,
  UnauthenticatedError,
  getSessionUser,
  requirePermission,
  requireRole,
  requireSession,
} from "@/lib/auth/session"
import { createAuthTestUser, signInHeaders, TEST_PASSWORD } from "@/lib/auth/test-helpers"
import { itDb } from "@/lib/domain/test-helpers"

const createdUserIds: string[] = []
afterEach(async () => {
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
    createdUserIds.length = 0
  }
})

describe("getSessionUser / requireSession", () => {
  itDb("resuelve el usuario a partir de una sesión real", async () => {
    const { id, email } = await createAuthTestUser("CONTENT")
    createdUserIds.push(id)
    const headers = await signInHeaders(email, TEST_PASSWORD)

    const user = await requireSession(headers)
    expect(user.email).toBe(email)
    expect(user.role).toBe("CONTENT")
  })

  itDb("getSessionUser devuelve null sin cookie de sesión", async () => {
    const user = await getSessionUser(new Headers())
    expect(user).toBeNull()
  })

  itDb("requireSession lanza UnauthenticatedError sin cookie de sesión", async () => {
    await expect(requireSession(new Headers())).rejects.toBeInstanceOf(UnauthenticatedError)
  })
})

describe("requireRole", () => {
  itDb("resuelve el usuario cuando su rol está permitido", async () => {
    const { id, email } = await createAuthTestUser("ADMIN")
    createdUserIds.push(id)
    const headers = await signInHeaders(email)

    const user = await requireRole(["ADMIN"], headers)
    expect(user.role).toBe("ADMIN")
  })

  itDb("lanza ForbiddenError cuando el rol no está permitido", async () => {
    const { id, email } = await createAuthTestUser("SALES")
    createdUserIds.push(id)
    const headers = await signInHeaders(email)

    await expect(requireRole(["ADMIN"], headers)).rejects.toBeInstanceOf(ForbiddenError)
  })

  itDb("lanza UnauthenticatedError antes de comprobar el rol si no hay sesión", async () => {
    await expect(requireRole(["ADMIN"], new Headers())).rejects.toBeInstanceOf(UnauthenticatedError)
  })
})

describe("requirePermission", () => {
  itDb("concede el permiso a los roles incluidos", async () => {
    const { id, email } = await createAuthTestUser("CONTENT")
    createdUserIds.push(id)
    const headers = await signInHeaders(email)

    const user = await requirePermission("cms:access", headers)
    expect(user.role).toBe("CONTENT")
  })

  itDb("deniega el permiso a los roles no incluidos", async () => {
    const { id, email } = await createAuthTestUser("CONTENT")
    createdUserIds.push(id)
    const headers = await signInHeaders(email)

    await expect(requirePermission("users:manage", headers)).rejects.toBeInstanceOf(ForbiddenError)
  })
})
