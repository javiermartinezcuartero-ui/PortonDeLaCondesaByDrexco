import { afterEach, describe, expect } from "vitest"
import { prisma } from "@/lib/db"
import { createAuthTestUser, signInHeaders } from "@/lib/auth/test-helpers"
import { itDb } from "@/lib/domain/test-helpers"
import { GET } from "./route"

const createdUserIds: string[] = []
afterEach(async () => {
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
    createdUserIds.length = 0
  }
})

function buildRequest(headers: Headers): Request {
  return new Request("http://localhost:3001/api/admin/users", { headers })
}

describe("GET /api/admin/users", () => {
  itDb("devuelve 401 sin sesión", async () => {
    const response = await GET(buildRequest(new Headers()))
    expect(response.status).toBe(401)
  })

  itDb("devuelve 403 con sesión de un rol distinto de ADMIN", async () => {
    const { id, email } = await createAuthTestUser("SALES")
    createdUserIds.push(id)
    const headers = await signInHeaders(email)

    const response = await GET(buildRequest(headers))
    expect(response.status).toBe(403)
  })

  itDb("devuelve 200 y la lista de usuarios con sesión ADMIN", async () => {
    const { id, email } = await createAuthTestUser("ADMIN")
    createdUserIds.push(id)
    const headers = await signInHeaders(email)

    const response = await GET(buildRequest(headers))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.users.some((u: { email: string }) => u.email === email)).toBe(true)
  })
})
