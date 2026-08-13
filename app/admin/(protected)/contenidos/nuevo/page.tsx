import type { Metadata } from "next"
import Link from "next/link"
import { requireCmsAccess } from "../../guards"
import { NewContentForm } from "./new-content-form"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Nueva ficha de contenido",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

export default async function NewContentPage() {
  await requireCmsAccess()

  return (
    <div className="max-w-xl space-y-8">
      <div className="space-y-2">
        <Link
          href="/admin/contenidos"
          className="text-xs tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition-colors duration-300"
        >
          ← Contenidos
        </Link>
        <h1 className="font-serif text-3xl font-light text-foreground">Nueva ficha</h1>
        <p className="text-sm text-muted-foreground">
          Se creará como <strong className="font-normal text-foreground">borrador</strong>. El resto de campos se
          rellenan en el editor.
        </p>
      </div>

      <NewContentForm />
    </div>
  )
}
