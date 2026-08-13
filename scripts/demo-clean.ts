/**
 * Retira los datos de demostración.
 *
 * Uso:
 *   npm run demo:clean                 → borra contactos y fichas de demostración
 *   npm run demo:clean -- --cuenta     → además desactiva la cuenta de evaluación
 *   npm run demo:clean -- --seco       → solo informa de lo que borraría
 *
 * **No borra nada que no sea de la demo.** Los contactos y usuarios ficticios se
 * identifican por el dominio `demo.portondelacondesa.test` (ver lib/domain/demo.ts)
 * y las fichas por `isDemo = true`. Un contacto real no puede coincidir con
 * ninguno de los dos criterios.
 *
 * **"Desactivar la cuenta" no es borrarla.** Se le quitan las credenciales y se
 * revocan sus sesiones, de modo que no puede volver a entrar, pero el usuario sigue
 * existiendo: `AuditEvent.actorId` apunta a él, y borrarlo dejaría el registro de
 * auditoría de la demo sin autor. Si se quiere borrar del todo, se hace a mano y
 * a conciencia.
 */
import { prisma } from "@/lib/db"
import { DEMO_LEAD_EMAIL_DOMAIN } from "@/lib/domain/demo"

const args = process.argv.slice(2)
const alsoAccount = args.includes("--cuenta")
const dryRun = args.includes("--seco")

const emailSuffix = `@${DEMO_LEAD_EMAIL_DOMAIN}`

async function main() {
  if (dryRun) console.log("Modo seco: no se borra nada.\n")

  // --- Contactos de demostración -------------------------------------------
  // El borrado en cascada del esquema se lleva por delante solicitudes,
  // consentimientos, actividades, notas, interacciones, tareas, sesiones VIP y
  // notificaciones de cada contacto (ver prisma/schema.prisma: onDelete Cascade).
  const leads = await prisma.lead.findMany({
    where: { emailNormalized: { endsWith: emailSuffix } },
    select: { id: true, email: true },
  })
  console.log(`Contactos de demostración: ${leads.length}`)

  if (!dryRun && leads.length) {
    const { count } = await prisma.lead.deleteMany({ where: { id: { in: leads.map((lead) => lead.id) } } })
    console.log(`  borrados: ${count} (con su historial completo por cascada)`)
  }

  // --- Fichas de ejemplo ----------------------------------------------------
  const demoEntries = await prisma.contentEntry.findMany({
    where: { isDemo: true },
    select: { id: true, slug: true, media: { select: { storagePath: true } } },
  })
  console.log(`Fichas de ejemplo (isDemo): ${demoEntries.length}`)

  // Las fichas sembradas apuntan a imágenes de `/public`, así que normalmente no
  // hay nada en el bucket. Pero si alguien ha editado la demo desde el panel y ha
  // subido fotos, borrar solo las filas dejaría esos objetos huérfanos para
  // siempre: nadie volvería a saber que existen. Se borran del bucket primero,
  // porque después de borrar las filas ya no habría lista de qué borrar.
  const demoPaths = demoEntries.flatMap((entry) =>
    entry.media.map((media) => media.storagePath).filter((path): path is string => Boolean(path))
  )

  if (demoPaths.length) {
    // Solo los objetos que no comparta ninguna ficha ajena a la demo: "duplicar
    // como borrador" reutiliza el mismo `storagePath` (ver deleteContentMedia).
    const compartidos = await prisma.contentMedia.findMany({
      where: { storagePath: { in: demoPaths }, contentEntry: { isDemo: false } },
      select: { storagePath: true },
    })
    const compartidosSet = new Set(compartidos.map((media) => media.storagePath))
    const borrables = [...new Set(demoPaths)].filter((path) => !compartidosSet.has(path))

    console.log(`  archivos en el bucket: ${demoPaths.length} (borrables: ${borrables.length})`)

    if (!dryRun && borrables.length) {
      const { isStorageConfigured, getStorageClient, VIP_CONTENT_BUCKET } = await import("@/lib/storage/supabase")
      if (!isStorageConfigured()) {
        console.warn(
          "  Aviso: Storage no está configurado, así que esos archivos NO se han borrado del bucket. " +
            "Configura SUPABASE_URL y la clave privilegiada y vuelve a ejecutar antes de borrar las fichas."
        )
        process.exitCode = 1
        return
      }
      const { error } = await getStorageClient().storage.from(VIP_CONTENT_BUCKET).remove(borrables)
      if (error) {
        console.error(`  No se han podido borrar los archivos del bucket: ${error.message}`)
        console.error("  Se aborta antes de tocar la base de datos para no dejar objetos huérfanos.")
        process.exitCode = 1
        return
      }
      console.log(`  archivos borrados del bucket: ${borrables.length}`)
    }
  }

  if (!dryRun && demoEntries.length) {
    const { count } = await prisma.contentEntry.deleteMany({ where: { isDemo: true } })
    console.log(`  fichas borradas: ${count}`)
  }

  // --- Usuarios del equipo de demostración ---------------------------------
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: emailSuffix } },
    select: { id: true, email: true, role: true },
  })
  console.log(`Usuarios de demostración: ${demoUsers.length}`)

  if (!dryRun && demoUsers.length) {
    // Se revocan sus sesiones primero: un usuario borrado con sesión viva no
    // debería existir, y el orden lo hace explícito en vez de confiar en la cascada.
    await prisma.session.deleteMany({ where: { userId: { in: demoUsers.map((user) => user.id) } } })
    const { count } = await prisma.user.deleteMany({ where: { id: { in: demoUsers.map((user) => user.id) } } })
    console.log(`  borrados: ${count}`)
  }

  // --- Cuenta de evaluación -------------------------------------------------
  if (!alsoAccount) {
    console.log("\nCuenta de evaluación: intacta (usa `--cuenta` para desactivarla).")
    return
  }

  const email = process.env.DEMO_ADMIN_EMAIL?.trim().toLowerCase()
  if (!email) {
    console.warn("\nNo se puede desactivar la cuenta de evaluación: falta DEMO_ADMIN_EMAIL en el entorno.")
    process.exitCode = 1
    return
  }

  const account = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } })
  if (!account) {
    console.log(`\nCuenta de evaluación (${email}): no existe, nada que desactivar.`)
    return
  }

  console.log(`\nCuenta de evaluación: ${account.email}`)
  if (dryRun) {
    console.log("  se le quitarían las credenciales y se revocarían sus sesiones")
    return
  }

  const sessions = await prisma.session.deleteMany({ where: { userId: account.id } })
  const credentials = await prisma.account.deleteMany({ where: { userId: account.id, providerId: "credential" } })
  console.log(`  sesiones revocadas: ${sessions.count}; credenciales retiradas: ${credentials.count}`)
  console.log("  el usuario se conserva porque la auditoría de la demo le apunta como autor.")
}

main()
  .catch((error) => {
    console.error("No se ha podido limpiar la demo:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
