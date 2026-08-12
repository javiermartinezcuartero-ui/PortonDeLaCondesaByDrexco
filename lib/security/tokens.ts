import { randomBytes } from "node:crypto"

/** Token de sesión VIP opaco y no adivinable. Solo su hash se persiste (ver lib/security/hash.ts). */
export function generateVipToken(): string {
  return randomBytes(32).toString("base64url")
}
