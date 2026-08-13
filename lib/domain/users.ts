import type { Role, User } from "@prisma/client"
import { prisma } from "@/lib/db"
import { DomainError } from "@/lib/domain/errors"

/**
 * Gestión de los usuarios del panel.
 *
 * Esto vivía en la Server Action (`app/admin/(protected)/usuarios/actions.ts`), que
 * llamaba a `prisma.user.update` directamente desde la capa de interfaz. Se movió
 * aquí por tres motivos, y el tercero es el que importa:
 *
 * 1. CLAUDE.md exige separar interfaz, validación, dominio y acceso a datos.
 * 2. La acción no auditaba nada, y el cambio de rol es la mutación más sensible
 *    del sistema: quien puede cambiar roles puede darse a sí mismo cualquier
 *    permiso. Era el único punto ciego del registro de auditoría.
 * 3. **No comprobaba que quedara algún ADMIN.** Un `UPDATE` sin más permitía al
 *    único administrador degradarse a sí mismo, y a partir de ese momento nadie
 *    podía volver a cambiar roles: el alta pública está desactivada a propósito,
 *    así que la única salida era ejecutar `npm run admin:bootstrap` con acceso al
 *    servidor y a las variables de entorno. Con él se perdían de golpe la gestión
 *    de usuarios, la configuración del scoring, la exportación y **las tres
 *    operaciones de privacidad del RGPD**, que son obligaciones legales, no
 *    comodidades.
 */

export const VALID_ROLES: readonly Role[] = ["ADMIN", "SALES", "CONTENT"]

export function isValidRole(value: string): value is Role {
  return (VALID_ROLES as readonly string[]).includes(value)
}

export class InvalidRoleError extends DomainError {
  constructor(role: string) {
    super(`Rol no válido: ${role}`)
  }
}

export class SelfRoleChangeError extends DomainError {
  constructor() {
    super("No puedes cambiar tu propio rol: pídelo a otra persona con perfil de administración")
  }
}

export class LastAdminError extends DomainError {
  constructor() {
    super("No se puede quitar el último perfil de administración: antes hay que asignar otro")
  }
}

export type ChangeUserRoleInput = {
  userId: string
  role: string
  /** Quien realiza el cambio. Se usa para auditar y para impedir el autocambio. */
  actorId: string
}

/**
 * ¿Deja este cambio el sistema sin ningún administrador?
 *
 * Está fuera de la transacción a propósito, como función pura: la rama que importa
 * —"queda exactamente uno"— no se puede provocar de forma fiable en una prueba de
 * integración, porque la base de desarrollo es compartida y siempre tiene
 * administradores reales. Sacarla aquí permite probar los cuatro casos de verdad,
 * en vez de dejar la comprobación crítica sin cobertura o degradar cuentas reales
 * para forzar el escenario.
 */
export function leavesSystemWithoutAdmin(
  currentRole: Role,
  newRole: Role,
  adminCount: number
): boolean {
  if (currentRole !== "ADMIN") return false
  if (newRole === "ADMIN") return false
  return adminCount <= 1
}

/**
 * Cambia el rol de un usuario del panel.
 *
 * La comprobación de "queda algún ADMIN" y el `UPDATE` van **en la misma
 * transacción**: hacer el recuento antes y actualizar después dejaría la ventana
 * en la que dos degradaciones simultáneas ven cada una que el otro ADMIN existe y
 * acaban dejando cero.
 */
export async function changeUserRole(input: ChangeUserRoleInput): Promise<User> {
  if (!isValidRole(input.role)) throw new InvalidRoleError(input.role)

  // Se captura en una constante local: el estrechamiento de tipo que hace
  // `isValidRole` sobre `input.role` no sobrevive dentro del callback de la
  // transacción, porque TypeScript no puede garantizar que la propiedad no cambie.
  const role = input.role

  // Un ADMIN no se degrada a sí mismo. Es la vía más probable al bloqueo —"a ver
  // qué ve un CONTENT"— y la que ninguna otra comprobación puede recuperar,
  // porque después ya no tiene el permiso para deshacerlo.
  if (input.userId === input.actorId) throw new SelfRoleChangeError()

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true, role: true },
    })
    if (!target) throw new DomainError("El usuario no existe")

    // Cambiar a un usuario al mismo rol que ya tiene no ensucia el historial.
    if (target.role === role) {
      return tx.user.findUniqueOrThrow({ where: { id: input.userId } })
    }

    const admins = await tx.user.count({ where: { role: "ADMIN" } })
    if (leavesSystemWithoutAdmin(target.role, role, admins)) throw new LastAdminError()

    const updated = await tx.user.update({
      where: { id: input.userId },
      data: { role },
    })

    await tx.auditEvent.create({
      data: {
        entityType: "User",
        entityId: updated.id,
        action: "user.role_change",
        actorId: input.actorId,
        // Solo el rol anterior y el nuevo. Ni el correo ni el nombre: la
        // auditoría identifica por `entityId`, y copiar datos personales a un
        // registro que se conserva indefinidamente es justo lo que la
        // minimización quiere evitar.
        metadata: { from: target.role, to: updated.role },
      },
    })

    return updated
  })
}
