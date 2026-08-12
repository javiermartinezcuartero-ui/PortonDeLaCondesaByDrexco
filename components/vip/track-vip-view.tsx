"use client"

import { useEffect } from "react"
import type { ContentType } from "@prisma/client"
import { trackVipViewAction } from "@/lib/vip/track-action"

/**
 * Dispara el registro de vista una vez por montaje. No renderiza nada.
 *
 * Se hace desde el cliente y no durante el render en servidor para no
 * convertir un render (repetible, o provocado por un prefetch) en una visita.
 * La deduplicación real está en servidor (`recordContentViewOnce`).
 */
export function TrackVipView({
  section,
  contentEntryId,
}: {
  section: ContentType
  contentEntryId?: string
}) {
  useEffect(() => {
    void trackVipViewAction({
      section,
      type: contentEntryId ? "CONTENT_VIEWED" : "SECTION_VIEWED",
      contentEntryId,
    })
  }, [section, contentEntryId])

  return null
}
