# Checklist de aceptación

Requisitos del proyecto y su estado real, con la evidencia que lo respalda.

**Cómo leer el estado:**

- **Cumplido** — implementado y comprobado con una prueba automática o una
  verificación manual documentada.
- **Parcial** — funciona, con una limitación conocida que se indica.
- **Pendiente** — no está. Con el motivo.
- **Fuera de alcance** — decidido explícitamente que no entra.

Nada figura como cumplido sin evidencia. Si la columna de evidencia dice "sin
comprobar", el estado no es "Cumplido".

Última revisión: **13 de agosto de 2026** (cierre de la Fase 11).

---

## 1. Sitio público

| # | Requisito | Estado | Evidencia |
|---|---|---|---|
| 1.1 | Diseño, tipografías, animaciones y responsive conservados del original | Cumplido | Revisión visual en las Fases 1–5; ningún componente de presentación reescrito sin motivo |
| 1.2 | Español e inglés, con conmutador | Cumplido | `lib/i18n.tsx`; `data/site-content.ts` / `.en.ts` |
| 1.3 | Home con secciones, espacios, gastronomía y contacto | Cumplido | `app/page.tsx` |
| 1.4 | Aviso legal, política de privacidad y de cookies | Cumplido | Tres rutas responden 200; contenido revisado en la Fase 9 |
| 1.5 | Banner de cookies con consentimiento | Cumplido | `components/cookie-consent.tsx`; sin cookies de análisis ni marketing |
| 1.6 | SEO: metadatos, `robots.txt`, `sitemap.xml`, datos estructurados | Cumplido | `app/robots.ts`, `app/sitemap.ts`, `components/structured-data.tsx` |
| 1.7 | El panel no se indexa | Cumplido | `robots: noindex` en el layout de `/admin`; `Disallow` en `robots.txt` |
| 1.8 | Build sin dependencias de red | Cumplido | Tipografías locales (`app/fonts/`); build reproducible sin salir a Internet |

## 2. Zona VIP y captación

| # | Requisito | Estado | Evidencia |
|---|---|---|---|
| 2.1 | El contenido VIP no se consulta ni se serializa sin acceso válido | Cumplido | E2E 1 comprueba el HTML servido; `components/vip/access-boundary.test.tsx` |
| 2.2 | El acceso se concede con email y consentimiento de privacidad | Cumplido | E2E 2 y 3 |
| 2.3 | La privacidad es obligatoria; el marketing, opcional y separado | Cumplido | E2E 2 y 2b; `lib/domain/consents.ts` |
| 2.4 | Un acceso desbloquea las dos bibliotecas | Cumplido | E2E 3 |
| 2.5 | La sesión VIP es una cookie `HttpOnly` respaldada en base de datos | Cumplido | `lib/vip/session.ts`; solo se guarda el HMAC del token |
| 2.6 | Las interacciones con el contenido se registran sin duplicar | Cumplido | E2E 5: una recarga no cuenta como visita nueva |
| 2.7 | El CTA de una ficha crea una solicitud atribuida a esa ficha | Cumplido | E2E 6 |
| 2.8 | Formulario propio, sin servicios de terceros | Cumplido | `POST /api/leads/requests`; Web3Forms retirado en la Fase 6 |
| 2.9 | Antibot sin CAPTCHA: honeypot, tiempo mínimo, límite por IP y por email | Cumplido | `app/api/leads/requests/route.test.ts` |
| 2.10 | Guardar una solicitud no depende del proveedor de correo | Cumplido | E2E 6: el aviso queda como `SKIPPED_CONFIG` y la solicitud se guarda |

## 3. Panel, CRM y CMS

