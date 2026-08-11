/**
 * Contenido de ejemplo para las bibliotecas VIP de "Bodas reales" y "Catering".
 *
 * IMPORTANTE: son casos ILUSTRATIVOS (nombres, proveedores, menús, precios y
 * opiniones ficticios, y fotografía reutilizada del banco disponible) para
 * mostrar cómo funcionará la sección una vez el equipo publique casos reales.
 * Cada ficha lleva `isExample: true` y la UI debe dejarlo visible. El
 * desglose de precio es orientativo y no debe tratarse como tarifa real hasta
 * que el equipo comercial confirme cifras.
 */

const P1 = { src: "/images/porton/01-boda-civil-jardin.jpg", alt: "Ceremonia civil en el jardín" }
const P2 = { src: "/images/porton/02-salon-celebraciones.jpg", alt: "Salón preparado para el banquete" }
const P3 = { src: "/images/porton/03-boda-civil-invitados.jpg", alt: "Invitados durante la ceremonia" }
const P4 = { src: "/images/porton/04-exterior-finca.jpg", alt: "Exterior de la finca" }
const P5 = { src: "/images/porton/05-salon-porton-decoracion.jpg", alt: "Salón decorado" }
const G1 = { src: "/images/gastronomia/producto-temporada.jpg", alt: "Emplatado de temporada" }
const G2 = { src: "/images/gastronomia/coctel-banquete.jpg", alt: "Servicio de cóctel" }
const G3 = { src: "/images/gastronomia/adaptado-celebracion.jpg", alt: "Sala dispuesta para banquete" }
const G4 = { src: "/images/gastronomia/salon-celebracion-2.jpg", alt: "Salón con grandes ventanales" }

export type VipProvider = {
  category: string
  name: string
  image: { src: string; alt: string }
  isVideo?: boolean
}

export type VipMenuCourse = {
  course: string
  items: string[]
}

export type VipPriceRange = {
  from: number
  to: number
  currency: string
  note: string
}

export type VipStory = {
  slug: string
  isExample: true
  title: string
  subtitle: string
  season: string
  space: string
  heroImage: { src: string; alt: string }
  gallery: { src: string; alt: string; isVideo?: boolean }[]
  providers: VipProvider[]
  decor: string
  photocall: string
  menu: VipMenuCourse[]
  timing: { time: string; moment: string }[]
  surprises: string[]
  priceRange: VipPriceRange
  weather: string
  restaurantSolutions: string
  testimonialQuote: string
  testimonialAuthor: string
}

