/**
 * Sembrado **base**: solo configuración operativa, sin datos de ejemplo.
 *
 * Es lo único que una instalación real necesita después de migrar. Los datos de
 * demostración —fichas, contactos, solicitudes, usuarios de prueba— viven aparte
 * en `scripts/demo-seed.ts` (`npm run demo:seed`), y la creación del primer ADMIN
 * en `scripts/admin-bootstrap.ts`. Los tres están separados a propósito: hasta la
 * Fase 10 este archivo hacía las tres cosas, y eso obligaba a elegir entre
 * sembrar configuración o no sembrar nada.
 *
 * Idempotente: se puede ejecutar tantas veces como haga falta.
 *
 * Uso: npm run db:seed
 */
import { prisma } from "@/lib/db"

/**
 * Pesos iniciales del scoring de contactos. No son datos de ejemplo: sin ellos el
 * CRM puntúa a todo el mundo con 0 y el pipeline pierde su criterio de orden. Los
 * valores salen de project-reference/docs/03-arquitectura-crm-leads.md y un ADMIN
 * puede cambiarlos desde /admin/configuracion.
 */
const SCORING_RULES = [
  { key: "FORM_SUBMITTED", label: "Formulario enviado", points: 15 },
  { key: "PHONE_PROVIDED", label: "Teléfono informado", points: 10 },
  { key: "EVENT_DATE_PROVIDED", label: "Fecha informada", points: 10 },
  { key: "GUEST_COUNT_PROVIDED", label: "Invitados informados", points: 10 },
  { key: "VIP_ACCESS", label: "Acceso VIP", points: 10 },
  { key: "DOSSIER_DOWNLOAD", label: "Descarga de dossier", points: 15 },
  { key: "CONTENT_VIEWED_3PLUS", label: "3 o más reportajes consultados", points: 10 },
  { key: "VISIT_REQUESTED", label: "Solicitud de visita", points: 25 },
]

async function main() {
  for (const rule of SCORING_RULES) {
    await prisma.scoringRule.upsert({
      where: { key: rule.key },
      create: rule,
      // Se actualiza la etiqueta, **no** los puntos: si un ADMIN los ha ajustado
      // desde el panel, volver a sembrar no debe deshacer su decisión.
      update: { label: rule.label },
    })
  }

  console.log(`Reglas de scoring listas: ${SCORING_RULES.length}`)
  console.log("Siguientes pasos: `npm run admin:bootstrap` (primer ADMIN) y, si procede, `npm run demo:seed`.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
