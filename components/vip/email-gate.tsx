"use client"

import { useEffect, useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LockOpen } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { hasVipAccess, grantVipAccess, submitVipEmail, type VipGateKey } from "@/lib/vip-access"
import { vipGateContent as vipGateContentEs, vipGateContentEn } from "@/data/vip-stories"
import { useLocale } from "@/lib/i18n"

const gateErrors = {
  es: { email: "Introduce un email válido", consent: "Debes aceptar para continuar" },
  en: { email: "Please enter a valid email", consent: "You must agree to continue" },
} as const

export function EmailGate({ gateKey, children }: { gateKey: VipGateKey; children: React.ReactNode }) {
  const { locale } = useLocale()
  const vipGateContent = locale === "en" ? vipGateContentEn : vipGateContentEs
  const errors = gateErrors[locale]
  const gateSchema = z.object({
    email: z.string().email(errors.email),
    consent: z.boolean().refine((v) => v === true, { message: errors.consent }),
  })
  const [unlocked, setUnlocked] = useState<boolean | null>(null)
  // TODO(pre-producción): quitar el botón de "saltar" y el cierre libre del
  // gate antes de publicar. Es una facilidad temporal para revisar el sitio
  // sin tener que dejar un email en cada prueba.
  const [skipped, setSkipped] = useState(false)

  useEffect(() => {
    setUnlocked(hasVipAccess(gateKey))
  }, [gateKey])

  const form = useForm<{ email: string; consent: boolean }>({
    resolver: zodResolver(gateSchema),
    defaultValues: { email: "", consent: false },
  })

  const onSubmit = async (values: { email: string; consent: boolean }) => {
    grantVipAccess(gateKey, values.email)
    setUnlocked(true)
    void submitVipEmail(gateKey, values.email)
  }

  if (unlocked === null) {
    return null
  }

  const visible = unlocked || skipped
  const gateOpen = !visible

  return (
    <>
      {visible ? children : <div aria-hidden className="pointer-events-none select-none blur-sm">{children}</div>}

      <Dialog open={gateOpen} onOpenChange={(open) => { if (!open) setSkipped(true) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-light">{vipGateContent.title}</DialogTitle>
            <DialogDescription>{vipGateContent.description}</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
            <Input
              type="email"
              placeholder={vipGateContent.placeholder}
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <Checkbox
                checked={form.watch("consent")}
                onCheckedChange={(v) => form.setValue("consent", v === true)}
              />
              {vipGateContent.consentLabel}
            </label>
            {form.formState.errors.consent && (
              <p className="text-sm text-destructive">{form.formState.errors.consent.message}</p>
            )}
            <button
              type="submit"
              className="w-full px-6 py-3 text-sm tracking-[0.1em] uppercase text-primary-foreground bg-primary hover:bg-primary/90 transition-colors duration-300"
            >
              {vipGateContent.submitLabel}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setSkipped(true)}
            className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors duration-300"
          >
            <LockOpen className="h-3.5 w-3.5" />
            {vipGateContent.skipLabel}
          </button>
        </DialogContent>
      </Dialog>
    </>
  )
}
