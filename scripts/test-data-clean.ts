/**
 * Retira los contactos ficticios que dejan las pruebas.
 *
 * Uso:
 *   npm run test:clean                        → borra los contactos de dominios de prueba
 *   npm run test:clean -- --seco              → solo informa de lo que borraría
 *   npm run test:clean -- --dominio=x.y       → añade un dominio concreto a esta ejecución
 *
 * **Por qué existe, además de `demo:clean`.** `demo:clean` retira los datos de la
 * demostración, que se identifican por el dominio `demo.portondelacondesa.test`.
 * Pero las pruebas de Vitest que tocan base de datos corren contra la base de
 * desarrollo real —limitación conocida, ver README §Limitaciones— y crean sus
 * contactos con otros dominios. Un `npm test` completo deja cientos de contactos
 * ficticios en el CRM, y sin esto habría que borrarlos a mano cada vez.
 *
 * **La garantía de que no se borra a nadie real** es la lista de sufijos de abajo:
 * todos son dominios que el IETF reserva para ejemplos y pruebas (RFC 2606 y RFC
 * 6761) y que por definición **no pueden existir en Internet**. Nadie tiene un
 * correo en `.invalid` ni en `.test`, así que ningún contacto legítimo puede
 * coincidir. Si hace falta borrar un dominio que no esté en la lista —una prueba
 * manual hecha con un dominio real mal escrito, por ejemplo— hay que nombrarlo
 * expresamente con `--dominio=`, que es la fricción que se quiere: escribir el
 * dominio a mano obliga a pensar en qué se está borrando.
 *
 * El borrado en cascada del esquema se lleva por delante solicitudes,
 * consentimientos, actividades, notas, interacciones, tareas, sesiones VIP y
 * notificaciones de cada contacto (prisma/schema.prisma: `onDelete: Cascade`).
 *
 * **No toca los `AuditEvent`.** Sobreviven al borrado a propósito: un registro de
 * auditoría que desaparece con lo auditado no es un registro de auditoría. Sus
 * `entityId` quedarán apuntando a contactos que ya no existen, que es exactamente
 * lo que debe pasar.
 */
import { prisma } from "@/lib/db"
// La lista vive en `lib/testing/test-data-domains.ts` y no aquí: este archivo llama
// a `main()` en su nivel superior, así que importarlo desde una prueba ejecutaría el
// borrado. Con la constante en un módulo sin efectos, la prueba la vigila sin
// disparar nada.
import { TEST_DATA_EMAIL_SUFFIXES } from "@/lib/testing/test-data-domains"

const args = process.argv.slice(2)
const dryRun = args.includes("--seco")
const extraDomains = args
  .filter((arg) => arg.startsWith("--dominio="))
  .map((arg) => arg.slice("--dominio=".length).trim().toLowerCase())
  .filter(Boolean)

async function main() {
  if (dryRun) console.log("Modo seco: no se borra nada.\n")

  const suffixes = [...TEST_DATA_EMAIL_SUFFIXES, ...extraDomains.map((domain) => `@${domain.replace(/^@/, "")}`)]

  const leads = await prisma.lead.findMany({
    where: { OR: suffixes.map((suffix) => ({ emailNormalized: { endsWith: suffix } })) },
    select: { id: true, emailNormalized: true },
  })

  // Desglose por dominio: es lo que permite ver de un vistazo si aparece algo que
  // no se esperaba antes de borrarlo.
  const byDomain = new Map<string, number>()
  for (const lead of leads) {
    const domain = lead.emailNormalized.split("@")[1] ?? "(sin dominio)"
    byDomain.set(domain, (byDomain.get(domain) ?? 0) + 1)
  }

  console.log(`Contactos de prueba encontrados: ${leads.length}`)
  for (const [domain, count] of [...byDomain.entries()].sort((a, b) => b[1] - a[1])) {
    const explicito = extraDomains.includes(domain) ? "  (indicado con --dominio)" : ""
    console.log(`  ${String(count).padStart(5)}  @${domain}${explicito}`)
  }

  const ids = leads.map((lead) => lead.id)

  // Se cuenta lo que arrastra la cascada ANTES de borrar: después ya no habría
  // forma de decir cuánto se llevó.
  if (ids.length) {
    const [requests, consents, activities, notes, tasks, vipSessions, interactions, notifications] = await Promise.all([
      prisma.leadRequest.count({ where: { leadId: { in: ids } } }),
      prisma.consentEvent.count({ where: { leadId: { in: ids } } }),
      prisma.leadActivity.count({ where: { leadId: { in: ids } } }),
      prisma.leadNote.count({ where: { leadId: { in: ids } } }),
      prisma.followUpTask.count({ where: { leadId: { in: ids } } }),
      prisma.vipAccessSession.count({ where: { leadId: { in: ids } } }),
      prisma.contentInteraction.count({ where: { leadId: { in: ids } } }),
      prisma.notificationLog.count({ where: { leadId: { in: ids } } }),
    ])

    console.log("\nArrastra por cascada:")
    console.log(`  solicitudes:     ${requests}`)
    console.log(`  consentimientos: ${consents}`)
    console.log(`  actividades:     ${activities}`)
    console.log(`  notas:           ${notes}`)
    console.log(`  tareas:          ${tasks}`)
    console.log(`  sesiones VIP:    ${vipSessions}`)
    console.log(`  interacciones:   ${interactions}`)
    console.log(`  notificaciones:  ${notifications}`)
  }

  const restantes = await prisma.lead.count({ where: { id: { notIn: ids } } })
  console.log(`\nContactos que NO se tocan: ${restantes}`)

  if (dryRun || !ids.length) {
    if (!ids.length) console.log("\nNada que borrar.")
    return
  }

  const { count } = await prisma.lead.deleteMany({ where: { id: { in: ids } } })
  console.log(`\nBorrados: ${count} contactos con su historial completo.`)
  console.log(`Quedan en la base: ${await prisma.lead.count()} contactos.`)
  console.log("Los AuditEvent se conservan: la auditoría no desaparece con lo auditado.")
}

main()
  .catch((error) => {
    console.error("No se han podido limpiar los datos de prueba:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