| # | Requisito | Estado | Evidencia |
|---|---|---|---|
| 3.1 | Autenticación con email y contraseña, sin alta pública | Cumplido | E2E 7; `emailAndPassword.disableSignUp` |
| 3.2 | Tres perfiles con permisos distintos | Cumplido | E2E 11 y 12c; `lib/auth/session.ts` |
| 3.3 | Autorización validada en servidor en cada lectura y mutación | Cumplido | `lib/security/attack-surface.test.ts` (21 pruebas de ataque) |
| 3.4 | Contactos con búsqueda, filtros y vista 360º | Cumplido | `app/admin/(protected)/contactos/`; `lib/domain/crm.test.ts` |
| 3.5 | Solicitudes con filtros en la URL y detalle editable | Cumplido | `lib/domain/crm-requests.ts` |
| 3.6 | Pipeline con tablero y alternativa accesible en tabla | Cumplido | `?vista=tabla`; sin arrastrar y soltar, por accesibilidad |
| 3.7 | Transiciones de estado validadas en servidor; motivo obligatorio al perder | Cumplido | E2E 10 y 10b |
| 3.8 | Tareas con vistas, asignación y cancelación sin borrar historial | Parcial | E2E 10. **Limitación:** el enlace con la solicitud vive en la actividad, no como columna de la tarea (§Limitaciones, L1) |
| 3.9 | Notas internas con autor, fecha y edición auditada | Cumplido | `lib/domain/notes.ts` |
| 3.10 | Puntuación configurable, sin sumar dos veces el mismo hito | Cumplido | `lib/domain/scoring.test.ts` |
| 3.11 | Exportación a Excel (`.xlsx`) solo ADMIN, con filtros y celdas tipadas —la inyección de fórmulas dejó de ser posible— | Cumplido | `lib/domain/crm-workbook.test.ts`; `app/api/admin/crm/export/route.test.ts` |
| 3.12 | CMS: borrador, media, previsualización, publicación y archivado | Cumplido | E2E 8 |
| 3.13 | Publicar exige título en español, slug e imagen principal con alt | Cumplido | `getMissingPublicationRequirements`; `lib/domain/content-cms.test.ts` |
| 3.14 | Lo publicado aparece en su ruta y no en la de la otra biblioteca | Cumplido | E2E 9 |
| 3.15 | Validación de imágenes por bytes reales, no por extensión | Cumplido | `lib/storage/validate-image.test.ts`; E2E 8 sube un PNG generado |
| 3.16 | Nombre de objeto decidido en servidor | Cumplido | E2E 8 comprueba que el nombre subido no aparece en la ruta |
| 3.17 | Auditoría de cada operación sensible | Cumplido | E2E 8 y 10 comprueban `AuditEvent` con actor |

## 4. Seguridad y privacidad

| # | Requisito | Estado | Evidencia |
|---|---|---|---|
| 4.1 | Sin secretos en archivos versionables | Cumplido | `lib/security/secrets-scan.test.ts` recorre lo que git subiría, con 11 patrones |
| 4.2 | Cabeceras de seguridad y CSP | Parcial | `lib/security/headers.test.ts`. **La CSP va en Report-Only** salvo `CSP_ENFORCE=true` (§Limitaciones, L2) |
| 4.3 | Límite de intentos persistente, sin estado en memoria | Cumplido | `lib/security/rate-limit.test.ts` |
| 4.4 | IP y user-agent no se guardan en las sesiones | Cumplido | E2E 7 lo comprueba sobre la tabla |
| 4.5 | Cerrar sesión revoca de verdad | Cumplido | E2E 13: la cookie anterior deja de servir |
| 4.6 | Logs sin datos personales, tokens ni stack | Cumplido | `lib/observability/log.test.ts` |
| 4.7 | Healthcheck sin versiones ni configuración | Cumplido | `app/api/health/route.ts`; smoke test 1 |
| 4.8 | Derechos RGPD operativos: acceso, revocación, anonimización | Cumplido | `lib/domain/privacy.test.ts` |
| 4.9 | La anonimización no deja identificable a la persona | Cumplido | `lib/domain/privacy.test.ts`; también borra mensajes y notas |
| 4.10 | Retención configurable que no borra sola | Cumplido | `npm run privacy:retention` informa, no anonimiza |
| 4.11 | Modelo de amenazas documentado | Cumplido | `docs/modelo-amenazas.md` |
| 4.12 | Base jurídica y plazo de retención revisados por un profesional | **Pendiente** | Aviso explícito en README §Pendientes legales. No se inventa (§Limitaciones, L3) |
| 4.13 | Verificación del email en el gate VIP | **Pendiente** | Riesgo aceptado y anotado en `docs/modelo-amenazas.md` §7 (§Limitaciones, L4) |
| 4.14 | Segundo factor para ADMIN | **Pendiente** | Riesgo aceptado, `docs/modelo-amenazas.md` §7 |
| 4.15 | Auditoría de dependencias | Parcial | `npm audit`: 3 vulnerabilidades altas heredadas de `next@16.0.10` (§Limitaciones, L5) |

## 5. Calidad y operación

