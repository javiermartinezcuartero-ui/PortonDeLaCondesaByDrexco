import { afterEach, describe, expect } from "vitest"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { requireSession } from "@/lib/auth/session"
import { createAuthTestUser, signInHeaders, signInRaw, TEST_PASSWORD } from "@/lib/auth/test-helpers"
import { itDb, uniqueTestEmail } from "@/lib/domain/test-helpers"

const createdUserIds: string[] = []
afterEach(async () => {
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
    createdUserIds.length = 0
  }
})

describe("alta pública", () => {
  itDb("el endpoint de sign-up rechaza la creación de cuentas (disableSignUp)", async () => {
    const response = await auth.handler(
      new Request("http://localhost:3001/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3001" },
        body: JSON.stringify({
          email: uniqueTestEmail("signup-rechazado"),
          password: "cualquier-cosa-12345",
          name: "Intento de alta",
        }),
      })
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe("EMAIL_PASSWORD_SIGN_UP_DISABLED")
  })
})

describe("mensajes de error de login", () => {
  itDb("una contraseña incorrecta y un email inexistente devuelven el mismo error genérico", async () => {
    const { id, email } = await createAuthTestUser("CONTENT")
    createdUserIds.push(id)

    const wrongPassword = await signInRaw(email, "contraseña-incorrecta-1234")
    const unknownEmail = await signInRaw(uniqueTestEmail("no-existe"), "contraseña-incorrecta-1234")

    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)

    const wrongPasswordBody = await wrongPassword.json()
    const unknownEmailBody = await unknownEmail.json()
    expect(wrongPasswordBody.code).toBe("INVALID_EMAIL_OR_PASSWORD")
    expect(unknownEmailBody.code).toBe("INVALID_EMAIL_OR_PASSWORD")
  })
})

describe("logout", () => {
  itDb("revoca la sesión en servidor, no solo la cookie del navegador", async () => {
    const { id, email } = await createAuthTestUser("CONTENT")
    createdUserIds.push(id)
    const headers = await signInHeaders(email, TEST_PASSWORD)

    await requireSession(headers) // confirma que la sesión funciona antes de cerrarla

    const signOutResponse = await auth.handler(
      new Request("http://localhost:3001/api/auth/sign-out", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3001",
          cookie: headers.get("cookie") ?? "",
        },
        body: "{}",
      })
    )
    expect(signOutResponse.status).toBe(200)

    const remainingSessions = await prisma.session.count({ where: { userId: id } })
    expect(remainingSessions).toBe(0)

    const userAfterLogout = await auth.api.getSession({ headers })
    expect(userAfterLogout).toBeNull()
  })
})
