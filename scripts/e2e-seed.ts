/**
 * Prepara la base de pruebas para una ejecución de E2E.
 *
 * Es destructivo por diseño: vacía todas las tablas y vuelve a sembrar el mismo
 * escenario, de modo que cada ejecución parte de un estado idéntico. Por eso
 * `prepareE2eEnvironment()` es lo primero que se ejecuta: valida que la base es
 * desechable **antes** de abrir la primera conexión (lib/testing/e2e-database-guard.ts).
 *
 * Uso: npm run e2e:seed
 *
 * Datos: todos ficticios. Los emails usan el TLD reservado `.test` (RFC 2606),
 * que por definición no resuelve, así que ninguna prueba puede escribir a una
 * persona real ni por accidente.
 */
import { prepareE2eEnvironment } from "./e2e-env"

// ---------------------------------------------------------------------------
// Identificadores estables del escenario
// ---------------------------------------------------------------------------
// Las pruebas los importan desde aquí en vez de repetir literales: si cambia el
// escenario, cambia en un solo sitio.

export const E2E_FIXTURES = {
  wedding: {
    slug: "boda-e2e-lavanda",
    title: "Boda de pruebas E2E — Lavanda",
    subtitle: "Escenario ficticio para las pruebas automatizadas",
  },
  catering: {
    slug: "catering-e2e-corporativo",
    title: "Catering de pruebas E2E — Corporativo",
    subtitle: "Escenario ficticio para las pruebas automatizadas",
  },
  /** Visitante que ya existía antes de la ejecución: lo usa el escenario del CRM. */
  existingLead: {
    email: "carmen.solicitud@ejemplo.test",
    firstName: "Carmen",
    lastName: "Ruiz Ficticia",
    subject: "Solicitud sembrada para las pruebas del CRM",
  },
} as const

/**
 * Todo el cuerpo va dentro de una función asíncrona porque los módulos que leen
 * el entorno (`lib/db.ts`, `lib/auth.ts`) tienen que importarse **después** de
 * que `prepareE2eEnvironment()` haya reescrito las variables, y los scripts de
 * este proyecto se transpilan a CommonJS (sin `await` de nivel superior).
 */