export const weddingStories: VipStory[] = [
  {
    slug: "laura-y-marcos",
    isExample: true,
    title: "Laura & Marcos",
    subtitle: "Boda civil de otoño",
    season: "Otoño 2025",
    space: "Salón Portón + jardines",
    heroImage: { ...P1, alt: "Ceremonia civil en el jardín — ejemplo ilustrativo" },
    gallery: [P1, P3, P5, { ...P4, isVideo: true }, G4, { ...P2, isVideo: true }],
    providers: [
      { category: "Floristería", name: "Floristería Ejemplo Flor", image: P5 },
      { category: "Fotografía", name: "Fotografía Ejemplo Studio", image: P3, isVideo: true },
      { category: "Música y DJ", name: "Ejemplo Sound", image: P2 },
      { category: "Vídeo", name: "Ejemplo Films", image: P1, isVideo: true },
      { category: "Pastelería", name: "Pastelería Ejemplo Dulce", image: G1 },
      { category: "Iluminación", name: "Ejemplo Light", image: G4 },
    ],
    decor: "Vegetación colgante, tonos verdes y granates, mesa de novios diferenciada con arco floral.",
    photocall: "Photocall vegetal junto a la entrada del jardín, con firma de invitados.",
    menu: [
      { course: "Cóctel de bienvenida", items: ["Estaciones en jardín", "Jamón cortado a cuchillo", "Copa de bienvenida", "Mini brochetas de solomillo"] },
      { course: "Entrantes", items: ["Ensalada templada de temporada", "Crema fría de tomate y albahaca"] },
      { course: "Principal", items: ["Carrillera ibérica con puré trufado", "Opción de lubina a la plancha"] },
      { course: "Postre", items: ["Tarta de queso con frutos rojos", "Mesa de mignardises"] },
      { course: "Barra de noche", items: ["Barra libre", "Estación de gin-tonics", "Food truck de churros a medianoche"] },
    ],
    timing: [
      { time: "17:30", moment: "Llegada de invitados" },
      { time: "18:00", moment: "Ceremonia civil en jardín" },
      { time: "18:45", moment: "Cóctel y fotografías" },
      { time: "20:30", moment: "Banquete en Salón Portón" },
      { time: "00:00", moment: "Fiesta y barra libre" },
    ],
    surprises: [
      "Vídeo sorpresa de familiares que no pudieron asistir, proyectado antes del postre.",
      "Suelta de mariposas al finalizar la ceremonia.",
      "Serenata de amigos durante el cóctel.",
    ],
    priceRange: {
      from: 8500,
      to: 13500,
      currency: "€",
      note: "Orientativo para 90–120 invitados; varía según menú, decoración y servicios adicionales elegidos.",
    },
    weather: "Tarde templada de octubre, ceremonia al aire libre sin incidencias.",
    restaurantSolutions:
      "Se preparó un plan B de carpa cubierta ante posible lluvia (finalmente no fue necesario) y se adaptó el menú para tres invitados con restricciones alimentarias.",
    testimonialQuote:
      "Desde la primera visita nos hicieron sentir acompañados en cada decisión. El equipo se adaptó a todo lo que pedimos.",
    testimonialAuthor: "Laura & Marcos (ejemplo ilustrativo)",
  },
  {
    slug: "elena-y-david",
    isExample: true,
    title: "Elena & David",
    subtitle: "Boda religiosa con banquete en Salón Zafiro",
    season: "Primavera 2025",
    space: "Salón Zafiro",
    heroImage: { ...P2, alt: "Salón Zafiro preparado para el banquete — ejemplo ilustrativo" },
    gallery: [P2, G2, P4, { ...G4, isVideo: true }, P5, { ...P1, isVideo: true }],
    providers: [
      { category: "Floristería", name: "Floristería Ejemplo Flor", image: P5 },
      { category: "Pastelería", name: "Pastelería Ejemplo Dulce", image: G1 },
      { category: "Iluminación", name: "Ejemplo Light", image: P2 },
      { category: "Animación", name: "Ejemplo Party", image: G4 },
      { category: "Vídeo", name: "Ejemplo Films", image: P4, isVideo: true },
    ],
    decor: "Mantelería color champán, centros bajos con vela y flor blanca, iluminación cálida colgante.",
    photocall: "Rincón lounge con sofás y letras luminosas 'E & D'.",
    menu: [
      { course: "Cóctel de bienvenida", items: ["Showcooking de arroces", "Ostras y encurtidos", "Copa de cava"] },
      { course: "Entrantes", items: ["Carpaccio de gambas con cítricos", "Tartar de atún"] },
      { course: "Principal", items: ["Solomillo con salsa de reducción", "Opción vegetariana de risotto de setas"] },
      { course: "Postre", items: ["Mesa dulce variada", "Tarta nupcial de tres pisos"] },
    ],
    timing: [
      { time: "13:00", moment: "Ceremonia religiosa (externa)" },
      { time: "14:30", moment: "Llegada a la finca y cóctel" },
      { time: "16:00", moment: "Banquete en Salón Zafiro" },
      { time: "19:00", moment: "Café y mesa dulce" },
      { time: "20:00", moment: "Fiesta" },
    ],
    surprises: [
      "Coreografía sorpresa del novio con sus padrinos tras el primer baile.",
      "Photobooth con vídeos de felicitación de invitados internacionales.",
    ],
    priceRange: {
      from: 9500,
      to: 15000,
      currency: "€",
      note: "Orientativo para 100–140 invitados; incluye showcooking y mesa dulce ampliada.",
    },
    weather: "Mediodía soleado de mayo, cóctel disfrutado íntegramente en exteriores.",
    restaurantSolutions:
      "El equipo coordinó los tiempos con la iglesia externa para ajustar el horario del cóctel y evitar esperas a los invitados.",
    testimonialQuote:
      "La coordinación entre la ceremonia y la finca fue perfecta. No tuvimos que preocuparnos de nada el día de la boda.",
    testimonialAuthor: "Elena & David (ejemplo ilustrativo)",
  },
  {
    slug: "judith-y-angel",
    isExample: true,
    title: "Judith & Ángel",
    subtitle: "Boda íntima en Salón Cristal",
    season: "Invierno 2025",
    space: "Salón Cristal",
    heroImage: { ...P5, alt: "Detalle de decoración — ejemplo ilustrativo" },
    gallery: [P5, G1, P1, { ...P3, isVideo: true }, G4, { ...P2, isVideo: true }],
    providers: [
      { category: "Floristería", name: "Floristería Ejemplo Flor", image: P5 },
      { category: "Fotografía", name: "Fotografía Ejemplo Studio", image: P1, isVideo: true },
      { category: "Música clásica", name: "Quartet Ejemplo", image: G4 },
      { category: "Decoración", name: "Ejemplo Corporate", image: G3 },
    ],
    decor: "Velas y candelabros, tonos dorados y blancos, mesa imperial para 40 invitados.",
    photocall: "Ventanales del Salón Cristal como fondo natural, sin atrezzo adicional.",
    menu: [
      { course: "Aperitivo", items: ["Aperitivo cálido de bienvenida", "Copa de bienvenida"] },
      { course: "Entrante", items: ["Crema de castañas con foie"] },
      { course: "Principal", items: ["Lubina a la sal con verduras de temporada"] },
      { course: "Postre", items: ["Coulant de chocolate", "Selección de quesos"] },
    ],
    timing: [
      { time: "12:30", moment: "Ceremonia civil en Salón Cristal" },
      { time: "13:15", moment: "Aperitivo" },
      { time: "14:30", moment: "Banquete" },
      { time: "17:00", moment: "Sobremesa y música en directo" },
    ],
    surprises: [
      "Cuarteto de cuerda sorpresa durante el brindis.",
      "Carta manuscrita de los novios leída por el padrino durante el postre.",
    ],
    priceRange: {
      from: 5500,
      to: 8000,
      currency: "€",
      note: "Orientativo para 30–45 invitados en formato íntimo con música en directo.",
    },
    weather: "Día frío y soleado; la luz natural del Salón Cristal permitió prescindir de iluminación adicional durante el día.",
    restaurantSolutions:
      "Al ser una boda íntima de 40 invitados, se ajustó la disposición del salón para mantener la calidez sin que se percibiera como un espacio vacío.",
    testimonialQuote:
      "Queríamos algo íntimo y el Salón Cristal fue perfecto: luz natural, cercanía y un servicio muy atento.",
    testimonialAuthor: "Judith & Ángel (ejemplo ilustrativo)",
  },
]

