# Cómo trabajar en este proyecto

Proyecto de Trabajo Fin de Máster con un cliente real detrás (El Portón de la
Condesa, Molina de Segura). No busca colaboradores externos: se publica para que
pueda evaluarse y leerse. Aun así, las reglas con las que se ha construido están
escritas, y quien toque el código —el autor incluido— debería seguirlas.

Las reglas completas y vinculantes están en [`CLAUDE.md`](CLAUDE.md). Este
documento es su versión corta.

## Antes de tocar nada

1. Lee el [README](README.md). Es la referencia técnica completa: arquitectura,
   modelo de datos, variables, comandos y decisiones.
2. Inspecciona el código antes de editarlo. La documentación puede haberse
   quedado atrás; el código, no.
3. Amplía este proyecto Next.js. No se crea un backend aparte.

## Puesta en marcha

```bash
npm ci
cp .env.example .env      # y rellenar: README §Variables de entorno
npx prisma migrate deploy
npm run db:seed
npm run admin:bootstrap
npm run dev
```

Requisitos: Node 22 o superior y npm. Docker solo para las pruebas E2E.

## Lo que no se hace

- **No se mezclan dos ORM, dos sistemas de autenticación ni dos fuentes de
  contenido.** Hay un único Prisma, un único Better Auth y un único CMS.
- **No se ocultan errores.** Nada de `ignoreBuildErrors`, `any`, `ts-ignore` ni
  exclusiones amplias en la configuración de lint o de tipos. Si el build se
  queja, el build tiene razón.
- **No se usa otro gestor de paquetes.** npm y `package-lock.json`; un segundo
  lockfile es un despliegue no reproducible esperando a ocurrir.
- **No se ponen secretos, contraseñas, tokens ni datos personales en archivos
  versionables.** Hay un test que lo comprueba y ya ha evitado una fuga real.
- **No se borran cambios ajenos.**
- **No se hace commit, push, cambio de visibilidad ni despliegue sin petición
  explícita.**

## Estructura de capas

Interfaz, validación, dominio y acceso a datos están separados, y conviene que
sigan estándolo:

| Capa | Dónde | Regla |
|---|---|---|
| Interfaz | `app/`, `components/` | Nunca habla con Prisma directamente |
| Validación | `lib/validation/` | Esquemas Zod compartidos cliente/servidor |
| Dominio | `lib/domain/` | Toda la lógica de negocio y las transacciones |
| Datos | `lib/db.ts`, `prisma/` | Un único cliente Prisma |

Dos reglas de seguridad que no son negociables:

- **Cada lectura o mutación privada valida la autorización en servidor.** Que la
  navegación oculte un apartado es interfaz, no protección. Ver
  `app/admin/(protected)/guards.ts` y `lib/auth/session.ts`.
- **El contenido VIP no se consulta, renderiza ni serializa antes de validar la
  sesión de acceso en servidor.** Hay una prueba que espía la capa de datos para
  comprobar que no se la llama (`components/vip/access-boundary.test.tsx`).

## Antes de dar algo por terminado

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Y si el cambio toca el recorrido del visitante, el panel o la publicación:

```bash
npm run e2e:setup    # contenedor de PostgreSQL aislado + escenario
npm run e2e
```

Las E2E **nunca** se ejecutan contra la base de datos de la aplicación. Hay una
guardia que aborta antes de abrir la conexión si la URL de pruebas coincide con
la de la aplicación o apunta a un host gestionado
(`lib/testing/e2e-database-guard.ts`). No se desactiva.

## Documentación

Cada cambio con consecuencias actualiza el README: estado, arquitectura,
funcionalidades, variables, comandos, pruebas, seguridad, decisiones y
pendientes, según corresponda. Los documentos de `docs/` amplían el README, no
lo sustituyen.

**No se marca como terminado lo que no se ha probado.** Si algo está a medias, se
escribe `PENDIENTE` y se dice qué falta. Un README que promete más de lo que hay
es peor que uno incompleto.

## Estilo

- Comentarios y documentación **en español**; identificadores y código en
  inglés, salvo los términos de dominio ya establecidos en el esquema.
- Los comentarios explican **por qué**, no qué. El qué ya lo dice el código.
- TypeScript estricto. Sin `any`.
- Los mensajes de error de cara al usuario no filtran detalles internos: ni
  rastro de Prisma, ni stack, ni valores recibidos.

## Seguridad

Si encuentras un problema de seguridad, **no abras una issue pública**. Escribe
al autor por el canal privado que corresponda. El proyecto trata datos personales
de contactos comerciales reales en cuanto se despliegue, y una vulnerabilidad
anunciada antes de estar corregida no ayuda a nadie.
