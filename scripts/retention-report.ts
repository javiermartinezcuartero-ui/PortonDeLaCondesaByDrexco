/**
 * Informe de retención: qué contactos superan el plazo y podrían anonimizarse.
 *
 * `npm run privacy:retention`
 *
 * **No anonimiza nada.** Es deliberado: anonimizar es irreversible y afecta a datos
 * de personas, así que no debería poder ocurrir por un cron mal configurado o por un
 * comando ejecutado sin mirar. Este script informa; la anonimización se hace desde
 * la ficha del contacto con confirmación escrita, o llamando a `anonymizeLead` a
 * conciencia.
 *
 * El plazo sale de `DATA_RETENTION_MONTHS` (36 meses por defecto) y **no está
 * validado por un profesional**: ver README §Pendientes legales.
 */
import { prisma } from "../lib/db"
import { findLeadsBeyondRetention, retentionCutoff, retentionMonths } from "../lib/domain/privacy"

async function main() {
  const now = new Date()
  const months = retentionMonths()
  const cutoff = retentionCutoff(now)

  console.log(`Plazo de retención configurado: ${months} meses.`)
  console.log(`Se consideran candidatos los contactos sin actividad desde ${cutoff.toISOString().slice(0, 10)}.`)
  console.log("")

  const candidates = await findLeadsBeyondRetention(now, 500)

  if (candidates.length === 0) {
    console.log("No hay ningún contacto que supere el plazo. Nada que revisar.")
    return
  }

  console.log(`${candidates.length} contactos superan el plazo:`)
  console.log("")
  for (const lead of candidates) {
    const last = lead.lastActivityAt ?? lead.firstSeenAt
    // Solo el identificador y las fechas: la salida de un script acaba en logs.
    console.log(
      `  ${lead.id}  última actividad ${last.toISOString().slice(0, 10)}  solicitudes: ${lead._count.requests}`
    )
  }
  console.log("")
  console.log("Este informe no anonimiza nada. Revisa cada caso en /admin/contactos/<id>.")
  console.log("Se excluyen los contactos con una solicitud viva en el pipeline.")
}

main()
  .catch((error) => {
    console.error("No se pudo generar el informe de retención:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
