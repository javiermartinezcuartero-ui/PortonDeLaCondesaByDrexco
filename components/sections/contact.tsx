"use client"

import { useEffect, useRef, useState } from "react"
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
  budgetRangeLabels as budgetRangeLabelsEs,
  spacesContent,
} from "@/data/site-content"
import {
  contactContent as contactContentEn,
  mapContent as mapContentEn,
  eventTypeLabels as eventTypeLabelsEn,
  budgetRangeLabels as budgetRangeLabelsEn,
} from "@/data/site-content.en"
import { useLocale } from "@/lib/i18n"
import { PRIVACY_POLICY_PATH } from "@/lib/legal"
import { newSubmissionId, submitLeadRequest } from "@/lib/leads"
import {
  BUDGET_RANGES,
  EVENT_TYPES,
  NO_SPACE_PREFERENCE,
  isCorporateEventType,
  isEventTypeCode,
  leadRequestFormSchema,
  type LeadRequestErrorCode,
  type LeadRequestFormValues,
} from "@/lib/validation/lead-request"

const formCopy = {
  es: {
    firstName: "Nombre", firstNamePh: "Tu nombre",
    lastName: "Apellidos", lastNamePh: "Tus apellidos",
    email: "Email", emailPh: "tu@email.com",
    phone: "Teléfono (opcional)", phonePh: "+34 ___ ___ ___",
    eventType: "Tipo de evento", eventTypePh: "Selecciona una opción",
    eventDate: "Fecha prevista (opcional)",
    guestCount: "Invitados aproximados (opcional)", guestCountPh: "Ej. 120",
    budgetRange: "Presupuesto orientativo (opcional)", budgetRangePh: "Selecciona un tramo",
    preferredSpace: "Espacio que te interesa", preferredSpacePh: "Selecciona un espacio",
    noSpacePreference: "Sin preferencia, aconsejadme",
    company: "Empresa u organización", companyPh: "Nombre de la empresa",
    jobTitle: "Cargo (opcional)", jobTitlePh: "Tu puesto",
    audiovisualNeeds: "Necesidades audiovisuales (opcional)", audiovisualNeedsPh: "Proyector, sonido, streaming…",
    corporateNote: "Al ser un evento de empresa, estos datos nos ayudan a preparar una propuesta ajustada.",
    subject: "Asunto", subjectPh: "Ej. Boda en septiembre para 120 invitados",
    message: "Mensaje", messagePh: "Cuéntanos más sobre tu celebración...",
    privacyPrefix: "He leído y acepto la", privacyLink: "política de privacidad", privacySuffix: "*",
    marketingLabel: "Acepto recibir comunicaciones comerciales (opcional)",
    submit: "Solicitar información", submitting: "Enviando…",
    successTitle: "Solicitud recibida",
    successBody: "Gracias por escribirnos. Hemos registrado tu solicitud y nos pondremos en contacto contigo para hablar de tu celebración.",
    finca: "Finca", emailLabel: "Email", phoneLabel: "Teléfono",
    subjectFromStory: { WEDDING: "Quiero una boda así", EXTERNAL_CATERING: "Quiero un catering así" },
    fieldErrors: {
      firstName: "Introduce tu nombre",
      lastName: "Introduce tus apellidos",
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
    firstName: "First name", firstNamePh: "Your first name",
    lastName: "Last name", lastNamePh: "Your last name",
    email: "Email", emailPh: "you@email.com",
    phone: "Phone (optional)", phonePh: "+34 ___ ___ ___",
    eventType: "Event type", eventTypePh: "Select an option",
    eventDate: "Planned date (optional)",
    guestCount: "Approximate guests (optional)", guestCountPh: "E.g. 120",
    budgetRange: "Indicative budget (optional)", budgetRangePh: "Select a range",
    preferredSpace: "Space you're interested in", preferredSpacePh: "Select a space",
    noSpacePreference: "No preference, please advise",
    company: "Company or organisation", companyPh: "Company name",
    jobTitle: "Job title (optional)", jobTitlePh: "Your role",
    audiovisualNeeds: "Audiovisual needs (optional)", audiovisualNeedsPh: "Projector, sound, streaming…",
    corporateNote: "As this is a corporate event, these details help us prepare a tailored proposal.",
    subject: "Subject", subjectPh: "E.g. September wedding for 120 guests",
    message: "Message", messagePh: "Tell us more about your celebration...",
    privacyPrefix: "I have read and accept the", privacyLink: "privacy policy", privacySuffix: "*",
    marketingLabel: "I agree to receive marketing communications (optional)",
    submit: "Request information", submitting: "Sending…",
    successTitle: "Request received",
    successBody: "Thank you for writing to us. Your request has been registered and we'll get in touch to talk about your celebration.",
    finca: "Venue", emailLabel: "Email", phoneLabel: "Phone",
    subjectFromStory: { WEDDING: "I want a wedding like this", EXTERNAL_CATERING: "I want catering like this" },
    fieldErrors: {
      firstName: "Please enter your first name",
      lastName: "Please enter your last name",
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

const underlineFieldClass =
  // `placeholder:text-muted-foreground` a opacidad plena, no `/50`.
  //
  // El token ya está medido para cumplir contraste (~6,9:1 sobre el fondo); al
  // rebajarlo al 50 % quedaba en torno a 2:1, por debajo del 4,5:1 que exige WCAG
  // para texto normal. Y aquí importa más que en un placeholder decorativo, porque
  // estos llevan información que no está en la etiqueta: el formato del teléfono,
  // el orden de magnitud de los invitados y un ejemplo de asunto. Con brillo bajo o
  // a la luz del sol no se leían, en el único formulario de conversión del sitio.
  "rounded-none border-0 border-b border-border bg-transparent px-0 py-3 h-auto shadow-none text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-foreground"

const EMPTY_VALUES: LeadRequestFormValues = {
  firstName: "",
  lastName: "",
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
  const budgetRangeLabels = locale === "en" ? budgetRangeLabelsEn : budgetRangeLabelsEs
  const t = formCopy[locale]

  const [isVisible, setIsVisible] = useState(false)
  const [submitState, setSubmitState] = useState<"idle" | "success" | "error">("idle")
  const [errorCode, setErrorCode] = useState<LeadRequestErrorCode | null>(null)
  /** Cambia en cada respuesta del servidor, para mover el foco también cuando el resultado se repite. */
  const [resultNonce, setResultNonce] = useState(0)

  const sectionRef = useRef<HTMLElement>(null)
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

  const isSubmitting = form.formState.isSubmitting

  return (
    <section
      ref={sectionRef}
      id="contacto"
      className="relative py-32 md:py-48 overflow-hidden"
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
        <div className="grid lg:grid-cols-12 gap-16 lg:gap-20">
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
            <div className="grid lg:grid-cols-2 gap-16 lg:gap-24">
              {/* Left Column - Text */}
              <div className="space-y-8">
                <h2
                  className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light leading-[1.1] tracking-[-0.01em] text-foreground text-pretty"
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
              <Form {...form}>
                <form
                  onSubmit={handleFormSubmit}
                  noValidate
                  className="space-y-8"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0)" : "translateY(40px)",
                    transitionProperty: "all",
                    transitionDuration: "0.8s",
                    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    transitionDelay: "0.3s"
                  }}
                >
                  {/* Name & Last name */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{t.firstName}</FormLabel>
                          <FormControl>
                            <Input placeholder={t.firstNamePh} autoComplete="given-name" className={underlineFieldClass} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{t.lastName}</FormLabel>
                          <FormControl>
                            <Input placeholder={t.lastNamePh} autoComplete="family-name" className={underlineFieldClass} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Email & Phone */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{t.email}</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder={t.emailPh} autoComplete="email" className={underlineFieldClass} {...field} />
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
                          <FormLabel className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{t.phone}</FormLabel>
                          <FormControl>
                            <Input type="tel" placeholder={t.phonePh} autoComplete="tel" className={underlineFieldClass} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Event type & Date */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="eventType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{t.eventType}</FormLabel>
                          <Select onValueChange={ignoreEmptySelection(field.onChange)} value={field.value}>
                            <FormControl>
                              <SelectTrigger className={`${underlineFieldClass} w-full`}>
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
                          <FormLabel className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{t.eventDate}</FormLabel>
                          <FormControl>
                            <Input type="date" className={underlineFieldClass} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Guests & Budget */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="guestCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{t.guestCount}</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} placeholder={t.guestCountPh} className={underlineFieldClass} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="budgetRange"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{t.budgetRange}</FormLabel>
                          <Select onValueChange={ignoreEmptySelection(field.onChange)} value={field.value ?? ""}>
                            <FormControl>
                              <SelectTrigger className={`${underlineFieldClass} w-full`}>
                                <SelectValue placeholder={t.budgetRangePh} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {BUDGET_RANGES.map((code) => (
                                <SelectItem key={code} value={code}>
                                  {budgetRangeLabels[code]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Preferred space */}
                  <FormField
                    control={form.control}
                    name="preferredSpace"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{t.preferredSpace}</FormLabel>
                        <Select onValueChange={ignoreEmptySelection(field.onChange)} value={field.value}>
                          <FormControl>
                            <SelectTrigger className={`${underlineFieldClass} w-full`}>
                              <SelectValue placeholder={t.preferredSpacePh} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {spacesContent.map((space) => (
                              <SelectItem key={space.slug} value={space.slug}>
                                {space.name}
                              </SelectItem>
                            ))}
                            <SelectItem value={NO_SPACE_PREFERENCE}>{t.noSpacePreference}</SelectItem>
                          </SelectContent>
                        </Select>
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
                      <div className="grid md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="company"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{t.company}</FormLabel>
                              <FormControl>
                                <Input placeholder={t.companyPh} autoComplete="organization" className={underlineFieldClass} {...field} />
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
                              <FormLabel className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{t.jobTitle}</FormLabel>
                              <FormControl>
                                <Input placeholder={t.jobTitlePh} autoComplete="organization-title" className={underlineFieldClass} {...field} />
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
                            <FormLabel className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{t.audiovisualNeeds}</FormLabel>
                            <FormControl>
                              <Textarea
                                rows={2}
                                placeholder={t.audiovisualNeedsPh}
                                className={`${underlineFieldClass} resize-none min-h-0`}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Subject */}
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{t.subject}</FormLabel>
                        <FormControl>
                          <Input placeholder={t.subjectPh} className={underlineFieldClass} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Message */}
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{t.message}</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={4}
                            placeholder={t.messagePh}
                            className={`${underlineFieldClass} resize-none min-h-0`}
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

                  {/* Consents */}
                  <div className="space-y-4 pt-2">
                    <FormField
                      control={form.control}
                      name="privacyConsent"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start gap-3 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div className="space-y-1">
                            <FormLabel className="text-sm font-normal leading-relaxed text-foreground/80">
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
                        <FormItem className="flex flex-row items-start gap-3 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div className="space-y-1">
                            <FormLabel className="text-sm font-normal leading-relaxed text-foreground/80">
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
                      className="group inline-flex items-center gap-4 px-8 py-4 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 disabled:opacity-60"
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

        {/* Map */}
        <div id="mapa" className="grid lg:grid-cols-12 gap-16 lg:gap-20 mt-24 md:mt-32">
          <div className="lg:col-span-2" />
          <div className="lg:col-span-10">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
              <div className="p-2 border border-border">
                <div className="relative aspect-[4/3] lg:aspect-auto lg:h-full overflow-hidden bg-secondary">
                  <iframe
                    src={brand.coordinates.embedUrl}
                    title={`Mapa de ubicación de ${brand.name}`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="absolute inset-0 h-full w-full border-0"
                    style={{ filter: "grayscale(0.55) sepia(0.35) hue-rotate(45deg) saturate(2.2) brightness(0.97) contrast(1.05)" }}
                  />
                </div>
              </div>
              <div className="flex flex-col justify-center space-y-6">
                <h3 className="font-serif text-2xl md:text-3xl font-light text-foreground">
                  {mapContent.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {mapContent.description}
                </p>
                <a
                  href={brand.coordinates.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground tracking-[0.05em] hover:text-accent transition-colors duration-300 underline"
                >
                  {brand.coordinates.label}
                </a>
                <div>
                  <a
                    href={brand.coordinates.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-3 px-6 py-3 text-sm tracking-[0.1em] uppercase text-primary-foreground bg-primary hover:bg-primary/90 transition-all duration-300"
                  >
                    <span>{mapContent.ctaLabel}</span>
                    <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
