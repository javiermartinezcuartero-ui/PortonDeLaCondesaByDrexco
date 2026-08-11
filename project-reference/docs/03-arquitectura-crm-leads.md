# Arquitectura de captación, zona VIP y CRM

## Objetivo

Convertir tráfico anónimo en oportunidades comerciales medibles y proporcionar al equipo una herramienta de seguimiento de cada solicitud desde el primer formulario hasta la contratación.

## Flujo

1. El visitante llega desde SEO, campañas, redes sociales o acceso directo.
2. Navega por bodas, espacios, gastronomía, catering o eventos corporativos.
3. Solicita dossier, información, visita o acceso a una galería/reportaje completo.
4. El sistema crea o actualiza un lead.
5. Se registran página de entrada, referrer y UTMs.
6. Se envía un enlace mágico para zona VIP cuando corresponda.
7. El CRM registra interacciones y recalcula scoring.
8. El equipo comercial gestiona contacto, visita, propuesta, negociación y cierre.

## Pipeline

- `NEW`
- `CONTACTED`
- `QUALIFIED`
- `VISIT_SCHEDULED`
- `PROPOSAL_SENT`
- `NEGOTIATION`
- `WON`
- `LOST`
- `NURTURING`
- `UNSUBSCRIBED`

## Entidades

### Lead

`id`, `email`, `firstName`, `lastName`, `phone`, `eventType`, `eventDate`, `guestCount`, `budgetRange`, `message`, `status`, `score`, `source`, `landingPath`, `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm`, `ownerId`, `createdAt`, `updatedAt`, `lastActivityAt`, `nextActionAt`, `lostReason`.

### Consent

`id`, `leadId`, `purpose`, `granted`, `policyVersion`, `grantedAt`, `revokedAt`, `ipHash`, `userAgent`.

### Activity

Tipos iniciales: `FORM_SUBMITTED`, `VIP_ACCESSED`, `DOSSIER_DOWNLOADED`, `EMAIL_SENT`, `EMAIL_OPENED`, `LINK_CLICKED`, `CALL`, `WHATSAPP`, `NOTE`, `STATUS_CHANGED`, `VISIT`, `PROPOSAL`.

### VipAccessToken

`id`, `leadId`, `tokenHash`, `expiresAt`, `usedAt`, `revokedAt`. Nunca almacenar el token en claro.

### User

Roles: `ADMIN`, `SALES`, `CONTENT`.

### Tag / LeadTag

Etiquetas para tipo de evento, año, rango de invitados, canal, prioridad u otros criterios.

## Scoring inicial

- formulario enviado: +10
- teléfono informado: +10
- fecha informada: +10
- invitados informados: +10
- acceso VIP: +10
- descarga de dossier: +15
- consulta de 3 o más reportajes: +10
- solicitud de visita: +25

Los pesos deben ser configurables.

## Dashboard

- leads nuevos;
- pendientes de primer contacto;
- visitas programadas;
- propuestas enviadas;
- ganados/perdidos;
- tiempo medio de respuesta;
- conversión por canal/campaña;
- próximas acciones vencidas;
- scoring medio;
- pipeline Kanban;
- ficha 360º del lead con timeline.

## Seguridad y privacidad

- validación cliente/servidor;
- rate limit;
- honeypot;
- sanitización de texto libre;
- consentimientos separados;
- roles administrativos;
- cookies seguras;
- tokens VIP hasheados y con caducidad;
- auditoría de cambios relevantes;
- exportación/baja/borrado de datos;
- no almacenar información innecesaria.

## Stack recomendado si la plantilla no impone otro

Next.js + TypeScript + Tailwind + PostgreSQL + Prisma + Auth.js + Zod + React Hook Form + SendGrid + Vitest + Playwright.
