/**
 * Sembrado de **demostración**. Nunca se ejecuta solo: hay que pedirlo.
 *
 * Deja el proyecto en un estado presentable para una evaluación: las seis fichas
 * de ejemplo publicadas, un equipo con los tres roles, y un CRM con contactos,
 * solicitudes repartidas por el pipeline, tareas y notas. Sin esto, el panel se
 * ve correcto pero vacío, y un CRM vacío no demuestra nada.
 *
 * Uso: npm run demo:seed
 *
 * **Idempotente.** Se puede ejecutar tantas veces como haga falta: cada pieza
 * comprueba si ya existe antes de crearla y ninguna se duplica. No borra nada; para
 * eso está `npm run demo:clean`.
 *
 * **Datos ficticios, y comprobable.** Todos los contactos y usuarios de la demo
 * usan el dominio `demo.portondelacondesa.test`: `.test` es un TLD reservado
 * (RFC 2606) que no resuelve, así que ninguna dirección de aquí puede recibir un
 * correo por error. Ese dominio es también la marca que usa `demo:clean` para
 * saber qué borrar.
 *
 * **La cuenta de evaluación se declara por entorno**, no en el código:
 *   DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD (mínimo 12 caracteres)
 * El script no imprime nunca la contraseña. Se entrega por canal privado y se
 * retira con `npm run demo:clean -- --cuenta`. Ver docs/runbook-demo.md.
 */
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { createContentEntry } from "@/lib/domain/content"
import { createLeadRequest, changeLeadRequestStatus } from "@/lib/domain/lead-requests"
import { createFollowUpTask } from "@/lib/domain/tasks"
import { addLeadNote } from "@/lib/domain/notes"
import { recordConsent } from "@/lib/domain/consents"
import { demoStoryToContentEntry } from "@/lib/content/demo-stories"
import { demoLeadEmail } from "@/lib/domain/demo"
import { PRIVACY_POLICY_VERSION } from "@/lib/legal"
import { weddingStories, cateringStories, type VipStory } from "@/data/vip-stories"
import type { ContentType, LeadRequestStatus, Priority, Role } from "@prisma/client"

// ---------------------------------------------------------------------------
// Equipo de demostración
// ---------------------------------------------------------------------------

/**
 * Los tres roles, para poder enseñar que el panel cambia según quién entra.
 *
 * **Sin contraseña**: no se les crea cuenta `credential`, así que no pueden
 * iniciar sesión. Existen para aparecer como responsables de tareas y autores de
 * notas, que es lo que hace creíble el historial del CRM. Crear tres cuentas con
 * contraseña conocida sería regalar tres puertas de entrada al panel.
 */
const DEMO_TEAM: Array<{ email: string; name: string; role: Role }> = [
  { email: demoLeadEmail("laura.comercial"), name: "Laura Nieto (demo)", role: "SALES" },
  { email: demoLeadEmail("marcos.contenido"), name: "Marcos Vidal (demo)", role: "CONTENT" },
  { email: demoLeadEmail("ana.direccion"), name: "Ana Belmonte (demo)", role: "ADMIN" },
]

// ---------------------------------------------------------------------------
// Contactos y solicitudes
// ---------------------------------------------------------------------------

/**
 * Ocho solicitudes que cubren el recorrido comercial completo: desde una recién
 * llegada hasta una ganada y una perdida con su motivo. Los estados se alcanzan
 * **moviendo la solicitud por las transiciones reales** del dominio, no
 * escribiendo el estado final a mano: así el historial y la auditoría de la demo
 * son los mismos que produciría el uso normal.
 */
type DemoRequest = {
  local: string
  firstName: string
  lastName: string
  phone?: string
  eventType: string
  guestCount?: number
  eventDateOffsetDays?: number
  preferredSpace?: string
  budgetRange?: string
  subject: string
  message: string
  company?: string
  jobTitle?: string
  marketing: boolean
  /** Camino de estados, en orden. Cada paso debe ser una transición permitida. */
  path: LeadRequestStatus[]
  lostReason?: string
  note?: string
  task?: { title: string; dueInDays: number; priority: Priority }
}

