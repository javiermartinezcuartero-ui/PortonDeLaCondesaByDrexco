"use client"

import { brand } from "@/data/site-content"

export function WhatsAppButton() {
  const url = `https://wa.me/${brand.whatsapp.number}?text=${encodeURIComponent(brand.whatsapp.message)}`

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Escribir por WhatsApp al ${brand.whatsapp.displayNumber}`}
      title="Escríbenos por WhatsApp"
      className="floating-action fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-[transform,bottom] duration-300 hover:scale-105"
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden="true">
        <path d="M16.004 3C9.096 3 3.5 8.596 3.5 15.504c0 2.61.79 5.033 2.15 7.06L4 29l6.63-1.62a12.42 12.42 0 0 0 5.374 1.226h.005c6.907 0 12.503-5.596 12.503-12.504C28.512 8.596 22.916 3 16.004 3Zm0 22.79a10.24 10.24 0 0 1-5.222-1.43l-.375-.223-3.934.962.98-3.834-.244-.393a10.23 10.23 0 0 1-1.57-5.396c0-5.663 4.608-10.27 10.27-10.27 2.744 0 5.322 1.07 7.26 3.01a10.207 10.207 0 0 1 3.008 7.26c0 5.663-4.607 10.27-10.173 10.27Zm5.633-7.693c-.31-.155-1.83-.902-2.113-1.005-.283-.104-.489-.155-.695.155-.206.31-.797 1.005-.977 1.212-.18.206-.36.232-.667.078-.31-.155-1.306-.481-2.487-1.535-.919-.82-1.539-1.831-1.719-2.14-.18-.31-.02-.478.16-.633.155-.155.36-.362.54-.542.18-.18.24-.31.36-.517.12-.206.06-.387-.03-.542-.09-.155-.712-1.717-.977-2.35-.257-.615-.517-.53-.712-.54h-.61c-.206 0-.542.078-.826.386-.283.31-1.082 1.056-1.082 2.573s1.108 2.986 1.262 3.192c.155.206 2.135 3.258 5.176 4.437 2.55.996 3.07.799 3.624.749.554-.05 1.796-.734 2.05-1.443.257-.71.257-1.315.18-1.443-.078-.128-.283-.206-.593-.361Z" />
      </svg>
    </a>
  )
}
