"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ForbiddenError, UnauthenticatedError, requirePermission } from "@/lib/auth/session"
import { DomainError } from "@/lib/domain/errors"
import { anonymizeLead, revokeAllVipSessions, revokeMarketingConsent } from "@/lib/domain/privacy"
import { PRIVACY_POLICY_VERSION } from "@/lib/legal"
import { cuidLike } from "@/lib/validation/crm"

/**
 * Acciones de privacidad. **Todas exigen ADMIN**, no `crm:access`.
 *
 * El criterio: consultar un contacto es trabajo comercial y lo hace SALES; borrar
 * su identidad, revocar sus accesos o sacar sus datos del sistema son decisiones
 * con consecuencias legales que no se deshacen. Se comprueba con
 * `requirePermission("crm:export")`, que es el permiso reservado a ADMIN para todo
 * lo que saca o destruye datos personales.
 *
 * Ninguna se fía de que la pantalla que las invoca esté oculta para otros roles:
 * una Server Action es un endpoint.
 */

export type PrivacyActionResult<T = undefined> = { ok: true; data: T } | { ok: false; errors: string[] }

const leadIdSchema = z.object({ leadId: cuidLike })

function toErrors(error: unknown): string[] {
  if (error instanceof UnauthenticatedError) return ["Tu sesión ha caducado. Vuelve a iniciar sesión."]
  if (error instanceof ForbiddenError) return ["Solo un administrador puede realizar esta operación."]
  if (error instanceof DomainError) return [error.message]
  throw error
}

/**
 * Anonimiza un contacto. Irreversible por diseño: si se pudiera deshacer, no sería
 * una anonimización.
 */
export async function anonymizeLeadAction(input: unknown): Promise<PrivacyActionResult<{ notesDeleted: number }>> {
  const parsed = leadIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: ["Contacto no válido"] }

  try {
    const user = await requirePermission("crm:export")
    const summary = await anonymizeLead(parsed.data.leadId, user.id)

    revalidatePath(`/admin/contactos/${parsed.data.leadId}`)
    revalidatePath("/admin/contactos")

    return { ok: true, data: { notesDeleted: summary.notesDeleted } }
  } catch (error) {
    return { ok: false, errors: toErrors(error) }
  }
}

export async function revokeMarketingConsentAction(input: unknown): Promise<PrivacyActionResult> {
  const parsed = leadIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: ["Contacto no válido"] }

  try {
    const user = await requirePermission("crm:export")
    await revokeMarketingConsent({
      leadId: parsed.data.leadId,
      actorId: user.id,
      policyVersion: PRIVACY_POLICY_VERSION,
    })

    revalidatePath(`/admin/contactos/${parsed.data.leadId}`)
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, errors: toErrors(error) }
  }
}

export async function revokeVipSessionsAction(input: unknown): Promise<PrivacyActionResult<{ revoked: number }>> {
  const parsed = leadIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: ["Contacto no válido"] }

  try {
    const user = await requirePermission("crm:export")
    const revoked = await revokeAllVipSessions({ leadId: parsed.data.leadId, actorId: user.id })

    revalidatePath(`/admin/contactos/${parsed.data.leadId}`)
    return { ok: true, data: { revoked } }
  } catch (error) {
    return { ok: false, errors: toErrors(error) }
  }
}