async function seed(): Promise<void> {
  const environment = prepareE2eEnvironment()
  console.log(`Base de pruebas: ${environment.database}`)

  const { prisma } = await import("@/lib/db")
  const { auth } = await import("@/lib/auth")
  const { createContentEntry } = await import("@/lib/domain/content")
  const { createLeadRequest } = await import("@/lib/domain/lead-requests")
  const { isStorageConfigured, getStorageClient, VIP_CONTENT_BUCKET } = await import("@/lib/storage/supabase")
  const { PRIVACY_POLICY_VERSION } = await import("@/lib/legal")

  // -------------------------------------------------------------------------
  // Limpieza
  // -------------------------------------------------------------------------

  /**
   * Borra del bucket los objetos que subieron ejecuciones anteriores.
   *
   * Se hace **antes** de vaciar la base porque la única lista fiable de lo que
   * subieron las pruebas son sus propias filas `ContentMedia`: si se truncan
   * primero, los objetos quedan huérfanos en el bucket para siempre.
   *
   * Supabase Storage no tiene equivalente local, así que las pruebas usan el
   * bucket real del proyecto. Esta función es lo que evita que se acumule basura.
   */
  async function purgeStorageObjects(): Promise<number> {
    const media = await prisma.contentMedia.findMany({
      where: { storagePath: { not: null } },
      select: { storagePath: true },
    })
    // Los hero sembrados apuntan a objetos que nunca existieron: pedir su
    // borrado no falla, pero tampoco aporta nada, así que se descartan.
    const paths = media.map((row) => row.storagePath as string).filter((path) => !path.startsWith("e2e/"))
    if (!paths.length) return 0

    if (!isStorageConfigured()) {
      console.warn(
        `Aviso: hay ${paths.length} objeto(s) subido(s) por pruebas anteriores y Storage no está ` +
          "configurado, así que no se pueden borrar del bucket. Quedarán huérfanos."
      )
      return 0
    }

    const { error } = await getStorageClient().storage.from(VIP_CONTENT_BUCKET).remove(paths)
    if (error) {
      console.warn(`Aviso: no se han podido borrar ${paths.length} objeto(s) del bucket: ${error.message}`)
      return 0
    }
    return paths.length
  }

  /**
   * Vacía todas las tablas de la aplicación.
   *
   * La lista se consulta al catálogo en vez de escribirse a mano: una tabla
   * nueva añadida en una migración futura se vaciaría igual, sin que nadie
   * tenga que acordarse de venir aquí. Se excluye `_prisma_migrations` porque
   * borrarla haría que `migrate deploy` volviese a aplicar todo sobre un
   * esquema que ya existe.
   */
  async function truncateAll(): Promise<number> {
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name <> '_prisma_migrations'
    `

    if (!tables.length) {
      throw new Error(
        "No se ha encontrado ninguna tabla en la base de pruebas. " +
          "¿Has aplicado las migraciones? (npm run e2e:db:migrate)"
      )
    }

    const quoted = tables.map((row) => `"public"."${row.table_name}"`).join(", ")
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`)
    return tables.length
  }

  // -------------------------------------------------------------------------
  // Sembrado
  // -------------------------------------------------------------------------

  /**
   * Crea los tres usuarios del escenario con contraseña utilizable.
   *
   * Usa la misma vía interna que `scripts/admin-bootstrap.ts`: el alta pública
   * está deshabilitada a propósito y las pruebas no son una excepción. Si las
   * E2E pudieran registrarse por la API pública, estarían probando un camino
   * que en producción no existe.
   */
  async function seedUsers(): Promise<void> {
    const ctx = await auth.$context

    for (const account of Object.values(environment.accounts)) {
      const user = await ctx.internalAdapter.createUser({
        name: account.name,
        email: account.email.toLowerCase(),
        emailVerified: true,
        role: account.role,
      })
      await ctx.internalAdapter.linkAccount({
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: await ctx.password.hash(account.password),
      })
    }

    console.log(`Usuarios: ${Object.values(environment.accounts).length} (ADMIN, SALES, CONTENT)`)
  }

  /**
   * Reglas de scoring. No son datos de ejemplo: son configuración operativa que
   * el CRM necesita para puntuar (lib/domain/scoring.ts). Sin ellas el escenario
   * de solicitudes puntuaría 0 y la prueba comprobaría lo contrario de lo que cree.
   */
  async function seedScoringRules(): Promise<void> {
    const rules = [
      { key: "FORM_SUBMITTED", label: "Formulario enviado", points: 15 },
      { key: "PHONE_PROVIDED", label: "Teléfono informado", points: 10 },
      { key: "EVENT_DATE_PROVIDED", label: "Fecha informada", points: 10 },
      { key: "GUEST_COUNT_PROVIDED", label: "Invitados informados", points: 10 },
      { key: "VIP_ACCESS", label: "Acceso VIP", points: 10 },
      { key: "DOSSIER_DOWNLOAD", label: "Descarga de dossier", points: 15 },
      { key: "CONTENT_VIEWED_3PLUS", label: "3 o más reportajes consultados", points: 10 },
      { key: "VISIT_REQUESTED", label: "Solicitud de visita", points: 25 },
    ]

    await prisma.scoringRule.createMany({ data: rules })
    console.log(`Reglas de scoring: ${rules.length}`)
  }

  /**
   * Dos fichas publicadas, una por biblioteca. Se crean ya con
   * `status: "PUBLISHED"` en vez de pasar por `publishContentEntry` porque su
   * hero apunta a un objeto que no existe en el bucket: publicar exige alt en la
   * imagen principal (`getMissingPublicationRequirements`), y el escenario que
   * recorre ese camino completo es el 8, con una subida real.
   *
   * Las tarjetas se renderizan sin imagen (firmar un objeto inexistente
   * devuelve null y `StoryCard` lo tolera), que es exactamente lo que necesitan
   * las pruebas de listado: título, enlace y ruta.
   */
  async function seedPublishedContent(): Promise<void> {
    const common = {
      status: "PUBLISHED" as const,
      isDemo: true,
      season: "Primavera",
      space: "Salón El Portón",
      priceFrom: 12000,
      priceTo: 18000,
      priceCurrency: "EUR",
    }

    await createContentEntry({
      ...common,
      type: "REAL_WEDDING",
      slug: E2E_FIXTURES.wedding.slug,
      translations: {
        es: {
          title: E2E_FIXTURES.wedding.title,
          subtitle: E2E_FIXTURES.wedding.subtitle,
          intro: "Ficha ficticia creada por scripts/e2e-seed.ts. No corresponde a ningún evento real.",
        },
      },
      media: [
        {
          type: "IMAGE",
          storagePath: "e2e/hero-inexistente.jpg",
          alt: "Imagen de ejemplo del escenario de pruebas",
          isHero: true,
          sortOrder: 0,
        },
      ],
      highlights: [{ label: "Ceremonia en el jardín" }, { label: "Cena bajo los olivos" }],
      timeline: [
        { time: "18:00", moment: "Ceremonia" },
        { time: "20:00", moment: "Cena" },
      ],
    })

    await createContentEntry({
      ...common,
      type: "CATERING_EVENT",
      slug: E2E_FIXTURES.catering.slug,
      translations: {
        es: {
          title: E2E_FIXTURES.catering.title,
          subtitle: E2E_FIXTURES.catering.subtitle,
          intro: "Ficha ficticia creada por scripts/e2e-seed.ts. No corresponde a ningún evento real.",
        },
      },
      media: [
        {
          type: "IMAGE",
          storagePath: "e2e/hero-catering-inexistente.jpg",
          alt: "Imagen de ejemplo del escenario de pruebas",
          isHero: true,
          sortOrder: 0,
        },
      ],
      menuSections: [{ course: "Aperitivo", items: [{ label: "Salmorejo de temporada" }] }],
    })

    console.log("Fichas publicadas: 2 (1 boda, 1 catering), ambas isDemo=true")
  }

  /**
   * Una solicitud comercial ya existente. El escenario del CRM (el comercial ve
   * una solicitud, crea una tarea y cambia el estado) no debe depender de que el
   * escenario del formulario público se haya ejecutado antes: las pruebas tienen
   * que poder ejecutarse en cualquier orden y de una en una.
   */
  async function seedExistingRequest(): Promise<void> {
    const { leadRequest } = await createLeadRequest({
      email: E2E_FIXTURES.existingLead.email,
      firstName: E2E_FIXTURES.existingLead.firstName,
      lastName: E2E_FIXTURES.existingLead.lastName,
      phone: "+34 600 000 001",
      eventType: "WEDDING",
      guestCount: 140,
      preferredSpace: "salon-porton",
      subject: E2E_FIXTURES.existingLead.subject,
      message: "Mensaje ficticio sembrado para las pruebas del CRM.",
      sourcePage: "/",
      sourceForm: "contact-home",
      submissionId: "e2e-solicitud-sembrada",
      consents: {
        privacyConsent: true,
        marketingConsent: false,
        policyVersion: PRIVACY_POLICY_VERSION,
      },
    })

    console.log(`Solicitud sembrada: ${leadRequest.id} (${E2E_FIXTURES.existingLead.email})`)
  }

  try {
    const purged = await purgeStorageObjects()
    if (purged) console.log(`Objetos borrados del bucket: ${purged}`)

    console.log(`Tablas vaciadas: ${await truncateAll()}`)

    await seedUsers()
    await seedScoringRules()
    await seedPublishedContent()
    await seedExistingRequest()

    console.log("Escenario E2E listo.")
  } finally {
    await prisma.$disconnect()
  }
}

seed().catch((error) => {
  console.error("No se ha podido preparar el escenario E2E:", error)
  process.exitCode = 1
})