export const cateringStories: VipStory[] = [
  {
    slug: "gala-empresa-alcayna",
    isExample: true,
    title: "Gala corporativa — Grupo Ejemplo",
    subtitle: "Catering de gala para 150 comensales",
    season: "Noviembre 2025",
    space: "Catering externo — auditorio en Murcia",
    heroImage: { ...G3, alt: "Montaje de gala — ejemplo ilustrativo" },
    gallery: [G3, G2, G1, { ...G4, isVideo: true }, P2, { ...P4, isVideo: true }],
    providers: [
      { category: "Audiovisuales", name: "Ejemplo AV", image: G4, isVideo: true },
      { category: "Decoración", name: "Ejemplo Corporate", image: G3 },
      { category: "Personal de sala", name: "Ejemplo Staff", image: G2 },
      { category: "Iluminación", name: "Ejemplo Light", image: P2 },
    ],
    decor: "Montaje de gala con mesas redondas, mantelería oscura y centros bajos con velas.",
    photocall: "Photocall con lona corporativa del Grupo Ejemplo en la entrada.",
    menu: [
      { course: "Cóctel de bienvenida", items: ["Showcooking en sala", "Copa de bienvenida"] },
      { course: "Entrante", items: ["Milhojas de foie y manzana"] },
      { course: "Principal", items: ["Magret de pato con puré de boniato", "Opción vegetariana de tarta de verduras"] },
      { course: "Postre", items: ["Selección de mignardises"] },
    ],
    timing: [
      { time: "20:00", moment: "Recepción y cóctel de bienvenida" },
      { time: "21:00", moment: "Entrega de premios" },
      { time: "21:30", moment: "Cena de gala" },
      { time: "23:30", moment: "Música en directo" },
    ],
    surprises: [
      "Vídeo institucional proyectado durante el cóctel.",
      "Sorpresa de fuegos fríos al anunciar al ganador principal.",
    ],
    priceRange: {
      from: 65,
      to: 95,
      currency: "€ / comensal",
      note: "Orientativo según menú, personal de sala desplazado y producción audiovisual contratada.",
    },
    weather: "Evento en interior; no aplica.",
    restaurantSolutions:
      "Se desplazó el equipo de cocina y sala completo al auditorio, replicando el estándar de servicio de la finca fuera de sus instalaciones.",
    testimonialQuote:
      "El equipo de catering se adaptó perfectamente a un espacio que no era el suyo. El servicio fue impecable de principio a fin.",
    testimonialAuthor: "Grupo Ejemplo (ejemplo ilustrativo)",
  },
  {
    slug: "inauguracion-showroom",
    isExample: true,
    title: "Inauguración Showroom Ejemplo",
    subtitle: "Cóctel de inauguración para 80 invitados",
    season: "Junio 2025",
    space: "Catering externo — showroom en Molina de Segura",
    heroImage: { ...G2, alt: "Servicio de cóctel — ejemplo ilustrativo" },
    gallery: [G2, P4, G1, { ...G4, isVideo: true }, G3, { ...P1, isVideo: true }],
    providers: [
      { category: "Decoración floral", name: "Ejemplo Flor", image: P5 },
      { category: "Barra de cócteles", name: "Ejemplo Bar", image: G2 },
      { category: "Vídeo", name: "Ejemplo Films", image: P1, isVideo: true },
    ],
    decor: "Estaciones altas con mantelería blanca, flores de temporada y barra de cócteles a la vista.",
    photocall: "Rincón de marca con el logotipo del showroom y arco de globos.",
    menu: [
      { course: "Estación fría", items: ["Tartar", "Ceviche"] },
      { course: "Estación caliente", items: ["Mini brochetas", "Croquetas gourmet"] },
      { course: "Estación dulce", items: ["Mini postres de autor"] },
      { course: "Barra", items: ["Barra de cócteles de bienvenida"] },
    ],
    timing: [
      { time: "19:00", moment: "Apertura de puertas" },
      { time: "19:30", moment: "Palabras de bienvenida" },
      { time: "19:45", moment: "Servicio de cóctel itinerante" },
      { time: "22:00", moment: "Cierre del evento" },
    ],
    surprises: [
      "DJ set sorpresa durante el cierre del evento.",
      "Detalle de bienvenida personalizado para los primeros 20 asistentes.",
    ],
    priceRange: {
      from: 40,
      to: 60,
      currency: "€ / comensal",
      note: "Orientativo para formato cóctel itinerante sin mesas, según número de estaciones.",
    },
    weather: "Evento de tarde-noche en interior con terraza anexa; sin incidencias.",
    restaurantSolutions:
      "Se diseñó un formato 100% itinerante (sin mesas) para facilitar el networking, adaptando la producción de cocina a un espacio sin cocina propia.",
    testimonialQuote:
      "Buscábamos un catering con presencia y buen producto para la inauguración, y superaron nuestras expectativas.",
    testimonialAuthor: "Showroom Ejemplo (ejemplo ilustrativo)",
  },
  {
    slug: "comunion-familiar-privada",
    isExample: true,
    title: "Comunión familiar — Familia Ejemplo",
    subtitle: "Catering a domicilio para 45 invitados",
    season: "Mayo 2025",
    space: "Catering a domicilio — vivienda particular",
    heroImage: { ...P4, alt: "Montaje en jardín particular — ejemplo ilustrativo" },
    gallery: [P4, G1, G3, { ...P2, isVideo: true }, G4, { ...P5, isVideo: true }],
    providers: [
      { category: "Animación infantil", name: "Ejemplo Kids", image: P4, isVideo: true },
      { category: "Decoración", name: "Ejemplo Flor", image: G3 },
      { category: "Fotografía", name: "Ejemplo Studio", image: P5, isVideo: true },
    ],
    decor: "Mesas redondas en jardín particular, mantelería clara y detalles en tonos pastel.",
    photocall: "Photocall temático infantil junto a la zona de juegos.",
    menu: [
      { course: "Aperitivo", items: ["Aperitivo variado para adultos", "Menú infantil diferenciado"] },
      { course: "Principal", items: ["Paella mixta", "Carne a la brasa"] },
      { course: "Postre", items: ["Tarta personalizada", "Candy bar"] },
    ],
    timing: [
      { time: "13:00", moment: "Llegada e instalación del catering" },
      { time: "14:00", moment: "Aperitivo" },
      { time: "15:00", moment: "Comida" },
      { time: "17:00", moment: "Tarta y candy bar" },
    ],
    surprises: [
      "Animador sorpresa disfrazado para los más pequeños.",
      "Mini fuegos fríos al presentar la tarta.",
    ],
    priceRange: {
      from: 35,
      to: 55,
      currency: "€ / comensal",
      note: "Orientativo para catering a domicilio con cocina satélite in situ y menú infantil diferenciado.",
    },
    weather: "Mediodía soleado de mayo; montaje en jardín particular sin incidencias.",
    restaurantSolutions:
      "Se montó cocina satélite in situ para servir el menú caliente recién hecho, y se preparó un menú infantil diferenciado sin necesidad de solicitud previa.",
    testimonialQuote:
      "Nos trajeron la experiencia de El Portón a nuestra propia casa. Los niños encantados y los mayores muy bien atendidos.",
    testimonialAuthor: "Familia Ejemplo (ejemplo ilustrativo)",
  },
]

export const vipGateContent = {
  title: "Biblioteca VIP",
  description:
    "Déjanos tu email para acceder a los casos completos: proveedores, decoración, menús y opiniones de quienes ya celebraron con nosotros.",
  placeholder: "tu@email.com",
  submitLabel: "Acceder",
  consentLabel: "Acepto recibir información de El Portón de la Condesa por email.",
  successMessage: "¡Gracias! Ya puedes ver todos los casos.",
  skipLabel: "Saltar verificación (solo desarrollo)",
}

// TODO(i18n): las fichas de bodas/catering (VipStory[]) siguen solo en
// español; aquí solo se traduce la interfaz del gate VIP.
export const vipGateContentEn = {
  title: "VIP library",
  description:
    "Leave us your email to access the full case studies: suppliers, decor, menus and reviews from those who've already celebrated with us.",
  placeholder: "you@email.com",
  submitLabel: "Access",
  consentLabel: "I agree to receive information from El Portón de la Condesa by email.",
  successMessage: "Thank you! You can now see every case.",
  skipLabel: "Skip verification (dev only)",
}