| # | Requisito | Estado | Evidencia |
|---|---|---|---|
| 5.1 | Un único lockfile | Cumplido | Solo `package-lock.json` |
| 5.2 | Sin `ignoreBuildErrors`, `any`, `ts-ignore` ni exclusiones amplias | Cumplido | `next.config.mjs` limpio; `npm run typecheck` sin errores |
| 5.3 | Lint sin errores ni advertencias | Cumplido | `npm run lint` |
| 5.4 | Pruebas unitarias y de integración | Cumplido | Ver §Resultados |
| 5.5 | Pruebas E2E de los 13 escenarios críticos | Cumplido | `docs/pruebas-e2e.md` |
| 5.6 | E2E contra base aislada, sin riesgo para producción | Cumplido | `lib/testing/e2e-database-guard.test.ts` |
| 5.7 | Integración continua | Cumplido | `.github/workflows/ci.yml`: `npm ci` → lint → typecheck → test → secret scan del historial → build. Verde comprobado simulando el entorno del runner sin `.env`: 329 pasan, 325 se saltan solas |
| 5.8 | E2E en integración continua | **Pendiente** | Requiere un contenedor de servicio y credenciales de Storage en CI (§Limitaciones, L6) |
| 5.9 | Imágenes optimizadas y `remotePatterns` mínimos | Cumplido | Solo el host de Supabase y solo la ruta de objetos firmados |
| 5.10 | Migraciones revisadas, ordenadas y documentadas | Cumplido | `docs/migraciones.md`; las 8 se aplican sobre base virgen |
| 5.11 | Procedimiento de corrección ante una migración fallida | Cumplido | `docs/migraciones.md` §4 |
| 5.12 | Seed de demostración separado del base | Cumplido | `prisma/seed.ts` (configuración) vs `scripts/demo-seed.ts` (demo) |
| 5.13 | Bootstrap del ADMIN separado | Cumplido | `scripts/admin-bootstrap.ts` |
| 5.14 | Demo idempotente y con procedimiento de retirada | Cumplido | `docs/runbook-demo.md` |
| 5.15 | Documentación de despliegue | Cumplido | `docs/despliegue-vercel.md` |
| 5.16 | Manual para el equipo | Cumplido | `docs/manual-admin.md` |
| 5.17 | Despliegue realizado | **Pendiente** | El enunciado de la fase pedía preparar el despliegue, no ejecutarlo |
| 5.18 | Métricas de Lighthouse sobre el sitio desplegado | **Pendiente** | Requiere el sitio en producción |

## 6. Entrega y publicación (Fase 11)

| # | Requisito | Estado | Evidencia |
|---|---|---|---|
| 6.1 | README autocontenido: entender y reproducir sin leer otro archivo | Cumplido | 37 secciones, incluidas problema, objetivos, alcance, casos de uso, diagrama de componentes, modelo de datos, decisiones, accesibilidad, SEO, rendimiento, licencia y derechos |
| 6.2 | `.gitignore` seguro | Cumplido | Regla de `.env` en negativo; volcados, exportaciones, subidas y `.vercel` añadidos. Comprobado que las 9 migraciones `.sql` siguen versionadas |
| 6.3 | Ningún `.env`, volcado, subida real ni PII en el árbol versionable | Cumplido | `docs/publicacion-github.md` §1 y §3. Solo las dos plantillas sin valores |
| 6.4 | Secret scan del **árbol** | Cumplido | `lib/security/secrets-scan.test.ts`: 8 pruebas, 11 patrones, 0 hallazgos. Incluye archivos de texto sin extensión |
| 6.5 | Secret scan del **historial** | Cumplido | `npm run secrets:history`: 5 commits, 288 versiones de archivo, **0 hallazgos**. No ha hecho falta reescribir historial |
| 6.6 | `NOTICE` que deja marca, fotografías y textos fuera de la licencia de software | Cumplido | `NOTICE`, archivo por archivo |
| 6.7 | `CONTRIBUTING` | Cumplido | `CONTRIBUTING.md` |
| 6.8 | Plantilla de release/tag de entrega | Cumplido | `.github/RELEASE_TEMPLATE.md`, con convenio de tag y comprobaciones previas |
| 6.9 | Documentos de entrega | Cumplido | `checklist-entrega-tfm.md`, `guion-presentacion-tfm.md`, `guion-video-obs.md`, `formulario-entrega-tfm.md` |
| 6.10 | Procedimiento de cuenta de evaluación independiente y retirable | Cumplido | `docs/runbook-demo.md`; `npm run demo:clean -- --cuenta`. Credenciales solo por canal privado |
| 6.11 | Ninguna credencial en README, repositorio, Slides, vídeo o release | Cumplido | Regla repetida en los cuatro documentos y en la plantilla de release. Verificado por el escáner de secretos |
| 6.12 | Ninguna URL ficticia presentada como real | Cumplido | Marcadores `[PENDIENTE: URL]` literales y declarados como tales |
| 6.13 | `LICENSE` | **Pendiente** | Decisión del titular. Cinco opciones con sus implicaciones en `docs/publicacion-github.md` §6 |
| 6.14 | Repositorio público | **Pendiente** | Preparado y comprobado; cambiar la visibilidad es una acción manual. El enunciado pedía no ejecutarla |
| 6.15 | URL de aplicación, README público, Slides, vídeo y dashboard | **Pendiente** | Cuelgan del despliegue y de la publicación. Estado en `docs/checklist-entrega-tfm.md` |
| 6.16 | Comprobación de permisos en incógnito | **Pendiente** | No se puede hacer sin las URL. Procedimiento y tabla de fechas en `docs/checklist-entrega-tfm.md` §3 |

