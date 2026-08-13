/**
 * Dispara el resumen interno de tareas vencidas.
 *
 * `npm run notify:overdue`
 *
 * **Nada ejecuta este script solo.** Es la mitad fiable del caso 3 del Prompt 8: el
 * envío funciona y queda registrado, pero el proyecto no tiene programador. Hasta
 * que se conecte a uno (Vercel Cron o equivalente), el aviso es manual, y así está
 * documentado en docs/email.md §7 en lugar de dar por hecha una periodicidad que
 * nadie garantiza.
 *
 * No se ha expuesto como endpoint HTTP a propósito: una ruta que envía correos sin
 * exigir sesión es una vía de abuso, y protegerla con un secreto compartido es una
 * decisión de despliegue que corresponde a la fase de endurecimiento.
 */
import { prisma } from "../lib/db"
import { readEmailConfig } from "../lib/email/config"
import { notifyOverdueTasks } from "../lib/notifications/overdue-tasks"

async function main() {
  const config = readEmailConfig()
  const outcome = await notifyOverdueTasks(new Date(), config)

  if (!outcome.sent) {
    const explanation = {
      "no-overdue-tasks": "No hay tareas vencidas: no se envía nada.",
      cooldown: "Ya se envió un resumen hace poco; se omite para no repetirlo.",
      "no-recipients": "LEADS_NOTIFICATION_TO está vacía: no hay a quién avisar.",
    }[outcome.reason]
    console.log(explanation)
    return
  }

  console.log(`Resumen de ${outcome.taskCount} tareas vencidas. Estado del envío: ${outcome.status}.`)

  if (outcome.status === "SKIPPED_CONFIG") {
    console.log("No se envió nada porque falta configuración de correo (ver .env.example).")
  }
  if (outcome.status === "RETRY_PENDING") {
    console.log("Fallo transitorio. Nada lo reintenta automáticamente: vuelve a ejecutar el comando.")
  }
}

main()
  .catch((error) => {
    console.error("No se pudo completar el aviso de tareas vencidas:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
