import { NextResponse } from "next/server"
import { hasVipAccess } from "@/lib/vip/session"

/**
 * ¿Tiene quien pregunta una sesión VIP válida? Un booleano y nada más.
 *
 * **Para qué existe.** El aviso de las bibliotecas (`vip-invite-popup.tsx`) aparece
 * a los 35 segundos y no debe molestar a quien ya dejó su email. La cookie de
 * acceso es `HttpOnly` —así debe ser—, así que el cliente no puede mirarla, y hacía
 * falta una forma de preguntar.
 *
 * **Por qué no se resuelve en el layout.** Leer la cookie en el layout raíz habría
 * marcado como dinámico **todo** el sitio público, incluidas las páginas que hoy se
 * generan estáticas. Un endpoint que se consulta una sola vez, y solo si el
 * visitante sigue en la página al minuto y medio, cuesta muchísimo menos.
 *
 * **Qué no devuelve.** Ni el email, ni el identificador del lead, ni cuándo caduca
 * la sesión. Solo si hay acceso o no: es lo único que el cliente necesita para
 * decidir si pinta un aviso, y es un dato que quien pregunta ya conoce sobre sí
 * mismo. Un token inválido o caducado responde `false`, igual que la ausencia de
 * cookie: `getVipLead()` no distingue, y aquí tampoco hace falta.
 */

export const dynamic = "force-dynamic"

export async function GET() {
  const hasAccess = await hasVipAccess()

  return NextResponse.json(
    { hasAccess },
    // `no-store` y no `private`: la respuesta depende de una cookie, y un
    // intermediario que la guardara podría servirle a otra persona el `true` de
    // alguien que sí tiene acceso.
    { status: 200, headers: { "Cache-Control": "no-store" } }
  )
}
