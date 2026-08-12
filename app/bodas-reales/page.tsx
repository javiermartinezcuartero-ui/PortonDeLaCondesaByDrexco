import type { Metadata } from "next"
import { VipLibrary } from "@/components/vip/vip-library"
import { vipLibraryMetadata } from "@/lib/vip/metadata"

/**
 * Dinámica siempre: la página depende de la cookie de acceso VIP y del
 * contenido publicado en ese momento. Es también lo que hace que publicar o
 * despublicar una ficha se vea de inmediato, sin esperar a revalidar.
 */
export const dynamic = "force-dynamic"

export const metadata: Metadata = vipLibraryMetadata("REAL_WEDDING")

export default function BodasRealesPage() {
  return <VipLibrary type="REAL_WEDDING" />
}