---

## Limitaciones conocidas

**L1 — La tarea no guarda a qué solicitud pertenece.**
`FollowUpTask` se ata al contacto. El enlace con una solicitud concreta se registra en
la actividad que genera su creación (`LeadActivity.leadRequestId`), no como columna de
la tarea. Consecuencia práctica: la vista de Tareas no puede mostrar "para qué
solicitud" ni filtrar por ella. Arreglarlo es una columna, una migración y un cambio
en la vista; no se ha hecho en la Fase 10 porque es alcance de la Fase 7 y toca el
esquema.

**L2 — La CSP no bloquea todavía.**
Se sirve como `Content-Security-Policy-Report-Only` salvo que `CSP_ENFORCE=true`. Es
una decisión: `script-src` necesita `'unsafe-inline'` para los scripts de hidratación
de Next, y pasar a nonces por petición exige tocar el render. Una CSP que rompe la web
en el primer despliegue se acaba desactivando entera, así que primero se observa.
Mitigación real ya activa: `frame-ancestors 'none'`, `object-src 'none'`,
`base-uri 'self'`, `form-action 'self'` y ningún comodín.

**L3 — Los textos legales necesitan revisión profesional.**
La política de privacidad describe correctamente los tratamientos y los encargados
reales, pero **el plazo de retención concreto y la base jurídica de cada tratamiento
los tiene que fijar un profesional**. El código no inventa ninguno de los dos:
`DATA_RETENTION_MONTHS` tiene un valor por defecto explícitamente provisional y los
textos llevan el aviso.

**L4 — El gate VIP acepta el email de otra persona.**
No hay verificación por enlace, así que alguien puede escribir una dirección que no es
suya y acceder. Está aceptado a conciencia: el contenido protegido son fotos de bodas
publicables, no datos sensibles, y exigir verificación por correo antes de ver una
galería hundiría la conversión. La infraestructura para activarla está preparada
(plantilla de verificación incluida en la Fase 8, sin usar).

**L5 — Tres vulnerabilidades altas heredadas de Next 16.0.10.**
`npm audit` reporta 3 (en `postcss` y `sharp`, dependencias transitivas). El arreglo
disponible es subir a `next@16.3.0`, fuera del rango declarado. **No se ha aplicado**:
es un cambio de versión de framework que toca render y build, y merece su propia fase
con la suite completa como red, no un `--force` al final de otra.

**L6 — Las E2E no están en integración continua.**
Necesitan un PostgreSQL de servicio y las credenciales de Supabase Storage como
secretos del repositorio. Se ejecutan en local con un comando
(`npm run e2e:setup && npm run e2e`) y la guardia de base de datos ya contempla el
caso de CI (`E2E_ALLOW_NONLOCAL`), así que añadirlas es configuración, no desarrollo.

---

## Resultados de la última validación

Ejecutado el 13 de agosto de 2026 sobre el repositorio completo. Ver
`docs/evidencias-tfm.md` para la salida.

| Comando | Resultado |
|---|---|
| `npm ci` | Correcto |
| `npm run lint` | 0 errores, 0 advertencias |
| `npm run typecheck` | Sin errores |
| `npm test` | 58 archivos, **698 pruebas**, todas verdes — **dos pasadas completas seguidas** |
| `npm run e2e` | 6 archivos, **23 pruebas**, todas verdes (1,4 min incluyendo el build) |
| `npm run build` | Correcto, sin ninguna petición de red |
| `npx prisma validate` | Esquema válido |
| `npx prisma generate` | Cliente generado |
| Escáner de secretos | Sin hallazgos; ningún archivo sensible versionado |
| `npm audit` | 3 vulnerabilidades altas, todas de `sharp`/`postcss` vía `next@16.0.10` |

---

## Criterio de aceptación global

El proyecto se considera **apto para desplegar** con estas condiciones:

1. Las cinco pendientes de seguridad y legales (4.12 a 4.15, L2 a L5) están
   documentadas con su motivo y ninguna es un fallo de implementación: son decisiones
   con dueño.
2. La 4.12 (**revisión jurídica**) es la única que debería resolverse **antes de
   recoger datos de personas reales**. Las demás pueden convivir con producción.
3. Las pendientes de operación (5.17, 5.18) se resuelven al desplegar, que es el paso
   siguiente.