const DEMO_REQUESTS: DemoRequest[] = [
  {
    local: "marta.gil",
    firstName: "Marta",
    lastName: "Gil Herrera",
    phone: "+34 646 001 122",
    eventType: "WEDDING",
    guestCount: 150,
    eventDateOffsetDays: 320,
    preferredSpace: "salon-porton",
    budgetRange: "20000-35000",
    subject: "Boda en primavera para unos 150 invitados",
    message:
      "Nos casamos en primavera del año que viene y queremos ceremonia en el jardín. ¿Podemos visitar la finca un sábado por la mañana?",
    marketing: true,
    path: [],
    note: "Entra por Instagram. Muy interesada en la ceremonia al aire libre.",
  },
  {
    local: "javier.rosales",
    firstName: "Javier",
    lastName: "Rosales Puig",
    phone: "+34 646 002 233",
    eventType: "WEDDING",
    guestCount: 90,
    eventDateOffsetDays: 210,
    preferredSpace: "salon-conde",
    subject: "Boda íntima entre olivos",
    message: "Somos 90 personas y buscamos algo recogido. Nos gustó mucho el reportaje de la boda de otoño.",
    marketing: false,
    path: ["CONTACTED"],
    task: { title: "Enviar dossier de bodas íntimas", dueInDays: 2, priority: "NORMAL" },
  },
  {
    local: "elena.marquez",
    firstName: "Elena",
    lastName: "Márquez Soler",
    phone: "+34 646 003 344",
    eventType: "COMMUNION",
    guestCount: 60,
    eventDateOffsetDays: 120,
    preferredSpace: "salon-cristal",
    subject: "Comunión de mi hija en mayo",
    message: "Buscamos comida al mediodía para unas 60 personas, con zona de juegos para los niños.",
    marketing: true,
    path: ["CONTACTED", "QUALIFIED"],
    note: "Pide menú infantil y sombra en la terraza. Presupuesto ajustado.",
  },
  {
    local: "grupo.tecnalis",
    firstName: "Rocío",
    lastName: "Andrade Vega",
    phone: "+34 646 004 455",
    eventType: "CORPORATE_EVENT",
    guestCount: 120,
    eventDateOffsetDays: 75,
    company: "Tecnalis Soluciones",
    jobTitle: "Responsable de eventos",
    preferredSpace: "salon-porton",
    budgetRange: "20000-35000",
    subject: "Convención anual de la empresa",
    message: "Necesitamos proyector, sonido y streaming para la sesión de la mañana, y comida para 120 personas.",
    marketing: false,
    path: ["CONTACTED", "QUALIFIED", "VISIT_SCHEDULED"],
    task: { title: "Confirmar necesidades audiovisuales con el proveedor", dueInDays: 5, priority: "HIGH" },
  },
  {
    local: "pablo.iranzo",
    firstName: "Pablo",
    lastName: "Iranzo Cano",
    phone: "+34 646 005 566",
    eventType: "EXTERNAL_CATERING",
    guestCount: 200,
    eventDateOffsetDays: 45,
    subject: "Catering para una inauguración",
    message: "El evento es fuera de la finca, en nuestras oficinas. Queremos algo de picoteo de nivel para 200 personas.",
    marketing: true,
    path: ["CONTACTED", "QUALIFIED", "VISIT_SCHEDULED", "PROPOSAL_SENT"],
    note: "Propuesta enviada el mismo día de la visita. Pendiente de respuesta.",
  },
  {
    local: "carmen.ortuno",
    firstName: "Carmen",
    lastName: "Ortuño Lax",
    phone: "+34 646 006 677",
    eventType: "ANNIVERSARY",
    guestCount: 40,
    eventDateOffsetDays: 60,
    preferredSpace: "sin-preferencia",
    subject: "Cincuenta aniversario de mis padres",
    message: "Somos pocos pero queremos que sea especial. Aconsejadnos el espacio.",
    marketing: false,
    path: ["CONTACTED", "QUALIFIED", "VISIT_SCHEDULED", "PROPOSAL_SENT", "NEGOTIATION"],
    task: { title: "Llamar para cerrar la fecha", dueInDays: -1, priority: "URGENT" },
  },
  {
    local: "lucia.bernal",
    firstName: "Lucía",
    lastName: "Bernal Ruiz",
    phone: "+34 646 007 788",
    eventType: "WEDDING",
    guestCount: 180,
    eventDateOffsetDays: 400,
    preferredSpace: "salon-porton",
    budgetRange: "mas-35000",
    subject: "Boda de septiembre, 180 invitados",
    message: "Ya hemos visitado la finca y nos ha encantado. Queremos reservar la fecha.",
    marketing: true,
    path: ["CONTACTED", "QUALIFIED", "VISIT_SCHEDULED", "PROPOSAL_SENT", "NEGOTIATION", "WON"],
    note: "Firmado. Se envía calendario de pagos.",
  },
  {
    local: "sergio.valera",
    firstName: "Sergio",
    lastName: "Valera Moya",
    eventType: "CIVIL_CEREMONY",
    guestCount: 70,
    eventDateOffsetDays: 30,
    subject: "Ceremonia civil en un mes",
    message: "Sé que es con poco margen. ¿Tenéis disponibilidad?",
    marketing: false,
    path: ["CONTACTED", "LOST"],
    lostReason: "La fecha solicitada ya estaba reservada y no aceptaron ninguna alternativa.",
  },
]

