"use client"

import { useEffect, useRef, useState } from "react"
import { format, isValid, parse, startOfToday } from "date-fns"
import { enGB, es } from "date-fns/locale"
import { CalendarDays, Check, Compass, Copy, ExternalLink, MapPin, Navigation } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { InstagramIcon } from "@/components/icons/instagram-icon"
import { FacebookIcon } from "@/components/icons/facebook-icon"
import { BodasNetIcon } from "@/components/icons/bodas-net-icon"
import Link from "next/link"
import { useForm, useWatch, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  brand,
  contactContent as contactContentEs,
  mapContent as mapContentEs,
  eventTypeLabels as eventTypeLabelsEs,
} from "@/data/site-content"
import {
  contactContent as contactContentEn,
  mapContent as mapContentEn,
  eventTypeLabels as eventTypeLabelsEn,
} from "@/data/site-content.en"
import { useLocale } from "@/lib/i18n"
import { PRIVACY_POLICY_PATH } from "@/lib/legal"
import { newSubmissionId, submitLeadRequest } from "@/lib/leads"
import {
  EVENT_TYPES,
  isCorporateEventType,
  isEventTypeCode,
  leadRequestFormSchema,
  type EventTypeCode,
  type LeadRequestErrorCode,
  type LeadRequestFormValues,
} from "@/lib/validation/lead-request"

const formCopy = {
  es: {
    fullName: "Nombre y apellidos", fullNamePh: "Nombre y Apellidos",
    email: "Email", emailPh: "Email",
    phone: "Teléfono (opcional)", phonePh: "Teléfono (opcional)",
    eventType: "Tipo de evento", eventTypePh: "Tipo de evento",
    eventDate: "Fecha prevista (opcional)", eventDatePh: "Fecha prevista",
    guestCount: "Invitados aproximados (opcional)", guestCountPh: "Invitados aproximados (opcional)",
    budgetRange: "Presupuesto orientativo (opcional)", budgetRangePh: "Selecciona un tramo",
    preferredSpace: "Espacio que te interesa", preferredSpacePh: "Selecciona un espacio",
    noSpacePreference: "Sin preferencia, aconsejadme",
    company: "Empresa u organización", companyPh: "Empresa u organización",
    jobTitle: "Cargo (opcional)", jobTitlePh: "Cargo (opcional)",
    audiovisualNeeds: "Necesidades audiovisuales (opcional)", audiovisualNeedsPh: "Necesidades audiovisuales (opcional)",
    corporateNote: "Al ser un evento de empresa, estos datos nos ayudan a preparar una propuesta ajustada.",
    message: "Mensaje", messagePh: "Mensaje",
    privacyPrefix: "He leído y acepto la", privacyLink: "política de privacidad", privacySuffix: "*",
    marketingLabel: "Acepto recibir comunicaciones comerciales (opcional)",
    submit: "Enviar mensaje", submitting: "Enviando…",
    successTitle: "Solicitud recibida",
    successBody: "Gracias por escribirnos. Hemos registrado tu solicitud y nos pondremos en contacto contigo para hablar de tu celebración.",
    finca: "Finca", emailLabel: "Email", phoneLabel: "Teléfono",
    subjectFromStory: { WEDDING: "Quiero una boda así", EXTERNAL_CATERING: "Quiero un catering así" },
    fieldErrors: {
      fullName: "Escribe tu nombre y tus apellidos",
      email: "Introduce un email válido",
      phone: "Introduce un teléfono válido",
      eventType: "Selecciona el tipo de evento",
      eventDate: "Indica una fecha válida que no sea anterior a hoy",
      guestCount: "Indica un número de invitados válido",
      company: "Indica la empresa u organización",
      jobTitle: "Revisa este campo",
      audiovisualNeeds: "El texto es demasiado largo",
      preferredSpace: "Selecciona el espacio que te interesa",
      budgetRange: "Selecciona un tramo válido",
      subject: "Escribe un asunto",
      message: "Escribe tu mensaje",
      privacyConsent: "Debes aceptar la política de privacidad",
    },
    errors: {
      "invalid-payload": "Revisa los datos marcados e inténtalo de nuevo.",
      "policy-version-mismatch": "La política de privacidad se ha actualizado. Recarga la página y vuelve a enviar el formulario.",
      "too-fast": "El envío se ha hecho demasiado rápido. Vuelve a pulsar el botón, por favor.",
      "rate-limited": "Has enviado varias solicitudes seguidas. Espera unos minutos antes de volver a intentarlo.",
      "payload-too-large": "El mensaje es demasiado largo. Acórtalo un poco e inténtalo de nuevo.",
      "persistence-failed": "No hemos podido registrar tu solicitud. Escríbenos por WhatsApp o llámanos, por favor.",
      "invalid-request": "No hemos podido procesar la solicitud. Recarga la página e inténtalo de nuevo.",
    } satisfies Record<LeadRequestErrorCode, string>,
  },
  en: {
    fullName: "Full name", fullNamePh: "Full name",
    email: "Email", emailPh: "Email",
    phone: "Phone (optional)", phonePh: "Phone (optional)",
    eventType: "Event type", eventTypePh: "Event type",
    eventDate: "Planned date (optional)", eventDatePh: "Planned date",
    guestCount: "Approximate guests (optional)", guestCountPh: "Approximate guests (optional)",
    budgetRange: "Indicative budget (optional)", budgetRangePh: "Select a range",
    preferredSpace: "Space you're interested in", preferredSpacePh: "Select a space",
    noSpacePreference: "No preference, please advise",
    company: "Company or organisation", companyPh: "Company or organisation",
    jobTitle: "Job title (optional)", jobTitlePh: "Job title (optional)",
    audiovisualNeeds: "Audiovisual needs (optional)", audiovisualNeedsPh: "Audiovisual needs (optional)",
    corporateNote: "As this is a corporate event, these details help us prepare a tailored proposal.",
    message: "Message", messagePh: "Message",
    privacyPrefix: "I have read and accept the", privacyLink: "privacy policy", privacySuffix: "*",
    marketingLabel: "I agree to receive marketing communications (optional)",
    submit: "Send message", submitting: "Sending…",
    successTitle: "Request received",
    successBody: "Thank you for writing to us. Your request has been registered and we'll get in touch to talk about your celebration.",
    finca: "Venue", emailLabel: "Email", phoneLabel: "Phone",
    subjectFromStory: { WEDDING: "I want a wedding like this", EXTERNAL_CATERING: "I want catering like this" },
    fieldErrors: {
      fullName: "Please enter your first name and surname",
      email: "Please enter a valid email",
      phone: "Please enter a valid phone number",
      eventType: "Please select the event type",
      eventDate: "Please enter a valid date, not earlier than today",
      guestCount: "Please enter a valid guest count",
      company: "Please enter the company or organisation",
      jobTitle: "Please check this field",
      audiovisualNeeds: "This text is too long",
      preferredSpace: "Please select the space you're interested in",
      budgetRange: "Please select a valid range",
      subject: "Please write a subject",
      message: "Please write your message",
      privacyConsent: "You must accept the privacy policy",
    },
    errors: {
      "invalid-payload": "Please review the highlighted fields and try again.",
      "policy-version-mismatch": "The privacy policy has been updated. Please reload the page and submit again.",
      "too-fast": "That was submitted too quickly. Please press the button again.",
      "rate-limited": "You've sent several requests in a row. Please wait a few minutes before trying again.",
      "payload-too-large": "Your message is too long. Please shorten it and try again.",
      "persistence-failed": "We couldn't register your request. Please reach us on WhatsApp or by phone.",
      "invalid-request": "We couldn't process the request. Please reload the page and try again.",
    } satisfies Record<LeadRequestErrorCode, string>,
  },
} as const

