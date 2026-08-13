/**
 * Marcas que identifican los datos de demostración.
 *
 * El contenido tiene su propia columna (`ContentEntry.isDemo`), pero los contactos
 * no: añadir una columna solo para la demo mezclaría una necesidad de la
 * presentación con el modelo del negocio. En su lugar, los contactos ficticios se
 * reconocen por el dominio de su email, que es un dato que ya existe y que además
 * garantiza que **ninguna dirección de la demo puede recibir correo**:
 * `.test` es un TLD reservado por la RFC 2606 y no resuelve.
 *
 * Ese dominio es lo que permite que `npm run demo:clean` sepa exactamente qué
 * borrar sin tocar un solo contacto real.
 */
export const DEMO_LEAD_EMAIL_DOMAIN = "demo.portondelacondesa.test"

/** Construye el email de un contacto de demostración. */
export function demoLeadEmail(local: string): string {
  return `${local}@${DEMO_LEAD_EMAIL_DOMAIN}`
}

/** ¿Es un contacto de demostración? Se compara sobre el email normalizado. */
export function isDemoLeadEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${DEMO_LEAD_EMAIL_DOMAIN}`)
}

/**
 * Dominio de los usuarios del equipo de demostración (no de la cuenta de
 * evaluación, que se declara por variable de entorno y puede ser cualquiera).
 */
export const DEMO_USER_EMAIL_DOMAIN = "demo.portondelacondesa.test"

export function isDemoUserEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${DEMO_USER_EMAIL_DOMAIN}`)
}
