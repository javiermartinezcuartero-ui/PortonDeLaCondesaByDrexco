"use client"

import { useEffect, useRef, useState } from "react"
import { InstagramIcon } from "@/components/icons/instagram-icon"
import { FacebookIcon } from "@/components/icons/facebook-icon"
import { BodasNetIcon } from "@/components/icons/bodas-net-icon"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
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
import { brand, contactContent as contactContentEs, mapContent as mapContentEs, eventTypes as eventTypesEs } from "@/data/site-content"
import { contactContent as contactContentEn, mapContent as mapContentEn, eventTypes as eventTypesEn } from "@/data/site-content.en"
import { useLocale } from "@/lib/i18n"
import { getAttribution } from "@/lib/attribution"
import { submitLead } from "@/lib/leads"

const formCopy = {
  es: {
    firstName: "Nombre", firstNamePh: "Tu nombre", firstNameErr: "Introduce tu nombre",
    lastName: "Apellidos", lastNamePh: "Tus apellidos", lastNameErr: "Introduce tus apellidos",
    email: "Email", emailPh: "tu@email.com", emailErr: "Introduce un email válido",
    phone: "Teléfono", phonePh: "+34 ___ ___ ___", phoneErr: "Introduce un teléfono válido",
    eventType: "Tipo de evento", eventTypePh: "Selecciona una opción", eventTypeErr: "Selecciona el tipo de evento",
    eventDate: "Fecha prevista", eventDateErr: "Indica la fecha prevista",
    guestCount: "Invitados aproximados", guestCountPh: "Ej. 120", guestCountErr: "Indica un número aproximado de invitados",
    message: "Mensaje (opcional)", messagePh: "Cuéntanos más sobre tu celebración...",
    privacyLabel: "He leído y acepto la política de privacidad *", privacyErr: "Debes aceptar la política de privacidad",
    marketingLabel: "Acepto recibir comunicaciones comerciales (opcional)",
    submit: "Solicitar información",
    successMsg: "Gracias, hemos recibido tu solicitud. Te contactaremos lo antes posible.",
    notConfiguredMsg: "Formulario validado correctamente. El envío por email está pendiente de activar (falta la clave de Web3Forms).",
    errorMsg: "No hemos podido enviar tu solicitud. Escríbenos por WhatsApp o llámanos, por favor.",
    finca: "Finca", emailLabel: "Email", phoneLabel: "Teléfono",
  },
  en: {
    firstName: "First name", firstNamePh: "Your first name", firstNameErr: "Please enter your first name",
    lastName: "Last name", lastNamePh: "Your last name", lastNameErr: "Please enter your last name",
    email: "Email", emailPh: "you@email.com", emailErr: "Please enter a valid email",
    phone: "Phone", phonePh: "+34 ___ ___ ___", phoneErr: "Please enter a valid phone number",
    eventType: "Event type", eventTypePh: "Select an option", eventTypeErr: "Please select the event type",
    eventDate: "Planned date", eventDateErr: "Please indicate the planned date",
    guestCount: "Approximate guests", guestCountPh: "E.g. 120", guestCountErr: "Please indicate an approximate guest count",
    message: "Message (optional)", messagePh: "Tell us more about your celebration...",
    privacyLabel: "I have read and accept the privacy policy *", privacyErr: "You must accept the privacy policy",
    marketingLabel: "I agree to receive marketing communications (optional)",
    submit: "Request information",
    successMsg: "Thank you, we've received your request. We'll get back to you as soon as possible.",
    notConfiguredMsg: "Form validated successfully. Email delivery is pending activation (missing Web3Forms key).",
    errorMsg: "We couldn't send your request. Please reach us on WhatsApp or by phone.",
    finca: "Venue", emailLabel: "Email", phoneLabel: "Phone",
  },
} as const

const underlineFieldClass =
  "rounded-none border-0 border-b border-border bg-transparent px-0 py-3 h-auto shadow-none text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:border-foreground"

export function ContactSection() {
  const { locale } = useLocale()
  const contactContent = locale === "en" ? contactContentEn : contactContentEs
  const mapContent = locale === "en" ? mapContentEn : mapContentEs
  const eventTypes = locale === "en" ? eventTypesEn : eventTypesEs
  const t = formCopy[locale]

  const contactSchema = z.object({
    firstName: z.string().min(1, t.firstNameErr),
    lastName: z.string().min(1, t.lastNameErr),
    email: z.string().email(t.emailErr),
    phone: z.string().min(6, t.phoneErr),
    eventType: z.string().min(1, t.eventTypeErr),
    eventDate: z.string().min(1, t.eventDateErr),
    guestCount: z.string().min(1, t.guestCountErr),
    message: z.string().optional(),
    privacyConsent: z.boolean().refine((v) => v === true, {
      message: t.privacyErr,
    }),
    marketingConsent: z.boolean().optional(),
  })

  type ContactFormValues = z.infer<typeof contactSchema>

  const [isVisible, setIsVisible] = useState(false)
  const [submitState, setSubmitState] = useState<"idle" | "success" | "not-configured" | "error">("idle")
  const sectionRef = useRef<HTMLElement>(null)

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      eventType: "",
      eventDate: "",
      guestCount: "",
      message: "",
      privacyConsent: false,
      marketingConsent: false,
    },
  })

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

  const onSubmit = async (values: ContactFormValues) => {
    const result = await submitLead({
      ...values,
      attribution: getAttribution(),
    })

    if (result.ok) {
      setSubmitState("success")
      form.reset()
    } else {
      setSubmitState(result.reason === "not-configured" ? "not-configured" : "error")
    }
  }

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
                  onSubmit={form.handleSubmit(onSubmit)}
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
                            <Input placeholder={t.firstNamePh} className={underlineFieldClass} {...field} />
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
                            <Input placeholder={t.lastNamePh} className={underlineFieldClass} {...field} />
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
                            <Input type="email" placeholder={t.emailPh} className={underlineFieldClass} {...field} />
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
                            <Input type="tel" placeholder={t.phonePh} className={underlineFieldClass} {...field} />
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
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className={`${underlineFieldClass} w-full`}>
                                <SelectValue placeholder={t.eventTypePh} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {eventTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
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

                  {/* Guests */}
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
                              {t.privacyLabel}
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
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
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
                      disabled={form.formState.isSubmitting}
                      className="group inline-flex items-center gap-4 px-8 py-4 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 disabled:opacity-60"
                    >
                      <span className="text-sm tracking-[0.15em] uppercase">{t.submit}</span>
                      <svg
                        className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </button>

                    {submitState === "success" && (
                      <p className="text-sm text-foreground">{t.successMsg}</p>
                    )}
                    {submitState === "not-configured" && (
                      <p className="text-sm text-muted-foreground italic">{t.notConfiguredMsg}</p>
                    )}
                    {submitState === "error" && (
                      <p className="text-sm text-destructive">{t.errorMsg}</p>
                    )}
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