// Campos con relleno y esquina redondeada, en lugar de la línea inferior que
// tenían antes. Es el mismo lenguaje que la pantalla de acceso y el panel —caja
// definida, fondo propio, foco con anillo—, traducido a la paleta clara del sitio:
// el relleno es la piedra cálida de la marca, no el vidrio azul del panel.
//
// El cambio no es solo estético. Un campo subrayado no dice dónde acaba la zona
// pulsable, y en móvil eso se nota: se toca al lado de la línea y no pasa nada. Con
// caja, el objetivo es todo el rectángulo.
//
// `placeholder:text-muted-foreground` a opacidad plena, no `/50`. El token ya está
// medido para cumplir contraste (~6,9:1 sobre el fondo); al rebajarlo al 50 %
// quedaba en torno a 2:1, por debajo del 4,5:1 que exige WCAG para texto normal. Y
// aquí importa más que en un placeholder decorativo, porque estos llevan
// información que no está en la etiqueta: el formato del teléfono, el orden de
// magnitud de los invitados y un ejemplo de asunto. Con brillo bajo o a la luz del
// sol no se leían, en el único formulario de conversión del sitio.
/**
 * Etiquetas de campo sin rótulo visible, a petición del titular: el formulario tenía
 * un título en mayúsculas sobre cada campo y eso es la mitad de su altura.
 *
 * `sr-only` y no borrarlas: la etiqueta sigue en el HTML, unida a su campo, así que
 * un lector de pantalla anuncia «Email, campo de texto» igual que antes y el `for`
 * sigue llevando el foco al campo al pulsar. Borrarlas habría dejado diez campos sin
 * nombre accesible, que es una barrera de verdad, no una decisión estética.
 *
 * Lo que sí se pierde es la pista visual cuando el campo ya tiene texto escrito: el
 * marcador de posición desaparece al escribir. Se acepta porque los campos son
 * reconocibles por su contenido, pero conviene saberlo.
 */