// ---------------------------------------------------------------------------

function daysFromNow(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

async function seedContent(): Promise<void> {
  const entries: Array<{ story: VipStory; type: ContentType }> = [
    ...weddingStories.map((story) => ({ story, type: "REAL_WEDDING" as const })),
    ...cateringStories.map((story) => ({ story, type: "CATERING_EVENT" as const })),
  ]

  let created = 0
  for (const { story, type } of entries) {
    const existing = await prisma.contentEntry.findUnique({ where: { type_slug: { type, slug: story.slug } } })
    if (existing) continue
    await createContentEntry(demoStoryToContentEntry(story, type))
    created++
  }

  console.log(`Fichas de ejemplo: ${created} creadas, ${entries.length - created} ya existían (todas isDemo=true)`)
}

async function seedTeam(): Promise<Map<Role, string>> {
  const byRole = new Map<Role, string>()

  for (const member of DEMO_TEAM) {
    const email = member.email.toLowerCase()
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name: member.name, role: member.role, emailVerified: true },
      update: { name: member.name, role: member.role },
    })
    byRole.set(member.role, user.id)
  }

  console.log(`Equipo de demostración: ${DEMO_TEAM.length} usuarios sin contraseña (no pueden iniciar sesión)`)
  return byRole
}

/**
 * Cuenta de evaluación con contraseña utilizable.
 *
 * Es la única cuenta de la demo que puede entrar al panel. Se crea igual que el
 * bootstrap del primer ADMIN (misma API interna de Better Auth) y **no se
 * sobrescribe** si ya existe: volver a sembrar no debe cambiarle la contraseña a
 * quien esté en medio de una evaluación.
 */
