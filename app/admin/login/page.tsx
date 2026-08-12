import type { Metadata } from "next"
import Image from "next/image"
import { brand } from "@/data/site-content"
import { LoginForm } from "./login-form"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Acceso privado",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
}

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-24">
      <div className="w-full max-w-sm space-y-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <Image
            src="/brand/icon-porton-hq.png"
            alt={brand.name}
            width={56}
            height={56}
            className="opacity-90"
          />
          <div className="space-y-1">
            <h1 className="font-serif text-2xl font-light text-foreground">Acceso privado</h1>
            <p className="text-sm text-muted-foreground">{brand.name} — equipo interno</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
