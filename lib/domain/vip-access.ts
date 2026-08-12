import type { ContentType, Lead, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { normalizeEmail } from "@/lib/domain/normalize"
import { sanitizeMetadata } from "@/lib/domain/metadata"
import { recalculateLeadScore } from "@/lib/domain/scoring"
import { PRIVACY_POLICY_VERSION } from "@/lib/legal"
import { hashVipToken } from "@/lib/security/hash"
import { generateVipToken } from "@/lib/security/tokens"

/** 30 días, igual que la caducidad de la cookie (lib/vip/session.ts). */
export const VIP_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30

export type GrantVipAccessInput = {
  email: string
  privacyConsent: true
  marketingConsent: boolean
  /** Sección desde la que se pidió el acceso. La sesión desbloquea ambas. */
  section: ContentType
  /** Origen legible del acceso (p. ej. "vip-gate:bodas-reales"). */
  source: string
  attribution?: {
    utmSource?: string
    utmMedium?: string
    utmCampaign?: string
    utmContent?: string
    utmTerm?: string
    landingPath?: string
    referrer?: string
  }
}

export type GrantVipAccessResult = {
  /** Token en claro. Solo existe aquí y en la cookie; nunca se persiste. */
  token: string
  lead: Lead
  expiresAt: Date
}

/**
 * Concede acceso a las bibliotecas VIP: crea o recupera el Lead, registra los
 * consentimientos, la actividad y la interacción, y abre una sesión de acceso.
 *
 * **Todo ocurre en una única transacción.** Si cualquier paso falla, no queda
 * nada a medias y el llamador no debe entregar la cookie: el visitante vuelve
 * a ver el gate. Ese es el requisito "no desbloquees si la persistencia falla".
 *
 * El token se genera antes de la transacción (es una operación pura de
 * criptografía) y en base de datos solo se guarda su HMAC.
 */
export async function grantVipAccess(input: GrantVipAccessInput): Promise<GrantVipAccessResult> {
  const emailNormalized = normalizeEmail(input.email)
  const token = generateVipToken()
  const tokenHash = hashVipToken(token)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + VIP_SESSION_TTL_MS)

  const lead = await prisma.$transaction(async (tx) => {
    // Solo se escriben los campos que el gate conoce de verdad. No se toca
    // firstName/lastName/phone: si el Lead ya existe con datos del formulario
    // de contacto, el acceso VIP no debe degradarlos.
    const lead = await tx.lead.upsert({
      where: { emailNormalized },
      create: {
        email: input.email,
        emailNormalized,
        firstSource: input.source,
        lastSource: input.source,
        lastActivityAt: now,
      },
      update: {
        lastSource: input.source,
        lastActivityAt: now,
      },
    })

    // Consentimientos separados e inmutables: una fila nueva por evento.
    await tx.consentEvent.create({
      data: {
        leadId: lead.id,
        purpose: "PRIVACY",
        granted: true,
        policyVersion: PRIVACY_POLICY_VERSION,
        source: input.source,
      },
    })

    // Marketing solo se registra cuando se ha marcado: no se guarda un
    // "granted=false" por una casilla que simplemente se dejó como estaba.
    if (input.marketingConsent) {
      await tx.consentEvent.create({
        data: {
          leadId: lead.id,
          purpose: "MARKETING",
          granted: true,
          policyVersion: PRIVACY_POLICY_VERSION,
          source: input.source,
        },
      })
    }

    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        type: "VIP_ACCESSED",
        metadata: sanitizeMetadata({
          section: input.section,
          source: input.source,
          ...input.attribution,
        }) as Prisma.InputJsonValue,
      },
    })

    await tx.contentInteraction.create({
      data: {
        leadId: lead.id,
        section: input.section,
        type: "GATE_GRANTED",
        utmSource: input.attribution?.utmSource,
        utmMedium: input.attribution?.utmMedium,
        utmCampaign: input.attribution?.utmCampaign,
      },
    })

    await tx.vipAccessSession.create({
      data: { leadId: lead.id, tokenHash, expiresAt },
    })

    return lead
  })

  // Fuera de la transacción: recalcular el scoring lee mucho historial y no
  // debe alargar el bloqueo. Si falla, el acceso ya está concedido y es
  // correcto — el score se recalculará en la siguiente interacción.
  await recalculateLeadScore(lead.id).catch(() => undefined)

  return { token, lead, expiresAt }
}
