# Boda-Fotos — Recopilación de fotografías de invitados

Aplicación web para que los invitados de una boda suban, desde su móvil y sin
instalar nada, las fotografías que han hecho durante el evento. El fotógrafo
crea el evento, obtiene una URL privada y un código QR, y las fotos aterrizan
directamente en su Google Drive. Los invitados **nunca** ven Drive, ni las
fotos de otros, ni pueden descargar/editar/borrar nada.

> **Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · PostgreSQL ·
> Prisma · Google Drive API (OAuth 2.0) · Zod · Docker · Playwright/Vitest.

---

## Índice

1. [Decisiones técnicas principales](#1-decisiones-técnicas-principales)
2. [Cómo se resuelven las subidas grandes sin agotar memoria](#2-subidas-grandes-sin-agotar-memoria)
3. [Estructura del proyecto](#3-estructura-del-proyecto)
4. [Configurar Google Cloud y Google Drive (paso a paso)](#4-configurar-google-cloud-y-google-drive)
5. [Desarrollo local](#5-desarrollo-local)
6. [Despliegue](#6-despliegue)
7. [Modelo de acceso público y seguridad](#7-modelo-de-acceso-público-y-seguridad)
8. [API](#8-api)
9. [Pruebas](#9-pruebas)
10. [Checklist de seguridad](#10-checklist-de-seguridad)
11. [Privacidad y conservación](#11-privacidad-y-conservación)

---

## 1. Decisiones técnicas principales

**Dos modos de autenticación con Drive; elige uno con una variable.**

- **Modo A — RECOMENDADO si tienes Google Workspace: cuenta de servicio +
  Unidad compartida.** Es el modo más robusto: **no caduca nunca** (no hay
  refresh token ni pantalla de consentimiento que mantener). Una cuenta de
  servicio **no tiene cuota propia**, pero al escribir en una **Unidad
  compartida** la cuota es la de tu Workspace y todo funciona. Configuras
  `GOOGLE_SERVICE_ACCOUNT_KEY` (el JSON de la clave) y
  `GOOGLE_DRIVE_SHARED_DRIVE_ID`.
- **Modo B — sin Workspace: OAuth con la cuenta del fotógrafo.** Usa un
  *refresh token* que vive **solo en el servidor**. Configuras
  `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN`.

> ⚠️ **Solo afecta al Modo B.** Google **revoca los refresh tokens cada 7
> días** si la pantalla de consentimiento OAuth está en *"Testing"*. Debes
> publicarla a *"In production"* (ver §4) o las subidas dejarán de funcionar a
> la semana. **El Modo A no sufre esto.**

El código detecta el modo automáticamente: si `GOOGLE_SERVICE_ACCOUNT_KEY` está
definida, usa Modo A; si no, Modo B.

**Cloud Run como destino preferente.** Las funciones serverless clásicas
tienen límites bajos de tamaño/tiempo; Cloud Run admite cuerpos mayores y
procesos más largos. Aun así, Cloud Run limita el cuerpo de una petición
HTTP/1 a **32 MB**, por lo que el tamaño máximo por archivo (25 MB por defecto)
se mantiene con margen y es configurable.

**El QR apunta a la app, nunca a Drive.** El QR codifica
`https://tu-dominio/e/<slug>?t=<token>`. El servidor valida *slug* **y** token
antes de aceptar bytes. Drive solo se toca desde el backend.

**No se guardan fotos en PostgreSQL.** La base de datos solo almacena
metadatos (nombre original, nombre final, MIME, tamaño, ID de Drive, hash,
fecha, invitado, hash de IP, estado y error). Los binarios viven únicamente en
Drive.

**Decisiones menores documentadas:**
- *Subida de un archivo por petición* (cuerpo crudo) en lugar de multipart:
  ver §2.
- *Rate limiting en PostgreSQL* (ventana fija) para no añadir Redis en el MVP;
  migrable a Memorystore si hace falta.
- *Autenticación de admin por credenciales en variables de entorno + sesión
  firmada en BD*, con arquitectura preparada para sustituir por OIDC.
- *El slug no se puede cambiar tras crear el evento* para no invalidar QR ya
  impresos; el token sí se puede regenerar.

---

## 2. Subidas grandes sin agotar memoria

El requisito es no cargar el archivo completo en RAM ni en JSON/Base64.

- El navegador sube **cada archivo en una petición HTTP independiente**, con el
  binario como **cuerpo crudo** (`application/octet-stream`). Los metadatos van
  en la *query string* (slug, token, clave de idempotencia, nombre, invitado).
- El *route handler* (`runtime = "nodejs"`) lee `request.body` como **stream
  web**, lo convierte en stream de Node y lo **reenvía directamente a Google
  Drive** con la librería oficial, que usa el **protocolo de subida resumible**
  por debajo. En ningún momento se hace `arrayBuffer()` del archivo completo.
- Antes de reenviar, se leen **solo los primeros 32 bytes** para validar el
  **MIME real** (firma de bytes). Si no es una imagen admitida, se aborta el
  stream y no se sube nada.
- Durante el streaming se **cuenta el tamaño** (se aborta si supera el límite)
  y se calcula el **SHA-256**.
- *¿Por qué cuerpo crudo y no `multipart/form-data`?* El parseo multipart en
  Node bufferiza cada parte en memoria. Un archivo por petición como stream
  crudo es la forma memory-safe de cumplir el requisito y, además, hace que
  **cada archivo sea reintentable de forma aislada** (si una foto falla, la
  cola no se pierde).

Idempotencia: cada archivo lleva una `idempotencyKey` (UUID) única por evento
(`@@unique([eventId, idempotencyKey])`). Si el cliente reintenta una subida ya
completada, el servidor devuelve el resultado anterior sin duplicar en Drive.

---

## 3. Estructura del proyecto

```
boda-fotos/
├── prisma/
│   ├── schema.prisma          # Event, Upload, AdminSession, RateLimitEntry
│   └── seed.ts                # Evento de demostración
├── scripts/
│   └── get-refresh-token.ts   # Obtiene el refresh token de OAuth
├── src/
│   ├── middleware.ts          # Cabeceras de seguridad + CSP
│   ├── lib/
│   │   ├── env.ts             # Validación de variables de entorno (Zod)
│   │   ├── prisma.ts          # Cliente Prisma (singleton)
│   │   ├── drive.ts           # Google Drive OAuth + subida resumible (+mock)
│   │   ├── stream.ts          # Sniff de MIME + hash + límite en streaming
│   │   ├── qr.ts              # QR PNG/SVG + URL pública
│   │   ├── auth.ts            # Sesión admin, CSRF, comparación segura
│   │   ├── admin-guard.ts     # Guards de lectura/mutación del panel
│   │   ├── events.ts          # Autorización pública (slug+token+estado)
│   │   ├── idempotency.ts     # Decisión de duplicado
│   │   ├── validation.ts      # Esquemas Zod
│   │   ├── filename.ts        # Saneado y nombre final anticolisión
│   │   ├── mime.ts            # Tipos admitidos + sniff de firma
│   │   ├── ip.ts              # IP anonimizada (hash con sal)
│   │   ├── ratelimit.ts       # Rate limiting en BD
│   │   └── security.ts        # CSP, cabeceras, helpers JSON
│   └── app/
│       ├── page.tsx           # Landing
│       ├── e/[slug]/          # Página pública del invitado (uploader)
│       ├── admin/             # Panel privado (login + dashboard)
│       ├── legal/             # Privacidad, aviso legal, conservación
│       └── api/
│           ├── public/        # event, upload/init, upload, upload/status
│           └── admin/         # login, logout, events CRUD, token, qr, export, maintenance
├── tests/
│   ├── unit/                  # Vitest: filename, mime, validación, auth, gate, idempotencia, stream
│   └── e2e/                   # Playwright: flujo del invitado
├── Dockerfile                 # Multi-stage (standalone) para Cloud Run
├── docker-compose.yml         # Postgres + app para desarrollo
└── .env.example
```

---

## 4. Configurar Google Cloud y Google Drive

### Modo A — Cuenta de servicio + Unidad compartida (recomendado, con Workspace)

1. **Crea un proyecto** en [Google Cloud Console](https://console.cloud.google.com/)
   y **activa la Google Drive API** (*APIs y servicios → Biblioteca*).
2. **Crea una cuenta de servicio**: *IAM y administración → Cuentas de servicio
   → Crear*. No necesita roles de IAM.
3. **Crea una clave JSON** para esa cuenta: pestaña *Claves → Agregar clave →
   JSON*. Se descarga un `.json`. Pega **todo su contenido** (en una línea) en
   `GOOGLE_SERVICE_ACCOUNT_KEY`. Guarda el archivo con cuidado: es una
   credencial de larga duración.
4. **Crea una Unidad compartida** en Drive (con tu Workspace) y copia su **ID**
   (aparece en la URL: `drive.google.com/drive/folders/<ID de la Unidad>`).
   Ponlo en `GOOGLE_DRIVE_SHARED_DRIVE_ID`.
5. **Añade la cuenta de servicio como miembro** de la Unidad compartida con rol
   **Administrador de contenido** (usa el email de la cuenta de servicio, del
   tipo `...@...iam.gserviceaccount.com`).
6. **Crea dentro de esa Unidad la carpeta de destino** de cada boda y usa su ID
   al crear el evento en el panel.

Con esto no hay nada que caduque y las fotos las posee tu organización. Salta
al paso §5.

### Modo B — OAuth con tu cuenta (Gmail normal, incluido Google One)

> Google One (el plan de pago de Gmail) **no** es Workspace y **no** permite
> Unidades compartidas, pero **sí** sirve como almacenamiento: las fotos van a
> "Mi unidad" de tu cuenta y ocupan tu espacio de Google One. Usa este modo.
> El refresh token lo obtienes con el botón **"Conectar Google Drive"** del
> panel (no necesitas ejecutar ningún script ni rellenar GOOGLE_REFRESH_TOKEN).

1. **Crea un proyecto** en [Google Cloud Console](https://console.cloud.google.com/).
2. **Activa la API de Google Drive**: *APIs y servicios → Biblioteca* →
   busca "Google Drive API" → **Habilitar**.
3. **Configura la pantalla de consentimiento OAuth**: *APIs y servicios →
   Pantalla de consentimiento de OAuth*.
   - Tipo de usuario: **Externo**.
   - Rellena nombre de la app, correo de asistencia y contacto.
   - **Scopes:** añade `.../auth/drive.file` (acceso solo a los archivos que
     crea la app; el mínimo necesario).
   - **⚠️ Publica la app a estado *"In production"*.** Si la dejas en
     *"Testing"*, el refresh token caducará a los 7 días. Con el scope
     `drive.file` y tu propia cuenta, normalmente **no** necesitas verificación
     de Google para uso propio.
4. **Crea las credenciales OAuth**: *APIs y servicios → Credenciales → Crear
   credenciales → ID de cliente de OAuth*.
   - Tipo de aplicación: **Aplicación web**.
   - **URI de redirección autorizado:** añade
     `<APP_BASE_URL>/api/admin/google/callback` (p. ej.
     `https://boda-fotos.onrender.com/api/admin/google/callback`). Este es el
     que usa el botón "Conectar Google Drive". (Si además vas a usar el script
     local, añade también `http://localhost:53682/oauth2callback`.)
   - Copia el **Client ID** y **Client Secret** a tus variables de entorno
     (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
5. **Conecta tu Drive desde el panel:** despliega, entra en `/admin`, y pulsa
   **"Conectar Google Drive"**. Autoriza con tu cuenta y listo: el refresh token
   se guarda en la base de datos, en el servidor. No necesitas el script local
   ni `GOOGLE_REFRESH_TOKEN`.
6. **Crea la carpeta de destino en tu Drive** ("Mi unidad") y copia su **ID**
   (está en la URL de la carpeta: `drive.google.com/drive/folders/<ID>`). Ese ID
   es el que pones al crear el evento en el panel. **No compartas** la carpeta
   públicamente.

**Alternativa sin navegador (opcional):** también puedes obtener el token con
`npm run get-refresh-token` en local y ponerlo en `GOOGLE_REFRESH_TOKEN`.

---

## 5. Desarrollo local

**Requisitos:** Node ≥ 20 y Docker (para PostgreSQL) o un PostgreSQL propio.

```bash
# 1) Instala dependencias
npm install

# 2) Copia y rellena variables de entorno
cp .env.example .env
#    Genera secretos:
#    openssl rand -hex 32   -> SESSION_SECRET
#    openssl rand -hex 16   -> IP_HASH_SALT

# 3) Levanta PostgreSQL (con Docker)
docker compose up -d db

# 4) Aplica migraciones y siembra el evento demo
npx prisma migrate dev --name init
npm run seed

# 5) Arranca en desarrollo
npm run dev
```

- Panel del fotógrafo: `http://localhost:3000/admin`
  (usuario/contraseña de `.env`).
- La URL pública del evento demo se imprime al ejecutar `npm run seed`.

**Desarrollo sin credenciales de Google:** exporta `DRIVE_MOCK=1` para simular
Drive (no sube nada real). Útil para probar el flujo completo y los tests E2E.

---

## 6. Despliegue

> ⚠️ **No uses Netlify (ni Vercel functions) para esta app.** Sus funciones
> serverless limitan el cuerpo de la petición a **6 MB** (Netlify Forms, 8 MB).
> Las fotos llegan a 25 MB, así que una foto grande daría **error 413**. Esta
> app necesita un **contenedor** que haga streaming del archivo. Usa cualquiera
> de las opciones de abajo: todas ejecutan el `Dockerfile` como contenedor real
> y no tienen ese límite.

### Render (la opción más sencilla, tipo "un clic")

Incluye `render.yaml` (blueprint). Con contenedor real **no** hay límite de
6 MB.

1. Sube el repositorio a GitHub.
2. En [Render](https://render.com): **New → Blueprint** → elige el repo. Render
   lee `render.yaml`, construye el `Dockerfile` y crea la base de datos
   PostgreSQL gestionada.
3. Rellena en el panel las variables secretas (`ADMIN_PASSWORD`, `APP_BASE_URL`,
   `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_DRIVE_SHARED_DRIVE_ID`). `SESSION_SECRET`
   e `IP_HASH_SALT` se generan solos.
4. Deploy. Las migraciones se aplican al arrancar (`RUN_MIGRATIONS=1`).

Alternativas equivalentes: **Railway** y **Fly.io** (también contenedor Docker
con base de datos gestionada).

### Google Cloud Run (preferente)

1. **Base de datos:** crea una instancia de **Cloud SQL for PostgreSQL** y una
   base de datos. Anota el nombre de conexión.
2. **Construye y sube la imagen:**
   ```bash
   gcloud builds submit --tag gcr.io/TU_PROYECTO/boda-fotos
   ```
3. **Aplica migraciones** (una vez, como job o desde tu máquina apuntando a la
   BD de producción):
   ```bash
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   ```
4. **Despliega:**
   ```bash
   gcloud run deploy boda-fotos \
     --image gcr.io/TU_PROYECTO/boda-fotos \
     --region europe-west1 \
     --add-cloudsql-instances TU_PROYECTO:REGION:INSTANCIA \
     --set-env-vars "APP_BASE_URL=https://TU_DOMINIO,NODE_ENV=production" \
     --set-secrets "DATABASE_URL=DATABASE_URL:latest,SESSION_SECRET=SESSION_SECRET:latest,ADMIN_PASSWORD=ADMIN_PASSWORD:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,GOOGLE_REFRESH_TOKEN=GOOGLE_REFRESH_TOKEN:latest,IP_HASH_SALT=IP_HASH_SALT:latest,ADMIN_USERNAME=ADMIN_USERNAME:latest" \
     --cpu 1 --memory 512Mi --timeout 300 --allow-unauthenticated
   ```
   Guarda los secretos en **Secret Manager**, no como texto plano.
   Configura un job de **Cloud Scheduler** que llame a `POST /api/admin/maintenance`
   periódicamente para limpiar sesiones/subidas incompletas (o ejecútalo a mano).

### Alternativa de despliegue: contenedor en cualquier VPS

La imagen es un contenedor estándar. En un servidor con Docker:

```bash
cp .env.example .env   # rellena valores de producción
docker compose up --build -d
```

Esto levanta PostgreSQL + la app (con `RUN_MIGRATIONS=1` aplica migraciones al
arrancar). Pon un proxy inverso (Caddy/Nginx) delante para TLS. Otras opciones
válidas: Render, Railway o Fly.io (todas admiten contenedores Docker con
volumen de disco para subidas grandes).

---

## 7. Modelo de acceso público y seguridad

- Cada evento tiene un **slug legible** y un **token público aleatorio** de 256
  bits (`randomBytes(32)`, base64url). La URL es `/e/<slug>?t=<token>`.
- El servidor valida **ambos** en tiempo constante antes de aceptar cualquier
  subida, y comprueba que el evento está **activo** y **dentro de plazo**.
- El administrador puede **regenerar el token** (invalida QR/enlaces anteriores)
  o **desactivar** el evento al instante.
- Los invitados no inician sesión, no reciben credenciales de Google, no
  acceden a Drive y no pueden ver, descargar, editar ni borrar archivos: solo
  **subir** al evento correspondiente.

---

## 8. API

**Públicos** (validan slug+token+estado en cada llamada):
- `GET  /api/public/event?slug=&t=` — info pública mínima del evento.
- `POST /api/public/upload/init` — registra el lote (consentimiento, límites).
- `POST /api/public/upload?slug=&t=&key=&name=&guest=` — sube **un** archivo
  (cuerpo crudo, streaming a Drive).
- `GET  /api/public/upload/status?slug=&t=&keys=` — estado de subidas.

**Admin** (sesión + CSRF en mutaciones):
- `POST /api/admin/login` · `POST /api/admin/logout`
- `GET/POST /api/admin/events` — listar / crear.
- `GET/PATCH/DELETE /api/admin/events/:id` — detalle / editar / borrar
  (evento o, con `?uploadId=`, un registro de subida — **no** borra Drive).
- `POST /api/admin/events/:id/token` — regenerar token.
- `POST /api/admin/events/:id/empty-drive` — **vaciar en Drive** la carpeta de
  fotos del evento (acción manual; opcional `{ purgeRecords: true }` para borrar
  también el histórico). Pensado para la rutina "descargar y borrar tras la boda".
- `GET  /api/admin/events/:id/qr?format=png|svg` — descargar QR.
- `GET  /api/admin/events/:id/export` — exportar CSV.
- `POST /api/admin/maintenance` — limpieza de sesiones/subidas incompletas.

---

## 9. Pruebas

```bash
npm test          # unitarias (Vitest): validación, filename, mime, auth,
                  # autorización de eventos, idempotencia, streaming
npm run test:e2e  # E2E (Playwright): flujo del invitado con DRIVE_MOCK=1
```

Los tests unitarios no requieren BD ni Google. Para el E2E, siembra la BD
(`npm run seed`) y pasa el token del evento demo en `E2E_EVENT_TOKEN`. Google
Drive se **mockea** mediante `DRIVE_MOCK=1` (no se sube nada real).

Cobertura incluida: validaciones Zod, generación/anticolisión de nombres,
detección de MIME por firma (rechaza vídeos/no-imágenes), comparación segura,
autorización de eventos (activo / caducado / desactivado / token incorrecto),
idempotencia y límite de tamaño en streaming.

---

## 10. Checklist de seguridad

- [x] Credenciales de Google **solo en el servidor** (variables de entorno);
      nunca en frontend, repo, consola o respuestas de la API.
- [x] QR/enlace apuntan a la app, **nunca** a Drive.
- [x] Token público de 256 bits + validación en **tiempo constante**.
- [x] Validación de **extensión y MIME real** (firma de bytes); se rechazan
      vídeos y no-imágenes.
- [x] Saneado de nombres (anti path-traversal, control chars); renombrado
      anticolisión con UUID; se conserva el nombre original en BD.
- [x] **Límite de tamaño real en el servidor** durante el streaming.
- [x] **Streaming** a Drive sin bufferizar; nada de Base64/JSON para binarios.
- [x] **Idempotencia** por `(eventId, idempotencyKey)` para evitar duplicados.
- [x] **Rate limiting** por evento + IP anonimizada.
- [x] **IP nunca completa**: se guarda un hash con sal.
- [x] Panel admin con sesión **httpOnly + secure + sameSite** y **CSRF**
      (double-submit) en mutaciones; login con rate limit.
- [x] **Cabeceras de seguridad** y **CSP** razonable (middleware).
- [x] **Logs sin datos sensibles**.
- [x] Bloqueo de eventos **caducados o desactivados**.
- [x] Limpieza de **subidas incompletas** y sesiones caducadas.
- [x] `robots.txt` con `Disallow: /` y `noindex`.
- [ ] **Pendiente en producción:** publicar la pantalla OAuth (evita caducidad
      del refresh token a 7 días), poner TLS, rotar secretos, y endurecer la CSP
      con *nonces* si se elimina `unsafe-inline`.

---

## 11. Privacidad y conservación

- Textos de **política de privacidad**, **aviso legal** y **conservación** en
  `/legal/*` (plantillas orientativas: revísalas con un profesional).
- Casilla de **consentimiento obligatoria** antes de subir.
- **Conservación configurable** vía `RETENTION_DAYS`. La app guarda solo
  metadatos; eliminar un registro **no** borra el archivo de Drive (acción
  deliberada del fotógrafo).
- **Sin analítica, sin cookies publicitarias, sin rastreadores** en el MVP.

---

### Nota sobre HEIC/HEIF (iPhone)

Los navegadores no generan miniatura nativa de HEIC/HEIF, así que en la
selección se muestra un marcador en lugar de la vista previa para esos
archivos; la subida funciona igual. Se conserva el original sin recomprimir.
