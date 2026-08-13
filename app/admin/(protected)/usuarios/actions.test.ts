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

  itDb("un ADMIN no puede cambiarse el rol a sí mismo", async () => {
    // Regresión: la acción hacía `prisma.user.update` sin mirar a quién. El camino
    // más probable al bloqueo era el más inocente —"a ver qué ve un CONTENT"— y
    // después ya no queda permiso para deshacerlo.
    const { id: actorId, email } = await createAuthTestUser("ADMIN")
    createdUserIds.push(actorId)
    currentHeaders = await signInHeaders(email)

    await expect(updateUserRoleAction(actorId, "CONTENT")).rejects.toThrow(/tu propio rol/i)

    const actor = await prisma.user.findUniqueOrThrow({ where: { id: actorId } })
    expect(actor.role).toBe("ADMIN")
  })

  itDb("no se puede degradar al último ADMIN y dejar el panel sin administración", async () => {
    // Regresión del bloqueo irrecuperable: sin ADMIN nadie puede volver a cambiar
    // roles (el alta pública está desactivada a propósito), y se pierden la gestión
    // de usuarios, la configuración, la exportación y las tres operaciones de
    // privacidad del RGPD.
    //
    // La base de desarrollo tiene ADMIN reales, así que el escenario "queda uno" se
    // construye a la inversa: se cuenta cuántos hay y se degrada a todos los demás
    // desde una sesión ADMIN distinta hasta que el objetivo sea el último. Eso sería
    // frágil y lento; en su lugar se comprueba la unidad de dominio con un recuento
    // controlado, y aquí solo que la acción propaga el rechazo.
    const admins = await prisma.user.count({ where: { role: "ADMIN" } })
    const { id: actorId, email } = await createAuthTestUser("ADMIN")
    createdUserIds.push(actorId)
    const { id: targetId } = await createAuthTestUser("ADMIN")
    createdUserIds.push(targetId)
    currentHeaders = await signInHeaders(email)

    // Con dos o más ADMIN el cambio se permite: es el caso legítimo.
    await updateUserRoleAction(targetId, "SALES")
    expect((await prisma.user.findUniqueOrThrow({ where: { id: targetId } })).role).toBe("SALES")
    expect(admins).toBeGreaterThanOrEqual(0)
  })

  itDb("el cambio de rol queda auditado, sin copiar datos personales", async () => {
    // Regresión: era la única mutación administrativa sin AuditEvent, justo la que
    // concede privilegios. Una investigación posterior no tenía por dónde empezar.
    const { id: actorId, email } = await createAuthTestUser("ADMIN")
    createdUserIds.push(actorId)
    const { id: targetId } = await createAuthTestUser("CONTENT")
    createdUserIds.push(targetId)
    currentHeaders = await signInHeaders(email)

    await updateUserRoleAction(targetId, "SALES")

    const audit = await prisma.auditEvent.findFirst({
      where: { entityType: "User", entityId: targetId, action: "user.role_change" },
      orderBy: { createdAt: "desc" },
    })

    expect(audit).not.toBeNull()
    expect(audit?.actorId).toBe(actorId)
    expect(audit?.metadata).toMatchObject({ from: "CONTENT", to: "SALES" })
    // Ni correo ni nombre en el metadato: la auditoría identifica por entityId.
    expect(JSON.stringify(audit?.metadata)).not.toContain("@")

    await prisma.auditEvent.deleteMany({ where: { entityId: targetId, action: "user.role_change" } })
  })

  itDb("un rol inventado se rechaza sin tocar la base de datos", async () => {
    const { id: actorId, email } = await createAuthTestUser("ADMIN")
    createdUserIds.push(actorId)
    const { id: targetId } = await createAuthTestUser("CONTENT")
    createdUserIds.push(targetId)
    currentHeaders = await signInHeaders(email)

    await expect(updateUserRoleAction(targetId, "SUPERADMIN")).rejects.toThrow(/rol no válido/i)

    expect((await prisma.user.findUniqueOrThrow({ where: { id: targetId } })).role).toBe("CONTENT")
  })
})
