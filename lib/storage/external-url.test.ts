import { describe, expect, it } from "vitest"
import { InvalidExternalUrlError, validateExternalUrl, validateVideoUrl } from "@/lib/storage/external-url"

describe("validateExternalUrl — esquemas", () => {
  it("acepta https", () => {
    expect(validateExternalUrl("https://cdn.example.com/imagen.jpg")).toBe("https://cdn.example.com/imagen.jpg")
  })

  it("rechaza http (sin cifrar)", () => {
    expect(() => validateExternalUrl("http://cdn.example.com/imagen.jpg")).toThrow(/https/i)
  })

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)", "file:///etc/passwd"])(
    "rechaza el esquema no seguro %s",
    (url) => {
      expect(() => validateExternalUrl(url)).toThrow(InvalidExternalUrlError)
    }
  )

  it("rechaza una URL con credenciales incrustadas", () => {
    expect(() => validateExternalUrl("https://usuario:clave@example.com/x.jpg")).toThrow(/credenciales/i)
  })

  it("rechaza una cadena que no es una URL", () => {
    expect(() => validateExternalUrl("no-es-una-url")).toThrow(/formato/i)
  })
})

describe("validateExternalUrl — anti-SSRF", () => {
  it.each([
    ["localhost", "https://localhost/x.jpg"],
    ["loopback IPv4", "https://127.0.0.1/x.jpg"],
    ["loopback IPv6", "https://[::1]/x.jpg"],
    ["metadatos de cloud", "https://169.254.169.254/latest/meta-data/"],
    ["red privada 10.x", "https://10.0.0.5/x.jpg"],
    ["red privada 172.16.x", "https://172.16.0.1/x.jpg"],
    ["red privada 192.168.x", "https://192.168.1.1/x.jpg"],
    ["this host 0.0.0.0", "https://0.0.0.0/x.jpg"],
    ["CGNAT 100.64.x", "https://100.64.0.1/x.jpg"],
    ["dominio .internal", "https://servicio.internal/x.jpg"],
    ["dominio .local", "https://nas.local/x.jpg"],
    ["IPv6 link-local", "https://[fe80::1]/x.jpg"],
    ["multicast", "https://239.255.255.250/x.jpg"],
  ])("rechaza %s", (_descripcion, url) => {
    expect(() => validateExternalUrl(url)).toThrow(/interna o privada/i)
  })

  it("acepta una IP pública", () => {
    expect(validateExternalUrl("https://8.8.8.8/x.jpg")).toContain("8.8.8.8")
  })

  it("acepta 172.32.x, que está fuera del rango privado 172.16–172.31", () => {
    expect(validateExternalUrl("https://172.32.0.1/x.jpg")).toContain("172.32.0.1")
  })
})

describe("validateVideoUrl — lista de hosts", () => {
  it.each([
    "https://www.youtube.com/watch?v=abc123",
    "https://youtu.be/abc123",
    "https://vimeo.com/123456",
    "https://www.instagram.com/reel/abc123/",
  ])("acepta %s", (url) => {
    expect(validateVideoUrl(url)).toContain("https://")
  })

  it("rechaza un host de vídeo no incluido en la lista", () => {
    expect(() => validateVideoUrl("https://videos-cualquiera.example.com/v/1")).toThrow(/host no permitido/i)
  })

  it("aplica también el filtro anti-SSRF, no solo la lista de hosts", () => {
    expect(() => validateVideoUrl("https://127.0.0.1/v/1")).toThrow(/interna o privada/i)
  })
})
