/**
 * Accesos directos para contactar con una persona desde el CRM.
 *
 * "Seguros" aquí significa tres cosas concretas:
 *
 * 1. **Nada se concatena en crudo.** El asunto y el cuerpo van por
 *    `encodeURIComponent`, así que un nombre con `&` o un salto de línea no
 *    parten la URL ni inyectan parámetros que nadie escribió.
 * 2. **El esquema es fijo.** `mailto:`, `tel:` y `https://wa.me` se escriben
 *    literalmente; ningún dato de la base decide el protocolo, que es la vía por
 *    la que un valor guardado podría convertirse en `javascript:`.
 * 3. **Si el dato no sirve, no hay enlace.** Un teléfono sin dígitos suficientes
 *    no se pinta como enlace roto: se muestra el texto y nada más.
 */

const WHATSAPP_MIN_DIGITS = 9

function telHref(phone: string): string | null {
  // Solo dígitos y el prefijo internacional: es lo único que entiende `tel:`.
  const cleaned = phone.replace(/[^\d+]/g, "")
  const digits = cleaned.replace(/\D/g, "")
  if (digits.length < 6) return null
  return `tel:${cleaned}`
}

function whatsappHref(phone: string, message: string): string | null {
  // wa.me exige el número en formato internacional y solo dígitos.
  const digits = phone.replace(/\D/g, "")
  if (digits.length < WHATSAPP_MIN_DIGITS) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

function mailtoHref(email: string, subject: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}`
}

const linkClass =
  "inline-block px-3 py-1.5 text-xs tracking-[0.15em] uppercase text-muted-foreground border border-border transition-colors duration-300 hover:text-foreground"

export function ContactLinks({
  email,
  phone,
  name,
  subject = "El Portón de la Condesa",
}: {
  email: string
  phone: string | null
  name: string
  subject?: string
}) {
  const tel = phone ? telHref(phone) : null
  const whatsapp = phone ? whatsappHref(phone, `Hola ${name}, te escribimos de ${subject}.`) : null

  return (
    <div className="flex flex-wrap gap-2">
      <a href={mailtoHref(email, subject)} className={linkClass}>
        Email
      </a>
      {tel && (
        <a href={tel} className={linkClass}>
          Llamar
        </a>
      )}
      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={linkClass}>
          WhatsApp
        </a>
      )}
      {!phone && <span className="px-3 py-1.5 text-xs text-muted-foreground">Sin teléfono registrado</span>}
    </div>
  )
}