const labelClass = "sr-only"

/**
 * El formulario guarda la fecha como `yyyy-MM-dd` —lo que valida el esquema— y la
 * muestra escrita. Las dos conversiones viven aquí para que el JSX no las repita.
 *
 * `parse` con formato explícito y no `new Date(cadena)`: el constructor interpreta
 * `2026-09-12` como UTC y, según la zona horaria, devuelve el día anterior. Es el
 * error clásico de las fechas sin hora, y en un formulario de bodas significaría
 * mostrar un día distinto del que se eligió.
 */
function parseEventDate(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const parsed = parse(value, "yyyy-MM-dd", new Date())
  return isValid(parsed) ? parsed : undefined
}

function formatISO(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

function formatEventDate(value: string, locale: "es" | "en"): string {
  const parsed = parseEventDate(value)
  if (!parsed) return value
  return locale === "en"
    ? format(parsed, "d MMMM yyyy", { locale: enGB })
    : format(parsed, "d 'de' MMMM 'de' yyyy", { locale: es })
}

const softFieldClass =
  "h-12 rounded-xl border border-border/80 bg-secondary/40 px-4 shadow-none text-foreground placeholder:text-muted-foreground transition-colors duration-300 hover:bg-secondary/60 focus-visible:bg-background focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring/25"

const EMPTY_VALUES: LeadRequestFormValues = {
  fullName: "",
  email: "",
  phone: "",
  eventType: "",
  eventDate: "",
  guestCount: "",
  company: "",
  jobTitle: "",
  audiovisualNeeds: "",
  preferredSpace: "",
  budgetRange: "",
  subject: "",
  message: "",
  privacyConsent: false,
  marketingConsent: false,
  honeypot: "",
}

/**
 * Envoltorio del `onValueChange` de un desplegable que descarta la cadena vacía.
 *
 * **No es una precaución teórica.** Radix Select, cuando vive dentro de un
 * `<form>`, renderiza además un `<select>` nativo oculto para que las librerías de
 * formularios lo vean, y su `BubbleSelect` dispara un evento `change` sintético
 * cada vez que cambia su valor. Con el desplegable cerrado ese select nativo solo
 * tiene la opción vacía del marcador de posición —los `SelectItem` viven en
 * `SelectContent`, que no está montado—, así que el evento llega con `""` y
 * escribe la cadena vacía de vuelta en el formulario.
 *
 * El efecto era este: el CTA "Quiero una boda así" precargaba el asunto pero **no**
 * el tipo de evento, y el primer envío se rechazaba con "Selecciona el tipo de
 * evento". Lo destapó la prueba E2E del escenario 6, no una revisión del código:
 * la prueba de la Fase 6 volvía a elegir el tipo a mano y tapaba el fallo.
 *
 * Descartar `""` es seguro porque ninguna opción real la usa: ni `EVENT_TYPES`, ni
 * los espacios (la opción "sin preferencia" tiene su propio código), ni
 * `BUDGET_RANGES`. Una cadena vacía nunca es una elección de la persona.
 */
function ignoreEmptySelection(onChange: (value: string) => void) {
  return (value: string) => {
    if (value === "") return
    onChange(value)
  }
}

export function ContactSection() {
  const { locale } = useLocale()
  const contactContent = locale === "en" ? contactContentEn : contactContentEs
  const mapContent = locale === "en" ? mapContentEn : mapContentEs
  const eventTypeLabels = locale === "en" ? eventTypeLabelsEn : eventTypeLabelsEs
  const t = formCopy[locale]

  const [isVisible, setIsVisible] = useState(false)
  const [submitState, setSubmitState] = useState<"idle" | "success" | "error">("idle")
  const [errorCode, setErrorCode] = useState<LeadRequestErrorCode | null>(null)
  /** Cambia en cada respuesta del servidor, para mover el foco también cuando el resultado se repite. */
  const [resultNonce, setResultNonce] = useState(0)
  /** Acuse de recibo del botón de copiar coordenadas; vuelve solo a los 2 s. */
  const [coordinatesCopied, setCoordinatesCopied] = useState(false)

  const sectionRef = useRef<HTMLElement>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  /** Momento en que el formulario quedó listo, para el tiempo mínimo de envío. */
  const readyAtRef = useRef<number>(0)
  /** Clave de idempotencia del intento en curso: se renueva solo tras un envío correcto. */
  const submissionIdRef = useRef<string>("")
  /**
   * Ficha de origen leída de la URL. Va en una ref y no en estado porque no
   * interviene en el renderizado: solo se lee al enviar. Así el efecto de
   * precarga no dispara un render en cascada.
   */
  const sourceContentIdRef = useRef<string | undefined>(undefined)
  const prefilledRef = useRef(false)

  /**
   * El esquema es el mismo que valida el endpoint; lo único que se añade aquí es
   * el idioma. Se sustituye el mensaje de cada error por su traducción según el
   * nombre del campo, así no hay dos juegos de reglas que puedan desalinearse.
   */
  const resolver: Resolver<LeadRequestFormValues> = async (values, context, options) => {
    const result = await zodResolver(leadRequestFormSchema)(values, context, options)
    const errors = result.errors as Record<string, { message?: string } | undefined>
    for (const [field, error] of Object.entries(errors)) {
      const message = t.fieldErrors[field as keyof typeof t.fieldErrors]
      if (error && message) error.message = message
    }
    return result
  }

  const form = useForm<LeadRequestFormValues>({ resolver, defaultValues: EMPTY_VALUES })

  // `useWatch` en vez de `form.watch()`: devuelve un valor suscrito en vez de
  // una función nueva en cada render, así el compilador de React puede memoizar
  // el componente (`form.watch` lo obliga a saltárselo).
  const eventType = useWatch({ control: form.control, name: "eventType" })
  const isCorporate = isCorporateEventType(eventType ?? "")

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.1 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  // El temporizador del acuse de «Copiado» tiene que morir con el componente: si
  // se desmonta antes de los 2 s, el `setState` caería sobre un componente que ya
  // no existe.
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  /**
   * Precarga desde un CTA de ficha VIP ("Quiero una boda así"): el enlace llega
   * como `/?ficha=<id>&tipo=<CÓDIGO>#contacto`. Se lee de `window` en vez de con
   * `useSearchParams` para no forzar a toda la home a renderizado dinámico.
   *
   * Solo se ejecuta una vez: cambiar de idioma no debe sobrescribir lo que la
   * persona ya haya escrito.
   */
  useEffect(() => {
    if (prefilledRef.current) return
    prefilledRef.current = true

    readyAtRef.current = Date.now()
    submissionIdRef.current = newSubmissionId()

    const params = new URLSearchParams(window.location.search)
    const contentId = params.get("ficha")
    const type = params.get("tipo")

    if (contentId) sourceContentIdRef.current = contentId

    if (type && isEventTypeCode(type)) {
      form.setValue("eventType", type)
      // Asunto sugerido: es el texto del botón que la persona acaba de pulsar,
      // no contenido inventado. Sigue siendo editable.
      const suggestedSubject =
        type === "WEDDING" || type === "EXTERNAL_CATERING" ? t.subjectFromStory[type] : undefined
      if (contentId && suggestedSubject) form.setValue("subject", suggestedSubject)
    }
  }, [form, t])

  // El foco va al resultado en cuanto el servidor responde, para que quien
  // navega con teclado o lector de pantalla no tenga que buscarlo.
  useEffect(() => {
    if (resultNonce > 0) resultRef.current?.focus()
  }, [resultNonce])

  const onSubmit = async (values: LeadRequestFormValues) => {
    setSubmitState("idle")
    setErrorCode(null)

    const sourceContentId = sourceContentIdRef.current

    const result = await submitLeadRequest(values, {
      sourceForm: sourceContentId ? "vip-story-cta" : "contact-home",
      sourceContentId,
      submissionId: submissionIdRef.current,
      formElapsedMs: readyAtRef.current ? Date.now() - readyAtRef.current : 0,
      // Asunto de reserva, ya en el idioma de la persona: el tipo de evento elegido.
      // El desplegable es obligatorio, así que siempre hay etiqueta; el respaldo
      // cubre únicamente el caso imposible de un código sin traducir.
      fallbackSubject: eventTypeLabels[values.eventType as EventTypeCode] ?? t.eventType,
    })

    if (result.ok) {
      setSubmitState("success")
      form.reset(EMPTY_VALUES)
      // Un envío nuevo es una solicitud nueva: clave y reloj se reinician.
      submissionIdRef.current = newSubmissionId()
      readyAtRef.current = Date.now()
    } else {
      // No se toca el formulario: lo escrito se conserva tal cual. Se mantiene
      // también la misma clave de idempotencia, para que un reintento sobre un
      // envío que sí llegó a guardarse no cree una solicitud duplicada.
      setSubmitState("error")
      setErrorCode(result.code)
    }

    setResultNonce((nonce) => nonce + 1)
  }

  /**
   * `form.handleSubmit(...)` se construye dentro del manejador y no durante el
   * render: `onSubmit` lee refs y el reloj, y eso solo es legítimo cuando de
   * verdad hay un evento (regla `react-hooks/refs` del compilador de React).
   */
  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    void form.handleSubmit(onSubmit)(event)
  }

  /**
   * Copia las coordenadas decimales, no la etiqueta en grados y minutos: es el
   * formato que aceptan Google Maps, un navegador GPS o un mensaje de WhatsApp
   * pegándolo tal cual. La etiqueta con símbolos es para leer, no para pegar.
   *
   * Si el navegador no da permiso al portapapeles —o la página no está en un
   * contexto seguro— no pasa nada visible: las coordenadas siguen en pantalla y a
   * la vista, que es el camino que ya existía antes de este botón.
   */
  const handleCopyCoordinates = () => {
    const decimales = `${brand.coordinates.lat}, ${brand.coordinates.lng}`
    void navigator.clipboard
      ?.writeText(decimales)
      .then(() => {
        setCoordinatesCopied(true)
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
        copyTimerRef.current = setTimeout(() => setCoordinatesCopied(false), 2000)
      })
      .catch(() => undefined)
  }

  const isSubmitting = form.formState.isSubmitting

  return (
    <section
      ref={sectionRef}
      id="contacto"
      className="relative py-20 md:py-28 overflow-hidden"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute top-0 left-0 w-full h-full opacity-[0.02]" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="contactGrid" width="5" height="5" patternUnits="userSpaceOnUse">
              <circle cx="0.5" cy="0.5" r="0.5" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#contactGrid)" />
        </svg>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 md:px-12 lg:px-20">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14">
          {/* Section Label */}
          <div className="lg:col-span-2">
            <div
              className="flex items-center gap-4"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateX(0)" : "translateX(-20px)",
                transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">(06)</span>
              <div className="w-8 h-px bg-border" />
              <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">{contactContent.label}</span>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-10">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
              {/* Left Column - Text */}
              <div className="space-y-8">
                <h2
                  className="font-serif text-3xl sm:text-4xl md:text-[2.75rem] lg:text-5xl font-light leading-[1.1] tracking-[-0.01em] text-foreground text-pretty"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(40px)",
                  transitionProperty: "all",
                  transitionDuration: "0.8s",
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  transitionDelay: "0.1s"
                }}
                >
                  {contactContent.title}
                </h2>

                <p
                  className="text-lg text-muted-foreground leading-relaxed max-w-md"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0)" : "translateY(30px)",
                    transitionProperty: "all",
                    transitionDuration: "0.8s",
                    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    transitionDelay: "0.2s"
                  }}
                >
                  {contactContent.description}
                </p>

                {/* Contact Info */}
                <div
                  className="space-y-6 pt-8"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0)" : "translateY(20px)",
                    transitionProperty: "all",
                    transitionDuration: "0.8s",
                    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    transitionDelay: "0.3s"
                  }}
                >
                  <div className="space-y-1">
                    <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{t.finca}</span>
                    <p className="text-foreground">
                      {brand.address.line}
                      <br />
                      {brand.address.postalCode} {brand.address.city}, {brand.address.province}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{t.emailLabel}</span>
                    <p className="text-foreground">
                      <a href={`mailto:${brand.email}`} className="hover:text-accent transition-colors duration-300">
                        {brand.email}
                      </a>
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{t.phoneLabel}</span>
                    <p className="text-foreground">
                      <a href={`tel:${brand.phone.replace(/\s/g, "")}`} className="hover:text-accent transition-colors duration-300">
                        {brand.phone}
                      </a>
                    </p>
                  </div>
                </div>

                {/* Social Links */}
                <div
                  className="flex items-center gap-6 pt-8"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0)" : "translateY(20px)",
                    transitionProperty: "all",
                    transitionDuration: "0.8s",
                    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    transitionDelay: "0.4s"
                  }}
                >
                  <a
                    href={brand.social.instagram.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                    title="Instagram"
                    className="inline-flex items-center gap-2 text-sm tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground transition-colors duration-300"
                  >
                    <InstagramIcon className="h-4 w-4" />
                    Instagram
                  </a>
                  <a
                    href={brand.social.facebook.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Facebook"
                    title="Facebook"
                    className="inline-flex items-center gap-2 text-sm tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground transition-colors duration-300"
                  >
                    <FacebookIcon className="h-4 w-4" />
                    Facebook
                  </a>
                  <a
                    href={brand.social.bodasNet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={brand.social.bodasNet.label}
                    title={brand.social.bodasNet.label}
                    className="inline-flex items-center gap-2 text-sm tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground transition-colors duration-300"
                  >
                    <BodasNetIcon className="h-4 w-4 rounded" />
                    {brand.social.bodasNet.label}
                  </a>
                </div>
              </div>

              {/* Right Column - Form */}
              {/* La tarjeta es lo que da al formulario el aire de la pantalla de
                  acceso: una superficie propia con borde, esquinas redondeadas y
                  una sombra baja y muy difusa. Sin ella, los campos con relleno
                  flotaban sobre el crema del fondo sin nada que los agrupara. */}
              <Form {...form}>
                <form
                  onSubmit={handleFormSubmit}
                  noValidate
                  className="space-y-4 rounded-3xl border border-border bg-card/70 p-5 md:p-7 shadow-[0_30px_70px_-45px_rgba(24,38,5,0.45)] backdrop-blur-sm"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0)" : "translateY(40px)",
                    transitionProperty: "all",
                    transitionDuration: "0.8s",
                    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    transitionDelay: "0.3s"
                  }}
                >
                  {/* Nombre y apellidos, en un campo.
                      `autoComplete="name"` y no `given-name`: es el nombre completo, y
                      con la pista correcta el navegador lo rellena de una vez. */}
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>{t.fullName}</FormLabel>
                        <FormControl>
                          <Input placeholder={t.fullNamePh} autoComplete="name" className={softFieldClass} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Email & Phone */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>{t.email}</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder={t.emailPh} autoComplete="email" className={softFieldClass} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>{t.phone}</FormLabel>
                          <FormControl>
                            <Input type="tel" placeholder={t.phonePh} autoComplete="tel" className={softFieldClass} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Event type & Date */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="eventType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>{t.eventType}</FormLabel>
                          <Select onValueChange={ignoreEmptySelection(field.onChange)} value={field.value}>
                            <FormControl>
                              <SelectTrigger className={`${softFieldClass} w-full data-[size=default]:h-12`}>
                                <SelectValue placeholder={t.eventTypePh} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {EVENT_TYPES.map((code) => (
                                <SelectItem key={code} value={code}>
                                  {eventTypeLabels[code]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="eventDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>{t.eventDate}</FormLabel>
                          {/*
                            Selector propio en lugar de `<input type="date">`, por dos
                            razones que el nativo no permite resolver:

                            - **El idioma.** El calendario nativo se pinta en el idioma
                              de la interfaz del navegador, no en el de la página, así
                              que en un Chrome en inglés salía en inglés y no hay
                              atributo que lo cambie. Aquí el idioma lo decide la web,
                              con el mismo `locale` que el resto de la sección.
                            - **La altura.** El control nativo trae su propia caja y
                              medía distinto que el desplegable de tipo de evento, que
                              está justo al lado.

                            El valor del formulario sigue siendo `yyyy-MM-dd`, que es lo
                            que valida el esquema y lo que espera el endpoint: lo que
                            cambia es cómo se elige y cómo se muestra.
                          */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={`${softFieldClass} flex w-full items-center justify-between gap-2 text-left`}
                              >
                                <span className={`truncate ${field.value ? "text-foreground" : "text-muted-foreground"}`}>
                                  {field.value ? formatEventDate(field.value, locale) : t.eventDatePh}
                                </span>
                                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                locale={locale === "en" ? enGB : es}
                                selected={parseEventDate(field.value)}
                                defaultMonth={parseEventDate(field.value)}
                                // El esquema rechaza fechas pasadas; el calendario no
                                // las ofrece, así que el error no llega a producirse.
                                //
                                // Como función y no como `{ before: startOfToday() }`:
                                // esa forma llama al reloj en **cada render** del
                                // formulario, también en el del servidor, y un valor
                                // que depende de la hora no debe entrar en el árbol
                                // que se hidrata. Así solo se evalúa al abrir el
                                // calendario y al pintar cada día.
                                disabled={(date) => date < startOfToday()}
                                onSelect={(date) => field.onChange(date ? formatISO(date) : "")}
                                autoFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Invitados. El presupuesto orientativo se retiró del
                      formulario a petición del titular: era el campo que más
                      abandono provoca y el dato se acaba hablando por teléfono. */}
                  <FormField
                    control={form.control}
                    name="guestCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>{t.guestCount}</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} placeholder={t.guestCountPh} className={softFieldClass} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Corporate-only fields. Solo se piden cuando el tipo de
                      evento los hace pertinentes; en cualquier otro caso el
                      servidor los descarta aunque lleguen. */}
                  {isCorporate && (
                    <div className="space-y-6 border-l border-border pl-6">
                      <p className="text-sm text-muted-foreground leading-relaxed">{t.corporateNote}</p>
                      <div className="grid md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="company"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className={labelClass}>{t.company}</FormLabel>
                              <FormControl>
                                <Input placeholder={t.companyPh} autoComplete="organization" className={softFieldClass} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="jobTitle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className={labelClass}>{t.jobTitle}</FormLabel>
                              <FormControl>
                                <Input placeholder={t.jobTitlePh} autoComplete="organization-title" className={softFieldClass} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="audiovisualNeeds"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={labelClass}>{t.audiovisualNeeds}</FormLabel>
                            <FormControl>
                              <Textarea
                                rows={2}
                                placeholder={t.audiovisualNeedsPh}
                                className={`${softFieldClass} h-auto py-3 resize-none min-h-0`}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* El campo de asunto se retiró: dos cajas de texto seguidas para
                      decir una sola cosa. Sigue existiendo en el envío —el panel
                      ordena por él—, relleno con el tipo de evento, o con el texto
                      del CTA cuando la solicitud viene de una ficha VIP. */}

                  {/* Message */}
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>{t.message}</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={4}
                            placeholder={t.messagePh}
                            className={`${softFieldClass} h-auto py-3 resize-none min-h-0`}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Honeypot: invisible para personas, fuera del recorrido de
                      teclado y de los lectores de pantalla. */}
                  <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
                    <label htmlFor="contact-website">Website</label>
                    <input
                      id="contact-website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      {...form.register("honeypot")}
                    />
                  </div>

                  {/* Consentimientos, más discretos: casilla de 14 px en lugar de 16 y
                      texto de 12 px atenuado, con menos aire entre los dos.
                      Son obligaciones legales que hay que poder leer, no la parte del
                      formulario que se mira primero; con el tamaño anterior competían
                      con los propios campos.

                      El área de pulsación **no se reduce**: `<FormLabel>` es un
                      `<label>` asociado a la casilla, así que todo el texto sigue
                      siendo pulsable y el objetivo real mide varias líneas de alto,
                      no 14 px. Es lo que permite empequeñecer la casilla sin
                      empeorar el uso en móvil. */}
                  <div className="space-y-2.5 pt-1">
                    <FormField
                      control={form.control}
                      name="privacyConsent"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start gap-2.5 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="mt-px size-3.5"
                            />
                          </FormControl>
                          <div className="space-y-1">
                            <FormLabel className="text-xs font-normal leading-snug text-foreground/70">
                              {t.privacyPrefix}{" "}
                              <Link href={PRIVACY_POLICY_PATH} className="underline hover:text-foreground transition-colors duration-300">
                                {t.privacyLink}
                              </Link>{" "}
                              {t.privacySuffix}
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="marketingConsent"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start gap-2.5 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value ?? false}
                              onCheckedChange={field.onChange}
                              className="mt-px size-3.5"
                            />
                          </FormControl>
                          <div className="space-y-1">
                            <FormLabel className="text-xs font-normal leading-snug text-foreground/70">
                              {t.marketingLabel}
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4 space-y-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      aria-busy={isSubmitting}
                      className="group inline-flex items-center gap-4 rounded-full px-8 py-4 bg-primary text-primary-foreground shadow-[0_10px_24px_-10px_rgba(24,38,5,0.60)] hover:bg-primary/90 hover:shadow-[0_14px_30px_-10px_rgba(24,38,5,0.70)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-300 disabled:opacity-60"
                    >
                      <span className="text-sm tracking-[0.15em] uppercase">{isSubmitting ? t.submitting : t.submit}</span>
                      <svg
                        className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </button>

                    {/* Región de resultado: anunciada por lectores de pantalla y
                        enfocable, para poder llevar el foco aquí al responder. */}
                    <div
                      ref={resultRef}
                      tabIndex={-1}
                      aria-live="polite"
                      aria-atomic="true"
                      className="scroll-mt-32 focus-visible:outline-none"
                    >
                      {submitState === "success" && (
                        <div className="border-l-2 border-primary pl-4 space-y-1">
                          <p className="text-sm tracking-[0.1em] uppercase text-foreground">{t.successTitle}</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">{t.successBody}</p>
                        </div>
                      )}
                      {submitState === "error" && errorCode && (
                        <p className="text-sm text-destructive leading-relaxed">{t.errors[errorCode]}</p>
                      )}
                    </div>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </div>

        {/* Ubicación */}
        <div id="mapa" className="grid lg:grid-cols-12 gap-10 lg:gap-14 mt-16 md:mt-20">
          <div className="lg:col-span-2" />
          <div className="lg:col-span-10">
            {/* Una sola tarjeta con el mapa y los datos dentro, en vez de dos
                bloques suELtos separados por un hueco. El mapa deja de ser una
                ilustración al lado de un texto y pasa a ser la mitad de un módulo
                de ubicación. Mismo lenguaje que el formulario y el panel: borde,
                esquina grande, sombra baja. */}
            <div className="overflow-hidden rounded-3xl border border-border bg-card/70 shadow-[0_30px_70px_-45px_rgba(24,38,5,0.45)] backdrop-blur-sm">
              <div className="grid lg:grid-cols-2">
                <div className="relative min-h-[300px] lg:min-h-[420px] bg-secondary">
                  {/*
                    El filtro anterior era `grayscale(0.55) sepia(0.35)
                    hue-rotate(45deg) saturate(2.2)`, y dejaba el mapa teñido de un
                    verde irreal donde costaba distinguir una carretera de un río.
                    Un mapa es información, no decoración: si hay que entornar los
                    ojos para leer una calle, el filtro está de más. Se deja una
                    corrección mínima, la justa para que no choque con la paleta
                    cálida del sitio.
                  */}
                  <iframe
                    src={brand.coordinates.embedUrl}
                    title={`Mapa de ubicación de ${brand.name}`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="absolute inset-0 h-full w-full border-0"
                    style={{ filter: "saturate(0.92) contrast(1.03) sepia(0.06)" }}
                  />
                  {/* Chip con el nombre: dice qué es ese punto del mapa sin tener
                      que cruzar la vista al panel de al lado. `pointer-events-none`
                      para no robarle el arrastre al mapa. */}
                  <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 shadow-sm backdrop-blur-md">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                    <span className="text-xs tracking-[0.08em] uppercase text-foreground">{brand.name}</span>
                  </div>
                </div>

                <div className="flex flex-col justify-center gap-6 p-6 md:p-10 lg:border-l lg:border-border">
                  <h3 className="font-serif text-2xl md:text-3xl font-light text-foreground">
                    {mapContent.title}
                  </h3>

                  {/* Dirección y coordenadas como lista de definiciones: son un
                      dato con su nombre, y así lo anuncia también un lector de
                      pantalla. */}
                  <dl className="space-y-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                      <div>
                        <dt className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{mapContent.addressLabel}</dt>
                        <dd className="text-foreground leading-relaxed">{mapContent.description}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Compass className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                      <div className="min-w-0">
                        <dt className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{mapContent.coordinatesLabel}</dt>
                        <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {/* En monoespaciada: son cifras, y con la tipografía de
                              texto los grados y los minutos bailaban. */}
                          <span className="font-mono text-sm text-foreground">{brand.coordinates.label}</span>
                          <button
                            type="button"
                            onClick={handleCopyCoordinates}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-300 hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {coordinatesCopied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                            <span>{coordinatesCopied ? mapContent.copiedLabel : mapContent.copyLabel}</span>
                          </button>
                        </dd>
                      </div>
                    </div>
                  </dl>

                  <p className="text-sm text-muted-foreground leading-relaxed">{mapContent.parkingNote}</p>

                  {/* Dos acciones, no una: quien ya sabe dónde está esto quiere la
                      ruta, y quien no lo sabe quiere mirar el mapa entero. Antes
                      solo había un botón que decía «Abrir en Google Maps» pero
                      llevaba a las indicaciones. */}
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={brand.coordinates.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-3 rounded-full bg-primary px-6 py-3 text-sm tracking-[0.1em] uppercase text-primary-foreground shadow-[0_10px_24px_-10px_rgba(24,38,5,0.60)] transition-all duration-300 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <Navigation className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
                      <span>{mapContent.routeLabel}</span>
                    </a>
                    <a
                      href={`https://www.google.com/maps?q=${brand.coordinates.lat},${brand.coordinates.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm tracking-[0.1em] uppercase text-foreground transition-colors duration-300 hover:border-foreground/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden />
                      <span>{mapContent.ctaLabel}</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
