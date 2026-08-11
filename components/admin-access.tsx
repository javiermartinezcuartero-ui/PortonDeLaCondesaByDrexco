"use client"

import { useState } from "react"
import { Settings } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { adminAccessContent as adminAccessContentEs } from "@/data/site-content"
import { adminAccessContent as adminAccessContentEn } from "@/data/site-content.en"
import { useLocale } from "@/lib/i18n"

export function AdminAccess() {
  const { locale } = useLocale()
  const adminAccessContent = locale === "en" ? adminAccessContentEn : adminAccessContentEs
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [showMessage, setShowMessage] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO(admin-backend): sustituir por autenticación real (NextAuth/Auth.js)
    // contra /admin cuando el backend de administración esté implementado.
    setShowMessage(true)
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={adminAccessContent.tooltip}
            className="floating-action fixed bottom-5 left-5 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-70 shadow-md transition-[opacity,bottom] duration-300 hover:opacity-100"
          >
            <Settings className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{adminAccessContent.tooltip}</TooltipContent>
      </Tooltip>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setPassword("")
            setShowMessage(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{adminAccessContent.dialogTitle}</DialogTitle>
            <DialogDescription>{adminAccessContent.dialogDescription}</DialogDescription>
          </DialogHeader>
          {showMessage ? (
            <p className="text-sm text-muted-foreground">{adminAccessContent.pendingMessage}</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={adminAccessContent.placeholder}
                autoFocus
              />
              <DialogFooter>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm tracking-[0.1em] uppercase text-primary-foreground bg-primary hover:bg-primary/90 transition-colors duration-300"
                >
                  {adminAccessContent.submitLabel}
                </button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
