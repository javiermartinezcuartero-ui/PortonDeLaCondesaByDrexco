import { prisma } from "@/lib/db"
import { generateVipToken } from "@/lib/security/tokens"
import { hashVipToken, vipTokenHashCandidates } from "@/lib/security/hash"
import type { Lead, VipAccessSession } from "@prisma/client"

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 días

/**
 * Genera una sesión de acceso VIP. Devuelve el token en claro UNA sola vez
 * (para el enlace mágico/cookie); en base de datos solo se guarda su hash.
 */
export async function createVipAccessSession(
  leadId: string,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<{ token: string; session: VipAccessSession }> {
  const token = generateVipToken()
  const tokenHash = hashVipToken(token)

  const session = await prisma.vipAccessSession.create({
    data: { leadId, tokenHash, expiresAt: new Date(Date.now() + ttlMs) },
  })

  return { token, session }
}

export async function revokeVipAccessSession(sessionId: string): Promise<VipAccessSession> {
  return prisma.vipAccessSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  })
}

/**
 * Verifica un token de acceso VIP contra su hash almacenado. Devuelve el
 * Lead asociado si la sesión es válida (no revocada, no caducada), o null.
 * Actualiza `lastUsedAt` en cada verificación correcta.
 */
export async function verifyVipAccessSession(token: string): Promise<Lead | null> {
  const match = await prisma.vipAccessSession.findFirst({
    where: {
      tokenHash: { in: vipTokenHashCandidates(token) },
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { lead: true },
  })
  if (!match) return null

  await prisma.vipAccessSession.update({
    where: { id: match.id },
    data: { lastUsedAt: new Date() },
  })

  return match.lead
}
