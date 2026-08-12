import type { Metadata } from "next"
import { VipLibrary } from "@/components/vip/vip-library"
import { vipLibraryMetadata } from "@/lib/vip/metadata"

export const dynamic = "force-dynamic"

export const metadata: Metadata = vipLibraryMetadata("CATERING_EVENT")

export default function CateringPage() {
  return <VipLibrary type="CATERING_EVENT" />
}
