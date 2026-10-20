<div align="center">

# ☁️ Project Cloud

**Nube privada y gestor de archivos auto-hospedado para equipos y organizaciones.**

Tus archivos, en tu servidor, con tu marca. Sin suscripciones por usuario ni intermediarios.

![Versión](https://img.shields.io/badge/versión-2.6.6-2563eb?style=flat-square)
![PHP](https://img.shields.io/badge/PHP-8.1%2B-777bb4?style=flat-square&logo=php&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL_8%20%7C%20MariaDB_10.4-4479a1?style=flat-square&logo=mysql&logoColor=white)

</div>

---

## Tabla de contenido

1. [¿Qué es Project Cloud?](#1-qué-es-project-cloud)
2. [Tecnologías](#2-tecnologías)
3. [Funcionalidades](#3-funcionalidades)
4. [Arquitectura del proyecto](#4-arquitectura-del-proyecto)
5. [Seguridad, autenticación y caché](#5-seguridad-autenticación-y-caché)
6. [¿Por qué Project Cloud?](#6-por-qué-project-cloud)
7. [Instalación en tu servidor (Hosting / VPS)](#7-instalación-en-tu-servidor-hosting--vps)
8. [Desarrollo local (XAMPP)](#8-desarrollo-local-xampp)
9. [Versiones y publicación](#9-versiones-y-publicación)
10. [Solución de problemas](#10-solución-de-problemas)
11. [Roadmap](#11-roadmap)

---

## 1. ¿Qué es Project Cloud?

**Project Cloud** es una plataforma de almacenamiento en la nube **auto-hospedada**: una alternativa a Google Drive o Dropbox que se instala en tu propio hosting (Plesk, cPanel) o VPS y se administra desde el navegador.

Cada usuario tiene su **Mi unidad** privada, la organización comparte una **unidad compartida** con permisos por carpeta, y cualquier archivo o carpeta se puede compartir con otros miembros o con personas externas mediante **enlaces y códigos QR** con contraseña, caducidad y límite de visitas.

Está pensada para desplegarse **sin consola ni contenedores**: subes un ZIP, abres el dominio y un asistente web crea la base de datos y el administrador. A partir de ahí, la plataforma **se actualiza sola** desde su panel con paquetes firmados.

```text
┌───────────────────────────────────────────────────────────────────┐
│  Project Cloud 2.6.6                                              │
│                                                                   │
│  ▸ Front:     SPA en React + TypeScript, compilada a estáticos    │
│  ▸ Back:      API REST en PHP 8 vanilla (sin Composer)            │
│  ▸ Datos:     MySQL 8 / MariaDB 10.4 + sistema de archivos        │
│  ▸ Despliegue: Apache + PHP. Sin Node.js en producción            │
└───────────────────────────────────────────────────────────────────┘
```

---

## 2. Tecnologías

### Frontend

| Tecnología | Uso |
| :--- | :--- |
| **React 18** + **TypeScript 5** | Interfaz de usuario (SPA) |
| **Vite 5** | Servidor de desarrollo y build de producción con code-splitting por vendor |
| **Tailwind CSS 3** | Design system con tokens, modo claro/oscuro y temas de color |
| **React Router 6** | Enrutado, rutas protegidas y carga diferida (*lazy*) de Administración |
| **TanStack Query 5** | Caché de datos del servidor, persistida en el navegador |
| **Framer Motion** | Animaciones y transiciones |
| **ApexCharts** | Gráficas del panel de administración y almacenamiento |
| **lucide-react** · **qrcode** | Iconografía y generación de códigos QR |

### Backend

| Tecnología | Uso |
| :--- | :--- |
| **PHP 8.1+** vanilla | API REST en capas, autoloader PSR-4 propio, sin Composer |
| **PDO** (MySQL) | Acceso a datos con *prepared statements* |
| **JWT HS256** propio | Access tokens firmados (sin dependencias externas) |
| **Argon2id** / bcrypt | Hash de contraseñas |
| **PHPMailer** (incluido) | Envío de correo por SMTP |
| **GD** | Miniaturas de imágenes |
| **libsodium (Ed25519)** | Verificación de firma de las actualizaciones |
| **ZipArchive** | Copias de seguridad, restauración y actualizaciones |

### Infraestructura

| Componente | Requisito |
| :--- | :--- |
| Servidor web | **Apache** (o LiteSpeed) con `mod_rewrite` y `AllowOverride All` |
| Base de datos | **MySQL 8.0+** o **MariaDB 10.4+** |
| Tareas programadas | Cron del sistema o del panel del hosting (cada minuto) |
| Herramientas de build | **Node.js 18+** (solo en la máquina que compila, nunca en el servidor) |

---

## 3. Funcionalidades

### 📁 Gestión de archivos
- Explorador estilo Drive con **vista de cuadrícula y de lista**, ordenamiento y selección múltiple.
- **Subidas por fragmentos (chunks de 4 MB)** con arrastrar y soltar, cola de subidas visible y cancelación; admite archivos de varios GB aunque el hosting limite el tamaño de cada petición.
- Crear, renombrar, mover, copiar y duplicar archivos y carpetas.
- **Recientes**, **Destacados** y **Búsqueda** global.
- **Papelera** con restauración y borrado definitivo.
- **Vista previa** integrada de imágenes, vídeo, audio, PDF y archivos de texto/código.
- Descarga eligiendo carpeta de destino (Chrome y Edge) y descarga de carpetas completas en **ZIP**.

### 🔐 Visibilidad y compartición
- Archivos y carpetas **públicos** (URL directa) o **privados** (solo con sesión o enlace firmado). Cada usuario elige la visibilidad por defecto de sus subidas.
- **Compartir con miembros** de la organización con permiso de *lectura* o *completo*, y opciones por invitación: «Puede compartir enlaces» y «Bloquear descarga».
- **Enlaces compartidos y QR**: acceso para cualquiera o solo miembros, contraseña, caducidad, límite de visitas, permitir o no la descarga y contador de visitas/descargas.
- **Vista pública de carpeta** de solo lectura para quien recibe el enlace, sin necesidad de cuenta.
- Panel **Mis enlaces** y, para administradores, **Administración → Enlaces** con filtros y revocación masiva.

### 🏢 Unidad compartida
- Espacio común de la organización con **permisos por usuario**.
- **Acciones bloqueables** (subir, borrar, mover…) y **extensiones prohibidas**.
- Carpetas concretas marcables como **privadas** dentro de la unidad compartida.

### 👥 Usuarios y cuotas
- Roles **administrador** y **usuario**; alta, edición, suspensión y restablecimiento de contraseña.
- **Cuota de almacenamiento por usuario**, desglose por tipo de archivo y avisos por correo al acercarse al límite.
- Perfil con avatar, cambio de contraseña y **tema de color personal**.
- Última conexión y estado «En línea».

### 🛠️ Administración
- **Dashboard** con estadísticas, historial y distribución del almacenamiento.
- **Auditoría** de actividad con filtros por periodo y usuario.
- **Límites del servidor**: lectura de `upload_max_filesize`, `post_max_size`, memoria y capacidad asignada.
- **Copias de seguridad** manuales y programadas (diaria, semanal, quincenal o mensual), retención de 1 a 3 copias y selección de contenido.
- **Restauración con diagnóstico previo** (integridad, versión, espacio en disco) y copia automática del estado actual antes de restaurar.
- **Actualizaciones OTA** desde el panel: comprobación, descarga verificada, aplicación por pasos y **reversión**.
- **Modo mantenimiento** con pantalla de aviso y cierre global de sesiones.
- **Tareas cron** con estado en tiempo real y ejecución manual por tarea.
- **Correo SMTP** configurable, con prueba de envío y **editor de plantillas** (bienvenida, restablecimiento, aviso de cuota) con vista previa.

### 🎨 Marca blanca y experiencia
- Logo, nombre de la organización, paleta de colores y **temas predefinidos**; modo claro/oscuro.
- El título de la pestaña y las **vistas previas de enlaces** (WhatsApp, Slack, Teams) muestran el nombre de la organización.
- Apariencia configurable de los **QR** (sin logo, logo de la plataforma o imagen propia).
- **Notificaciones** dentro de la app, ventana de **Novedades** por versión y reporte de errores al administrador.
- Integración opcional con **Google Analytics 4**.
- Interfaz **responsive** adaptada a móvil (hojas inferiores, barra de ruta deslizable, selección táctil).

---

## 4. Arquitectura del proyecto

Monorepo con el frontend y el backend separados. En producción **ambos conviven en la raíz del dominio**: Apache sirve la SPA compilada y redirige `/api/*` al front controller de PHP.

```text
proyecto-cloud/
├── frontend/            # SPA en React + TypeScript (Screaming Architecture)
├── api/                 # API REST en PHP 8 vanilla, arquitectura en capas
├── scripts/             # Build, despliegue y publicación de versiones (Node.js)
├── release/             # Notas de versión y guía de publicación
├── storage/             # Archivos de los usuarios (generado, no versionado)
├── .htaccess            # Enrutado SPA + API, cabeceras de seguridad y caché
├── version.json         # Fuente única de versión y esquema de BD
└── README.md
```

### Flujo de una petición

```text
Navegador ──► Apache (.htaccess raíz)
                │
                ├─ /app-assets/*, archivos existentes ─► servidos como estáticos
                ├─ /storage/*                          ─► archivos públicos (PHP desactivado)
                ├─ /api/*                              ─► api/index.php
                │      └─► Router ─► Middleware ─► Controller ─► Service ─► Repository ─► MySQL
                │                                                     └─► Sistema de archivos
                │      ◄── JSON { success, data, error } + ETag
                └─ cualquier otra ruta                 ─► api/spa.php ─► index.html (React Router)
```

### 4.1 Frontend — `frontend/`

Organizado por **Screaming Architecture**: la estructura de carpetas expresa lo que hace la aplicación. Cada funcionalidad vive en `features/` con sus propios componentes, hooks y servicios; lo transversal vive en `shared/`.

```text
frontend/
├── index.html
├── vite.config.ts           # Alias (@app, @features, @shared), proxy /api → :8000, chunks
├── tailwind.config.ts       # Tokens del design system
└── src/
    ├── main.tsx             # Punto de entrada
    ├── index.css            # Tokens CSS, temas y utilidades de Tailwind
    ├── app/                 # Ensamblaje de la aplicación
    │   ├── App.tsx
    │   ├── providers/       # QueryClient, Auth, Toasts, Uploads, Preview…
    │   ├── router/          # AppRouter: rutas públicas, protegidas y de admin
    │   ├── layouts/         # Layout del explorador: Topbar, Sidebar, Footer
    │   └── maintenance/     # Pantalla y control del modo mantenimiento
    ├── features/            # Un módulo por funcionalidad
    │   ├── auth/            # Login, recuperación y restablecimiento de contraseña
    │   ├── install/         # Asistente de instalación (requisitos, BD, admin)
    │   ├── drive-explorer/  # Explorador "Mi unidad": vistas, diálogos, adaptadores
    │   ├── assets/          # Unidad compartida y sus permisos
    │   ├── uploads/         # Subida por chunks y dock de progreso
    │   ├── preview/         # Visor de imágenes, vídeo, audio, PDF y texto
    │   ├── share-links/     # Enlaces, QR y página "Mis enlaces"
    │   ├── public-link/     # Vista pública de un enlace (/s/:token)
    │   ├── library/         # Servicios de Recientes, Destacados y Búsqueda
    │   ├── recent/ · starred/ · search/ · trash/
    │   ├── storage-quota/   # Indicador y página de almacenamiento
    │   ├── notifications/   # Campana y página de notificaciones
    │   ├── profile/         # Perfil, avatar, contraseña y tema personal
    │   ├── admin/           # Dashboard, usuarios, auditoría, enlaces, copias, actualizaciones
    │   │   └── settings/    # General, Apariencia, Integraciones, Cron, Correo, BD…
    │   ├── whats-new/       # Ventana de novedades por versión
    │   ├── support/         # Reporte de errores
    │   └── settings/        # Componentes de configuración reutilizables
    └── shared/              # Código transversal
        ├── api/             # Cliente HTTP: tokens, auto-refresh, ETag, mantenimiento
        ├── ui/              # Design system: Button, Dialog, Menu, Toast, BottomSheet…
        ├── hooks/           # useDisclosure, useMediaQuery, usePlatformSettings…
        ├── lib/             # cn, formatBytes, formatDate, fileIcons, download
        ├── components/      # Componentes globales (Google Analytics)
        └── config/          # Versión y constantes de la app
```

**Rutas principales**

| Ruta | Descripción | Acceso |
| :--- | :--- | :--- |
| `/install` | Asistente de instalación | Solo si no está instalada |
| `/login`, `/forgot-password`, `/reset-password` | Autenticación | Público |
| `/s/:token` | Enlace compartido | Público |
| `/`, `/folder/:id` | Mi unidad | Usuario |
| `/recent`, `/starred`, `/search`, `/trash` | Biblioteca y papelera | Usuario |
| `/assets/*` | Unidad compartida | Usuarios autorizados |
| `/links`, `/quota`, `/profile`, `/notifications` | Área personal | Usuario |
| `/admin`, `/admin/users`, `/admin/activity`, `/admin/links` | Administración | Administrador |
| `/admin/settings/*` | Configuración de la plataforma | Administrador |

### 4.2 Backend — `api/`

API REST en PHP 8 sin framework ni Composer, organizada en capas con responsabilidades bien separadas. Todos los endpoints viven bajo el prefijo `/api/v1`.

```text
api/
├── index.php                # Front controller: única entrada de /api/*
├── bootstrap.php            # Autoloader PSR-4 (ProjectCloud\ → src/) y carga de config
├── routes.php               # Registro de todas las rutas y sus middlewares
├── spa.php                  # Entrega index.html con el nombre de la organización (OG tags)
├── cron.php                 # Ejecutor de tareas programadas (CLI o HTTP con token)
├── version.php              # Versión generada desde /version.json
├── storage.htaccess.dist    # Plantilla de hardening que se copia a /storage
├── config/
│   ├── config.sample.php    # Plantilla de configuración
│   ├── config.php           # Generado por el instalador (no versionado)
│   └── install.lock         # Bloquea el asistente tras instalar (no versionado)
├── database/
│   ├── schema.sql           # Esquema inicial (lo aplica el instalador)
│   └── migrations/          # Migraciones versionadas NNNN_*.php (solo aditivas)
├── var/                     # Copias, temporales y estado del actualizador (privado)
└── src/
    ├── Core/                # Router, Request, Response, Database (PDO), Jwt, Password,
    │                        # Validator, SignedUrl, MaintenanceMode, Config, Paths
    ├── Middleware/          # AuthMiddleware, AdminOnly, RateLimit, Cors
    ├── Controllers/         # Reciben la petición, validan y delegan en Services
    ├── Services/            # Lógica de negocio
    │   ├── Backup/          # Copias, análisis y restauración
    │   ├── Cron/            # Tareas programadas
    │   └── ShareLinks/      # Enlaces compartidos, políticas y acceso público
    ├── Repositories/        # Acceso a datos con prepared statements
    ├── Installer/           # Lógica del asistente de instalación
    ├── Updater/             # Actualizador OTA: verificación, preflight, aplicación, reversión
    └── Vendor/PHPMailer/    # Dependencia incluida para SMTP
```

**Responsabilidad de cada capa**

| Capa | Responsabilidad | Ejemplos |
| :--- | :--- | :--- |
| **Core** | Infraestructura HTTP, BD y criptografía | `Router`, `Response`, `Jwt`, `SignedUrl` |
| **Middleware** | Reglas transversales antes del controlador | `AuthMiddleware`, `AdminOnly`, `RateLimit` |
| **Controllers** | Entrada/salida HTTP, validación | `FileController`, `UploadController`, `AdminController` |
| **Services** | Reglas de negocio | `UploadService`, `QuotaService`, `TrashService`, `FileSystemService` |
| **Repositories** | Persistencia en MySQL | `FileRepository`, `UserRepository`, `RefreshTokenRepository` |

**Grupos de endpoints**

| Prefijo | Descripción |
| :--- | :--- |
| `/v1/health`, `/v1/system/*` | Diagnóstico, estado de mantenimiento/versión, cron por HTTP |
| `/v1/install/*` | Asistente de instalación |
| `/v1/auth/*` | Login, refresh, logout, perfil, avatar, recuperación de contraseña |
| `/v1/folders/*`, `/v1/files/*` | Explorador, visibilidad, copia, contenido firmado y miniaturas |
| `/v1/uploads/*` | Subida por chunks: `init` → `chunk` → `complete` |
| `/v1/recent`, `/v1/starred`, `/v1/search`, `/v1/trash/*` | Biblioteca y papelera |
| `/v1/assets/*` | Unidad compartida |
| `/v1/shares/*`, `/v1/users/search` | Compartición con miembros |
| `/v1/links/*`, `/v1/public/links/*` | Enlaces compartidos (gestión y acceso público) |
| `/v1/quota`, `/v1/notifications/*`, `/v1/support/*` | Cuota, notificaciones y soporte |
| `/v1/admin/*` | Usuarios, estadísticas, ajustes, SMTP, plantillas, copias, cron, mantenimiento, actualizaciones |

**Base de datos**

`users` · `refresh_tokens` · `password_reset_tokens` · `folders` · `files` · `shared_access` · `share_links` · `share_link_hits` · `assets_metadata` · `activity_log` · `notifications` · `settings` · `email_templates` · `storage_history`

El esquema inicial está en `api/database/schema.sql` y evoluciona con migraciones en `api/database/migrations/`. Las migraciones son **idempotentes y solo aditivas** (no borran ni renombran), de modo que revertir el código a una versión anterior es seguro. El número de la última migración es el campo `schema` de `version.json`.

### 4.3 Scripts y publicación — `scripts/` y `release/`

```text
scripts/
├── sync-version.mjs         # Propaga version.json a package.json y api/version.php (prebuild)
├── deploy-dist.mjs          # Completa frontend/dist con api/ y .htaccess (postbuild)
└── release/
    ├── build.mjs            # Empaqueta, firma y genera manifest.json de una versión
    ├── verify.mjs           # Verifica el paquete firmado
    ├── installer.mjs        # Genera el ZIP de instalación nueva
    ├── keygen.mjs           # Genera el par de llaves Ed25519 (una sola vez)
    ├── zip.mjs · lib.mjs    # Utilidades compartidas
release/
├── README.md                # Guía detallada de publicación
└── notes/<versión>.json     # Changelog, novedades y requisitos de cada versión
```

---

## 5. Seguridad, autenticación y caché

### 🔑 Autenticación (JWT + refresh tokens rotatorios)

```text
POST /api/v1/auth/login
  └─► access_token   JWT HS256 · 15 min · en memoria del navegador
  └─► refresh_token  opaco · 30 días · guardado en BD como hash SHA-256

Petición con 401 ──► POST /auth/refresh (una sola vez, compartida por todas las peticiones)
                     ├─ token válido   → se revoca y se emite uno nuevo (rotación)
                     └─ token revocado → reuso detectado → se revoca toda la familia
```

- **Access token** corto y *stateless*, firmado con un secreto aleatorio de 64 bytes generado por el instalador. La firma se verifica en tiempo constante y se validan `exp`, `nbf` e `iss`.
- **Refresh token** opaco y **rotatorio**, agrupado por familia: si alguien reutiliza uno ya usado, se cierran todas las sesiones de esa familia.
- **Cierre global de sesiones** por época (`ep`): el modo mantenimiento o el administrador pueden invalidar todos los tokens emitidos.
- En cada petición se comprueba que la cuenta siga **activa**: una suspensión surte efecto de inmediato.
- El cliente hace **auto-refresh transparente** con *single-flight*: varias peticiones con 401 simultáneas comparten un solo refresh.
- Contraseñas con **Argon2id** (bcrypt como respaldo) y comparación en tiempo constante en el login para no revelar qué usuarios existen.
- Restablecimiento de contraseña con **tokens de un solo uso** que caducan.

### ⚡ Caché con ETag (respuestas 304)

Toda respuesta `GET` exitosa de la API incluye un **ETag** (hash MD5 del JSON) y `Cache-Control: private, must-revalidate`.

```text
1ª petición   GET /api/v1/folders/12/children
              ◄── 200 OK · ETag: "9f2c…" · { data }      → se guarda en sessionStorage

2ª petición   GET /api/v1/folders/12/children
              If-None-Match: "9f2c…"
              ◄── 304 Not Modified (sin cuerpo)          → se reutilizan los datos guardados
```

- El cliente guarda `{ etag, data }` por ruta en `sessionStorage` y envía `If-None-Match` en la siguiente petición.
- Si nada cambió, el servidor responde **304 sin cuerpo** y la interfaz usa los datos locales: menos transferencia y navegación más rápida entre carpetas.
- La caché se **vacía al cerrar sesión** para que nunca se mezclen datos entre usuarios.
- Los enlaces firmados de archivos privados se redondean a la hora para **no invalidar** los ETag de los listados.
- Los avatares usan su propio ETag basado en la fecha de modificación; los logos se cachean un día.
- En el frontend, TanStack Query añade una capa de caché persistida para que la interfaz pinte al instante al recargar.

### 🛡️ Endurecimiento

| Medida | Detalle |
| :--- | :--- |
| **Rate limiting** | Por IP y ventana deslizante en login (8/5 min), refresh, recuperación de contraseña, cron y enlaces públicos |
| **URLs firmadas** | Los archivos privados se sirven con firma HMAC temporal; la de vista previa no sirve para descargar |
| **Storage sin PHP** | `/storage` desactiva el motor PHP y deniega scripts (`.php`, `.phtml`, `.phar`, `.sh`…) |
| **Nombres reservados** | No se pueden subir `.htaccess`, `.htpasswd` ni `.user.ini` |
| **Protección de rutas** | Solo `api/index.php` ejecuta PHP; `src/`, `config/` y `var/` se deniegan; ningún `.php` suelto en la raíz |
| **Path traversal** | Rutas normalizadas y confinadas al almacenamiento de la plataforma |
| **Cabeceras** | HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` y CSP |
| **Errores** | En producción no se exponen detalles internos; se registran en el log del servidor |
| **Copias privadas** | Las copias de seguridad viven en `api/var/`, fuera del alcance web |
| **Actualizaciones firmadas** | Solo se instalan paquetes con firma **Ed25519** válida |
| **Enlaces públicos** | IP de los visitantes guardada con hash; contraseñas de enlace hasheadas |

---

## 6. ¿Por qué Project Cloud?

| | |
| :--- | :--- |
| 🛡️ **Soberanía de datos** | Los archivos viven en tu servidor. Sin terceros, sin minería de datos y sin cambios de condiciones ajenos a ti. |
| 💸 **Costo predecible** | Sin cobro por usuario ni planes escalonados. El límite lo pone el disco de tu servidor. |
| 🚀 **Despliegue sin fricción** | Funciona en un hosting compartido tradicional: ZIP, base de datos vacía y asistente web. Sin Docker, SSH ni Node.js en producción. |
| 🔄 **Mantenimiento integrado** | Actualizaciones firmadas con reversión, copias programadas y restauración con diagnóstico, todo desde el panel. |
| 🎨 **Tu marca** | Logo, colores, nombre y vistas previas de enlaces con la identidad de tu organización. |
| ⚡ **Rápido** | Caché ETag con respuestas 304, assets inmutables con hash y carga diferida de los módulos pesados. |
| 🔐 **Seguro por diseño** | JWT con rotación y detección de reuso, archivos privados con URLs firmadas y hardening de servidor incluido. |
| 🧩 **Mantenible** | Código tipado, capas bien delimitadas y sin dependencias de backend que mantener. |

---

## 7. Instalación en tu servidor (Hosting / VPS)

### Requisitos

| Componente | Mínimo |
| :--- | :--- |
| PHP | **8.1+** |
| Extensiones obligatorias | `pdo_mysql`, `fileinfo`, `mbstring`, `json`, `openssl` |
| Extensiones recomendadas | `gd` (miniaturas), `zip` (copias y actualizaciones), `curl` y `sodium` (actualizador) |
| Base de datos | MySQL 8.0+ o MariaDB 10.4+ (vacía) |
| Servidor web | Apache / LiteSpeed con `mod_rewrite`, `mod_headers` y `AllowOverride All` |
| Dominio | Dominio o subdominio propio, con **HTTPS**. La app va en la raíz; no funciona en una subcarpeta (`dominio.com/drive`) |

> [!NOTE]
> Nginx no está soportado de forma nativa: el enrutado y el hardening viven en los `.htaccess`. Para usar Nginx habría que traducir esas reglas al bloque `server`.

### 7.1 Generar el ZIP de instalación

En tu máquina (requiere Node.js 18+):

```bash
node scripts/release/installer.mjs                  # compila el frontend y arma el ZIP
node scripts/release/installer.mjs --skip-frontend  # reutiliza frontend/dist ya compilado
```

Resultado: `release/installer/project-cloud-<versión>-installer.zip`, con `index.html`, `.htaccess`, `app-assets/` y `api/` en la raíz del ZIP, **sin configuración ni datos**.

### 7.2 Hosting compartido (Plesk / cPanel)

1. **Crea una base de datos vacía** con un usuario asociado y anota nombre, usuario y contraseña. No hace falta importar ningún `.sql`.
2. Abre el **Administrador de archivos** en la raíz del dominio: `httpdocs` (Plesk) o `public_html` (cPanel). Si el sitio es nuevo, borra la página de bienvenida del panel.
3. **Sube el ZIP** y usa **Extraer archivos** en esa misma carpeta. Deben quedar `index.html`, `.htaccess`, `app-assets/` y `api/` directamente en la raíz (activa «mostrar archivos ocultos» para ver `.htaccess`).
4. **Borra el ZIP** del servidor.
5. **Abre el dominio** en el navegador. El asistente:
   - comprueba requisitos, permisos de escritura y espacio en disco;
   - pide las credenciales de la base de datos y crea las tablas;
   - genera `api/config/config.php` con un secreto JWT aleatorio;
   - crea la cuenta de administrador y bloquea el asistente con `install.lock`.
6. **Configura el cron** (ver [7.4](#74-tareas-programadas-cron)).

> [!WARNING]
> El ZIP de instalación es **solo para instalaciones nuevas**. No lo extraigas sobre una instalación existente: reemplazaría el `.htaccess` y el registro del actualizador. Para actualizar, usa **Configuración → Actualizaciones**.

### 7.3 VPS (Ubuntu / Debian con Apache)

```bash
# 1. Paquetes
sudo apt update
sudo apt install apache2 mysql-server unzip \
  php php-mysql php-mbstring php-gd php-zip php-curl php-xml libapache2-mod-php
sudo a2enmod rewrite headers

# 2. Base de datos
sudo mysql -e "CREATE DATABASE project_cloud CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'pcloud'@'localhost' IDENTIFIED BY 'una-contraseña-segura';"
sudo mysql -e "GRANT ALL PRIVILEGES ON project_cloud.* TO 'pcloud'@'localhost'; FLUSH PRIVILEGES;"

# 3. Archivos
sudo mkdir -p /var/www/cloud
sudo unzip project-cloud-<versión>-installer.zip -d /var/www/cloud
sudo chown -R www-data:www-data /var/www/cloud
```

Crea el VirtualHost en `/etc/apache2/sites-available/cloud.conf`:

```apache
<VirtualHost *:80>
    ServerName cloud.tudominio.com
    DocumentRoot /var/www/cloud

    <Directory /var/www/cloud>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

```bash
sudo a2ensite cloud && sudo systemctl reload apache2

# 4. HTTPS
sudo apt install certbot python3-certbot-apache
sudo certbot --apache -d cloud.tudominio.com
```

Ajusta en `php.ini` los límites recomendados (`upload_max_filesize`, `post_max_size` ≥ 16M, `memory_limit` 256M+, `max_execution_time` 300) y abre `https://cloud.tudominio.com` para completar el asistente.

### 7.4 Tareas programadas (cron)

El cron ejecuta copias programadas, limpieza de subidas abandonadas, avisos de cuota, limpieza de registros y comprobación de actualizaciones. Prográmalo **cada minuto**:

```bash
# Plesk  → Tareas programadas → «Ejecutar un script PHP» → httpdocs/api/cron.php
# cPanel → Trabajos de Cron
php /home/<usuario>/public_html/api/cron.php

# VPS → crontab -e -u www-data
* * * * * php /var/www/cloud/api/cron.php >/dev/null 2>&1
```

Si el servidor no permite cron, usa un servicio externo contra `https://tu-dominio/api/v1/system/cron?token=<token>`. El token se genera en **Configuración → Cron**, donde también se ve el estado de cada tarea.

### 7.5 Después de instalar

- Configura el **correo SMTP** en *Configuración → Correo* y envía un correo de prueba.
- Define la **capacidad del servidor** y las **cuotas** por usuario.
- Personaliza **logo, nombre y colores** en *Configuración → Apariencia*.
- Activa las **copias de seguridad programadas**.

---

## 8. Desarrollo local (XAMPP)

En desarrollo el frontend corre en el servidor de Vite y la API en el servidor integrado de PHP. Vite reenvía todo `/api` a PHP, así que no hace falta configurar CORS.

```text
┌─────────────────────────────┐    /api/*     ┌──────────────────────────────┐
│  Vite · localhost:5173      │ ────────────► │  php -S · localhost:8000     │
│  React + HMR                │    (proxy)    │  api/index.php               │
└─────────────────────────────┘               └──────────────┬───────────────┘
                                                              │ PDO
                              ┌──────────────────────────────┐│
                              │  Apache · localhost:80       ││ ┌───────────────────────┐
                              │  sirve /storage (públicos)   │└►│ MySQL · localhost:3306│
                              └──────────────────────────────┘  └───────────────────────┘
```

| Servicio | Puerto | Para qué |
| :--- | :--- | :--- |
| Vite | `5173` | Frontend con recarga en caliente |
| PHP integrado | `8000` | API (`api/index.php`) |
| MySQL / MariaDB (XAMPP) | `3306` | Base de datos |
| Apache (XAMPP) | `80` | Sirve `/storage` para las URLs públicas y phpMyAdmin |

### 8.1 Requisitos

- **[XAMPP](https://www.apachefriends.org/)** con PHP **8.1 o superior** (incluye Apache, MariaDB y phpMyAdmin).
- **[Node.js](https://nodejs.org/) 18+** (recomendado 20 LTS) y npm.
- **Git**.

### 8.2 Clonar el repositorio

Clónalo dentro de `htdocs` para que Apache pueda servir la carpeta `storage/`:

```bash
cd C:/xampp/htdocs
git clone https://github.com/cmezquita25/project-cloud.git
cd project-cloud
```

### 8.3 Configurar PHP

Abre `C:\xampp\php\php.ini` y verifica que estas líneas **no** estén comentadas con `;`:

```ini
extension=pdo_mysql
extension=fileinfo
extension=mbstring
extension=openssl
extension=gd
extension=zip
extension=curl
extension=sodium
```

Comprueba que PHP esté en el `PATH` (o usa la ruta completa `C:\xampp\php\php.exe`):

```bash
php -v
php -m    # lista las extensiones activas
```

### 8.4 Crear la base de datos

1. Abre el **XAMPP Control Panel** e inicia **Apache** y **MySQL**.
2. Entra a `http://localhost/phpmyadmin` y crea una base de datos vacía llamada `project_cloud` con cotejamiento `utf8mb4_unicode_ci`, o desde consola:

```bash
C:/xampp/mysql/bin/mysql -u root -e "CREATE DATABASE project_cloud CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

No importes `schema.sql` a mano: lo aplica el asistente.

### 8.5 Levantar la API

En una terminal:

```bash
cd api
php -S localhost:8000 index.php
```

`index.php` actúa como router y recibe todas las peticiones `/api/*`. Comprueba que responde:

```bash
curl http://localhost:8000/api/v1/health
```

### 8.6 Levantar el frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`. La primera vez la app te redirige a **`/install`**.

### 8.7 Completar el asistente

Usa los valores por defecto de XAMPP:

| Campo | Valor |
| :--- | :--- |
| Host | `localhost` |
| Puerto | `3306` |
| Base de datos | `project_cloud` |
| Usuario | `root` |
| Contraseña | *(vacía)* |

Después crea tu usuario administrador.

### 8.8 Ajustar la configuración local

El asistente genera `api/config/config.php` (ignorado por Git). Edita estos dos valores para trabajar en local:

```php
'storage' => [
    'path'       => __DIR__ . '/../../storage',
    // URL donde Apache sirve la carpeta storage/ del repositorio
    'public_url' => 'http://localhost/project-cloud/storage',
    'chunk_size' => 4 * 1024 * 1024,
],

// Muestra el detalle de los errores y habilita CORS para localhost:5173
'env' => 'development',
```

> [!TIP]
> Para repetir la instalación desde cero, borra `api/config/config.php` y `api/config/install.lock` y vacía la base de datos.

### 8.9 Comandos disponibles

| Comando | Ubicación | Descripción |
| :--- | :--- | :--- |
| `npm run dev` | `frontend/` | Servidor de desarrollo en `:5173` |
| `npm run build` | `frontend/` | Sincroniza versión, compila (TypeScript + Vite) y deja en `frontend/dist` el sitio completo listo para subir (SPA + `api/` + `.htaccess`) |
| `npm run preview` | `frontend/` | Sirve el build compilado |
| `php -S localhost:8000 index.php` | `api/` | API en desarrollo |
| `php cron.php` | `api/` | Ejecuta las tareas programadas una vez |
| `node scripts/release/installer.mjs` | raíz | Genera el ZIP de instalación |
| `node scripts/release/build.mjs` | raíz | Empaqueta y firma una versión para el actualizador |
| `node scripts/release/verify.mjs` | raíz | Verifica el paquete firmado |

### 8.10 Convenciones

- **Alias de importación:** `@app`, `@features`, `@shared` y `@` (→ `src/`).
- **Nueva funcionalidad en el frontend:** crea `src/features/<nombre>/` con sus `components/`, `hooks/` y `services/`; lo reutilizable va a `src/shared/`.
- **Nuevo endpoint:** regístralo en `api/routes.php` → `Controller` → `Service` → `Repository`. Responde siempre con `Response` (envelope `{ success, data, error }`) y lanza `HttpException` para los errores.
- **Cambios de base de datos:** añade una migración `api/database/migrations/NNNN_descripcion.php` idempotente y solo aditiva, refleja el cambio en `schema.sql` y sube `schema` en `version.json`.
- **Versión:** la fuente única es `version.json`; no edites a mano `package.json` ni `api/version.php`.

---

## 9. Versiones y publicación

Las instalaciones consultan un `manifest.json` en el servidor de versiones y solo instalan paquetes **firmados con Ed25519**. El flujo resumido es:

```bash
# Una sola vez: genera el par de llaves (la privada nunca va al repositorio)
node scripts/release/keygen.mjs

# Cada versión
#  1. Sube version.json (version, schema, released_at)
#  2. Escribe release/notes/<versión>.json
#  3. Haz commit
node scripts/release/build.mjs
node scripts/release/verify.mjs
#  4. Sube release/out/ al servidor de versiones (manifest.json al final)
```

La guía completa está en [release/README.md](release/README.md) y las reglas de migraciones en [api/database/migrations/README.md](api/database/migrations/README.md).

---

## 10. Solución de problemas

| Síntoma | Causa probable | Solución |
| :--- | :--- | :--- |
| El login responde **500** en local | La API no está levantada y el proxy de Vite no encuentra `:8000` | Ejecuta `php -S localhost:8000 index.php` dentro de `api/` |
| **401** en todas las peticiones en producción | Apache no pasa la cabecera `Authorization` a PHP | Verifica que el `.htaccess` raíz esté presente y que `mod_rewrite` esté activo |
| **404** al recargar una ruta como `/admin` | `mod_rewrite` desactivado o `AllowOverride None` | Activa `mod_rewrite` y `AllowOverride All` |
| **503 NOT_INSTALLED** | No existe `api/config/config.php` | Completa el asistente en `/install` |
| El asistente marca *config/ o storage/ no escribible* | Permisos del sistema de archivos | Da permisos de escritura al usuario de PHP sobre `api/config/` y la raíz del sitio |
| Las imágenes públicas no cargan en local | `public_url` apunta a `https://localhost/storage` | Ajusta `public_url` según [8.8](#88-ajustar-la-configuración-local) |
| Subidas grandes fallan | Límites de PHP o del proxy | Revisa *Administración → Límites del servidor* y ajusta `post_max_size` / `upload_max_filesize` |
| Las tareas cron aparecen inactivas | El cron no está programado | Configúralo según [7.4](#74-tareas-programadas-cron) |

---

## 11. Roadmap

- [x] Vista previa de imágenes, vídeo, audio, PDF y texto
- [x] Enlaces compartidos temporales con contraseña y QR
- [x] Actualizaciones OTA firmadas con reversión
- [x] Copias de seguridad programadas y restauración con diagnóstico
- [ ] Refresh token en cookie `HttpOnly`
- [ ] Notificaciones en tiempo real (SSE)
- [ ] PWA con soporte offline
- [ ] Configuración de referencia para Nginx
- [ ] Suite de pruebas automatizadas y CI

---

<div align="center">

Desarrollado por **[Techmaleon](https://techmaleon.com.mx)** · Una nube verdaderamente tuya.

</div>