async function seedEvaluationAccount(): Promise<void> {
  const email = process.env.DEMO_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.DEMO_ADMIN_PASSWORD

  if (!email || !password) {
    console.log(
      "Cuenta de evaluación: omitida (define DEMO_ADMIN_EMAIL y DEMO_ADMIN_PASSWORD para crearla). " +
        "Ver docs/runbook-demo.md §2."
    )
    return
  }

  if (password.length < 12) {
    throw new Error("DEMO_ADMIN_PASSWORD debe tener al menos 12 caracteres (minPasswordLength de Better Auth).")
  }

  const ctx = await auth.$context
  const existing = await ctx.internalAdapter.findUserByEmail(email)
  if (existing?.user) {
    console.log(`Cuenta de evaluación: ya existe (${email}); no se toca ni su contraseña ni su rol.`)
    return
  }

  const user = await ctx.internalAdapter.createUser({
    name: "Cuenta de evaluación",
    email,
    emailVerified: true,
    role: "ADMIN",
  })
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await ctx.password.hash(password),
  })

  // La contraseña no se imprime: se entrega por canal privado.
  console.log(`Cuenta de evaluación creada: ${email} (rol ADMIN).`)
  console.log("Entrega la contraseña por canal privado y retira DEMO_ADMIN_PASSWORD del entorno.")
}

async function seedCrm(team: Map<Role, string>): Promise<void> {
  const sales = team.get("SALES")
  const admin = team.get("ADMIN")

  let created = 0
  for (const demo of DEMO_REQUESTS) {
    const email = demoLeadEmail(demo.local)

    // Idempotencia: la clave del envío identifica la solicitud de forma estable,
    // así que una segunda ejecución no crea nada nuevo (createLeadRequest
    // devuelve `duplicate: true`).
    const { lead, leadRequest, duplicate } = await createLeadRequest({
      email,
      firstName: demo.firstName,
      lastName: demo.lastName,
      phone: demo.phone,
      eventType: demo.eventType,
      eventDate: demo.eventDateOffsetDays ? daysFromNow(demo.eventDateOffsetDays) : undefined,
      guestCount: demo.guestCount,
      company: demo.company,
      jobTitle: demo.jobTitle,
      preferredSpace: demo.preferredSpace,
      budgetRange: demo.budgetRange,
      subject: demo.subject,
      message: demo.message,
      sourcePage: "/",
      sourceForm: "contact-home",
      submissionId: `demo-${demo.local}`,
      consents: {
        privacyConsent: true,
        marketingConsent: demo.marketing,
        policyVersion: PRIVACY_POLICY_VERSION,
      },
    })

    if (duplicate) continue
    created++

    // El consentimiento de marketing solo se registra cuando se concedió: es la
    // misma regla que el gate (lib/domain/vip-access.ts).
    if (demo.marketing) {
      await recordConsent({
        leadId: lead.id,
        purpose: "MARKETING",
        granted: true,
        policyVersion: PRIVACY_POLICY_VERSION,
        source: "demo-seed",
      })
    }

    for (const status of demo.path) {
      await changeLeadRequestStatus({
        leadRequestId: leadRequest.id,
        nextStatus: status,
        actorId: sales ?? admin,
        lostReason: status === "LOST" ? demo.lostReason : undefined,
      })
    }

    if (demo.note) {
      await addLeadNote({ leadId: lead.id, body: demo.note, authorId: sales ?? admin })
    }

    if (demo.task) {
      await createFollowUpTask({
        leadId: lead.id,
        title: demo.task.title,
        dueAt: daysFromNow(demo.task.dueInDays),
        priority: demo.task.priority,
        assigneeId: sales,
        leadRequestId: leadRequest.id,
        actorId: sales ?? admin,
      })
    }
  }

  console.log(`Solicitudes de demostración: ${created} creadas, ${DEMO_REQUESTS.length - created} ya existían`)
}

async function main() {
  // Las reglas de scoring son requisito: sin ellas todos los contactos de la demo
  // se quedarían a 0 puntos y el pipeline no enseñaría nada.
  const rules = await prisma.scoringRule.count()
  if (rules === 0) {
    throw new Error("No hay reglas de scoring. Ejecuta primero `npm run db:seed`.")
  }

  await seedContent()
  const team = await seedTeam()
  await seedEvaluationAccount()
  await seedCrm(team)

  console.log("Demo lista. Para retirarla: npm run demo:clean (ver docs/runbook-demo.md).")
}

main()
  .catch((error) => {
    console.error("No se ha podido sembrar la demo:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
