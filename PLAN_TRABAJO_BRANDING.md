# Plan de trabajo: branding Invicter en Project Cloud

> **Objetivo:** llevar a Project Cloud el lenguaje visual de la landing `landing-ecosistema-invicter`: superficies *glass*, desenfoque, transparencias, degradados azul → cian, halos de luz y brillos en botones. Se aplica a botones, cards, menús flotantes, selects, dropdowns, diálogos, toasts y al marco de la app.
>
> **Restricciones:**
> 1. **No se rompe ninguna funcionalidad.** Solo cambian clases y estilos. No se toca lógica, estado, rutas, API, posicionamiento de capas ni manejadores de eventos.
> 2. **Se conservan los radios actuales de la plataforma** (`rounded-drive`, `rounded-pill`, `rounded-xl`, `rounded-2xl`, `rounded-lg`, `rounded-md`). Los radios de la landing (`2.2rem`, `1.5rem`, `rounded-golden`) **no** se traen.
> 3. **El white-label sigue funcionando.** Los colores que el admin configura en *Apariencia* deben seguir ganando.
> 4. **Dos estilos base seleccionables:** *Invicter* (azul → cian, por defecto) y *Clásico* (azul → morado, el actual). El admin elige cuál aplicar y, encima, puede seguir personalizando colores (§3.5).
>
> **Decisiones confirmadas:** Invicter por defecto con preset *Clásico* seleccionable (D1) · tema según el sistema (D2) · se **mantiene Poppins + Google Sans** (D3) · halos **animados solo en login** y estáticos detrás del glass en la app (D4) · login sin fotos de fondo (D5) · cursor glow solo en login, sin tilt ni reveal (D6) · estados en emerald/amber/red (D7) · tres configuraciones de color: Invicter, Clásico y Personalizado (D8).

---

## 1. Qué tenemos en cada lado

### 1.1 Landing (origen): el sistema visual que queremos

Fuente: `landing-ecosistema-invicter/src/index.css`, `tailwind.config.js`, `src/shared/components/**`.

| Pieza | Definición en la landing | Notas |
|---|---|---|
| **`.glass`** | `border: 1px rgba(255,255,255,.10)` · `background: linear-gradient(145deg, rgba(255,255,255,.07), rgba(255,255,255,.02))` · `backdrop-filter: blur(20px)` | Superficie estándar (cards, paneles) |
| **`.glass-strong`** | borde `.12` · gradiente `.10 → .03` · `blur(28px)` | Barras, modales, menús |
| **`.glass-subtle`** | borde `.07` · fondo `rgba(255,255,255,.03)` · `blur(12px)` | Chips, badges, campos de búsqueda |
| **`.glass-panel`** | borde `.12` · fondo **casi opaco** `rgba(9,14,30,.96)` · `blur(28px)` | Capas desplegables que deben leerse desde el primer frame |
| **`.glass-hover`** | hover: borde `rgba(96,165,250,.45)` + sombra `0 20px 60px -20px rgba(37,99,235,.45)` + brillo interior `inset 0 1px 0 rgba(255,255,255,.10)` | Transición `0.5s cubic-bezier(.16,1,.3,1)` |
| **Modo claro de glass** | blanco translúcido `rgba(255,255,255,.92 → .72)`, borde `rgba(15,23,42,.08)`, sombra `0 8px 30px rgba(15,23,42,.06)` | La landing usa `html.is-light`; aquí será lo opuesto (ver §3.2) |
| **Botón primario** | `bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500` · `bg-[length:200%_auto]` · `.btn-glow` | `.btn-glow`: sombra doble azul y cian, hover `translateY(-2px) scale(1.02) brightness(1.08)` |
| **Botón glass** | `glass-strong text-ink glass-hover hover:-translate-y-0.5` | Variante secundaria |
| **Texto degradado** | `.text-gradient`: `linear-gradient(100deg, blue-400, cyan-400 45%, indigo-400)` con `background-clip: text` | Títulos y cifras destacadas |
| **Inputs** | `border-white/10 bg-white/[0.04]` · foco `border-cyan-400/60 ring-2 ring-cyan-400/25` | Claro: `border-slate-900/10 bg-slate-900/[0.03]` |
| **Superficie de menú** (`MENU_SURFACE`) | `glass-strong p-1.5 shadow-[0_25px_80px_-15px_rgba(2,6,23,.9)] ring-1 ring-white/10` | Ítems: `hover:bg-white/[0.07]`, icono `text-cyan-300`, check de seleccionado en cian |
| **Overlay de modal** | `bg-slate-950/80 backdrop-blur-md` | |
| **Fondo** | `AuroraBackground`: rejilla `.grid-surface` con máscara radial + 3 halos `.orb` (blue-600/25, cyan-500/20, indigo-600/25) con `animate-aurora-drift` | Los halos son **degradado radial, no `filter: blur`** (decisión medida de rendimiento en Safari) |
| **Scrollbar** | thumb `linear-gradient(180deg, #1d4ed8, #0e7490)` · claro `#93c5fd → #67e8f9` | |
| **Selección de texto** | `rgba(37,99,235,.55)` | |
| **Animaciones** | `aurora-drift`, `gradient-x`, `shimmer`, `pulse-glow`, `ping-dot`, easing `out-expo` | Todas respetan `prefers-reduced-motion` |
| **Paleta de marca** | blue-600 `#2563eb`, blue-500 `#3b82f6`, cyan-500 `#06b6d4`, cyan-400 `#22d3ee`, indigo-400/600, amber-400 `#fbbf24` | Fondo oscuro base `#020617` (slate-950) |

### 1.2 Project Cloud (destino): cómo está construido hoy

| Aspecto | Estado actual | Impacto en el plan |
|---|---|---|
| **Tokens** | Todo pasa por variables CSS semánticas (`--color-surface`, `--color-primary`, `--color-gradient-start/end`…) en `src/index.css`, expuestas en `tailwind.config.ts` | ✅ **Gran ventaja.** La mayor parte del cambio se hace en tokens y en `shared/ui`, no archivo por archivo |
| **Modo oscuro** | Estrategia `class` (`.dark` en `<html>`), claro por defecto, con opción *sistema* | La landing es oscura por defecto (`.is-light` opcional). Hay que **invertir** la lógica de los overrides |
| **Design system** | `shared/ui/`: Button, IconButton, Input, Select, Menu, Dialog, BottomSheet, Tooltip, Toast, Checkbox, ProgressBar, Loader, Spinner, Pagination, Avatar, EmptyState | Punto de mayor palanca: cambiar ~16 archivos transforma toda la app |
| **White-label** | `usePlatformSettings` escribe `--color-primary`, `--color-gradient-start`, `--color-gradient-end` y `--color-btn-text` **inline en `<html>`** según lo que guarde el admin en *Apariencia*. Backend: `AdminController.php:609-630` guarda en un almacén clave-valor (`$settings->set/delete`) y `SettingsController.php:30+` lo publica en `/settings/public` | Resuelto con presets + personalización encima (§3.5). Se añade una clave nueva sin migrar la BD |
| **Superficies** | Material/Google Drive: `bg-surface` sólido (209 usos en 59 archivos), `border-border` (191 usos), `shadow-elevation-*` | Se resuelve mayoritariamente vía tokens + utilidades nuevas |
| **Radios** | `rounded-drive` (12px, 89 usos), `rounded-pill`, `rounded-xl`, `rounded-2xl` | **No se tocan** |
| **Tipografía** | Poppins (cuerpo) + Google Sans (títulos) | **Se mantiene** (D3). Solo se adoptan pesos y `letter-spacing: -0.025em` en títulos, si encajan |
| **Iconos** | `lucide-react` | Se mantienen. No se migra a Material Symbols |
| **Animación** | `framer-motion` (10 archivos), keyframes propios (`fade-in`, `scale-in`, `slide-*`) | Se conservan; solo se suman keyframes de la landing |
| **Gráficas** | ApexCharts con colores hex en duro (`#3b82f6`, grises) en `AdminCharts`, `UserContributionChart` | Se alinean a la paleta |
| **Hex en duro** | 106 apariciones en 9 archivos (charts, `kindMeta.ts`, `StoragePage`, `Avatar`, `EmailTemplateEditor`, `AppearanceSettings`) | Revisión puntual; los de tipo de archivo y plantillas de email **no** se tocan |
| **Glass existente** | Solo `AuthLayout` (tarjeta `bg-surface/90 backdrop-blur-md`) y overlays con `backdrop-blur-sm` | `AuthLayout` usa halos con `blur-2xl` + `mix-blend-multiply`, que se reemplazan por `.orb` |
| **Fondos disponibles** | `app-assets/Fondos/` (IMG1–IMG6) | Opcional como fondo de login (descartado, D5) |

### 1.3 Por qué no basta con "copiar las clases"

1. **El glass necesita algo detrás que desenfocar.** Hoy el `canvas` es un color plano. Si solo se pone `backdrop-blur` sobre un fondo liso, el resultado es un gris apagado. Primero hay que crear la **capa de fondo** (rejilla + halos), y después el glass luce (Fase 2).
2. **La plataforma es una herramienta de trabajo, no una página de marketing.** En la landing hay unas 76 superficies con blur. En el explorador puede haber **cientos de tarjetas** de archivo. Poner `backdrop-filter` a cada una hunde el rendimiento, y la landing ya lo midió en Safari: 12–14 fps. Por eso se definen **niveles** de glass (§3.3).
3. **`backdrop-filter` cambia cómo se posicionan los hijos `fixed`** (el elemento pasa a ser su bloque contenedor) y crea un nuevo contexto de apilamiento. Hay elementos `fixed` sin Portal que dependen de esto (§4).

### 1.4 Alcance: rediseño completo de la plataforma

El rediseño cubre **todas** las pantallas, capas y estados, no solo el login y el dashboard. Inventario según `app/router/AppRouter.tsx`:

| Zona | Rutas / piezas | Fase |
|---|---|---|
| **Instalación** | `/install`: `InstallWizard`, `Stepper`, `StepRequirements`, `StepDatabase`, `StepConfig`, `StepAdmin`, `StepDone` | 5 |
| **Acceso** (`AuthLayout`) | `/login`, `/forgot-password`, `/reset-password` | 2 + 5 |
| **Marco de la app** (`AppLayout`) | `Topbar`, `Sidebar` (+ drawer móvil), `Footer`, `NotificationBell`, `StorageIndicator`, `ThemeToggle`, menú de usuario | 2 |
| **Explorador** | `/`, `/folder/:id`: `ExplorerLayout`, `FileGridView`, `FileListView`, `Breadcrumbs`, `DetailsPanel`, `SortControl`, `ViewToggle`, `ItemActionsMenu`, `ShareDialog`, `PublicUrlsModal`, `DeleteDialog`, `MoveDialog`, `NamePromptDialog`, marquee | 4 |
| **Colecciones** | `/recent`, `/starred`, `/trash`, `/search` (+ `SearchFilterBar`): `library/ItemCollection` | 4 |
| **Recursos** | `/assets/*`: `AssetsPage`, `AssetsPermissionsDialog`, `BlockActionsDialog` | 5 |
| **Usuario** | `/quota` (`StoragePage`, `SharedItemsBentoCard`), `/profile`, `/notifications` | 5 |
| **Admin** | `/admin`, `/admin/users`, `/admin/activity`: `AdminCharts`, `UserContributionChart`, `UsersTable`, `UserFilters`, `UserFormDialog`, `PasswordResetDialog`, `ActivityList`, `ServerLimits`, `SmtpSettings`, `LogoUploader` | 5 |
| **Ajustes del admin** | `/admin/settings/*`: `SettingsLayout` + General, Appearance, Integrations, Cron, Email, EmailTemplates, EmailTemplateEditor, Workspace, Database | 5 + 6 |
| **Capas globales** | `PreviewModal`, `UploadDock`, `ReportBugDialog`, `Toast`, `Loader` y todo `shared/ui` | 3 + 5 |

Al cerrar la Fase 5 se repasa esta tabla completa; ninguna pantalla puede quedar con el estilo anterior.

---

## 2. Principios de implementación

1. **Tokens primero, componentes después, pantallas al final.** Cada fase deja la app funcional y desplegable.
2. **Solo `className` y CSS.** Si un cambio pide tocar JSX estructural (añadir un wrapper, por ejemplo), se justifica en el PR.
3. **Radios intocables.** Cuando una utilidad nueva de la landing traiga radio, se usa sin él. Ejemplo: `MENU_SURFACE` llega sin `rounded-[1.5rem]` y conserva el `rounded-xl` actual del `Menu`.
4. **El white-label se respeta.** Los brillos y degradados se derivan de `--color-gradient-start` / `--color-gradient-end` / `--color-primary`, nunca de hex fijos. Si el admin pone su marca, los halos y glows la siguen.
5. **Ambos temas.** Cada pieza se define para claro (base) y oscuro (`.dark`). El oscuro es donde el efecto brilla; el claro usa el glass blanco translúcido de la landing.
6. **Legibilidad antes que efecto.** Las capas que se abren encima del contenido (menús contextuales, selects, tooltips, bottom sheets) usan la variante **casi opaca** (`glass-panel`), como recomienda la propia landing.
7. **`prefers-reduced-motion`** apaga las animaciones nuevas (deriva de halos, `gradient-x`, `shimmer`).
8. **Nada de `will-change` permanente ni `filter: blur()` en halos**, por las lecciones de rendimiento documentadas en la landing.

---

## 3. Diseño técnico

### 3.1 Nuevos tokens (`frontend/src/index.css`)

Se **añaden** sin renombrar ninguno de los existentes:

```css
:root {
  /* Paleta Invicter como canales RGB (para <alpha-value>) */
  --c-blue-400: 96 165 250;   --c-blue-500: 59 130 246;   --c-blue-600: 37 99 235;
  --c-cyan-300: 103 232 249;  --c-cyan-400: 34 211 238;   --c-cyan-500: 6 182 212;
  --c-indigo-400: 129 140 248; --c-indigo-600: 79 70 229;

  /* Glass — modo claro (base en esta plataforma) */
  --glass-border: 15 23 42;        --glass-border-a: .08;
  --glass-from: 255 255 255;       --glass-from-a: .92;
  --glass-to: 255 255 255;         --glass-to-a: .72;
  --glass-shadow: 0 8px 30px rgb(15 23 42 / .06);
  --glass-panel-bg: 255 255 255;   --glass-panel-a: .97;

  /* Glows derivados de la marca (siguen al white-label y al preset) */
  --glow-a: var(--color-gradient-start);
  --glow-b: var(--color-gradient-end);
  --glow-c: var(--c-indigo-600);   /* tercer halo; el preset Clásico lo pasa a violeta */
}
.dark {
  --glass-border: 255 255 255;     --glass-border-a: .10;
  --glass-from: 255 255 255;       --glass-from-a: .07;
  --glass-to: 255 255 255;         --glass-to-a: .02;
  --glass-shadow: 0 25px 80px -15px rgb(2 6 23 / .9);
  --glass-panel-bg: 9 14 30;       --glass-panel-a: .96;
}
```

**Valores por defecto de marca** (preset *Invicter*; el preset *Clásico* está en §3.5):

| Token | Hoy (Google) | Propuesto (Invicter) |
|---|---|---|
| `--color-primary` (claro) | `26 115 232` `#1a73e8` | `37 99 235` `#2563eb` |
| `--color-primary` (oscuro) | `138 180 248` `#8ab4f8` | `96 165 250` `#60a5fa` |
| `--color-gradient-start` | `26 115 232` | `37 99 235` (blue-600) |
| `--color-gradient-end` | `147 51 234` (púrpura) | `6 182 212` (cyan-500) |
| `--color-focus` | azul Google | `34 211 238` (cyan-400) en oscuro / `37 99 235` en claro |
| `--color-canvas` (oscuro) | `2 6 23` | `2 6 23` (sin cambio, ya es slate-950) |
| `--color-surface` (oscuro) | `30 41 59` sólido | se mantiene para fallback; las piezas glass usan los tokens `--glass-*` |
| `--color-primary-subtle` (oscuro) | `30 58 95` | `37 99 235 / .18` aprox. (`30 50 100`) para que la selección se vea en azul Invicter |
| `--color-success / warning / danger` | Google | emerald-400 / amber-400 / red-400 en oscuro; emerald-600 / amber-500 / red-600 en claro |
| `<meta name="theme-color">` | `#1a73e8` | `#020617` (oscuro) / `#2563eb` |

### 3.2 Utilidades nuevas (`@layer components` en `index.css`)

Se portan desde la landing, **invertidas para `.dark`** y **sin radio**:

| Clase | Uso en Project Cloud |
|---|---|
| `.glass` | Cards de dashboard, stat cards, paneles de settings, `DetailsPanel` |
| `.glass-strong` | Topbar, Dialog, Toast, UploadDock, tarjeta de login |
| `.glass-subtle` | Barra de búsqueda, chips, badges, triggers de Select/SortControl/ViewToggle |
| `.glass-panel` | Menús contextuales, dropdowns, Select abierto, BottomSheet, Tooltip, NotificationBell |
| `.glass-hover` | Cards interactivas (hover con borde azul y glow) |
| `.glass-lite` *(nueva, solo aquí)* | Tarjetas repetidas del explorador: **mismo gradiente y borde, SIN `backdrop-filter`** (ver §3.3) |
| `.btn-glow` | Botón primario (sombra derivada de `--glow-a` / `--glow-b`) |
| `.text-gradient` | Títulos de página, cifras clave del admin y de almacenamiento |
| `.orb` | Halos del fondo (`radial-gradient(closest-side, currentColor, transparent)`) |
| `.grid-surface` | Rejilla técnica del fondo con máscara radial |
| `.input-glass` | Base compartida para `Input`, `Select`, búsqueda y `<select>` nativo |
| `.ring-glow-focus` | Foco: `border` cian 60% + `ring-2` cian 25% |

`tailwind.config.ts` → `extend`: keyframes `aurora-drift`, `gradient-x`, `shimmer`, `pulse-glow`, `ping-dot`; `transitionTimingFunction.out-expo`; colores `glow-a`/`glow-b` vía `rgb(var(--glow-a) / <alpha-value>)`.

### 3.3 Niveles de glass (rendimiento)

| Nivel | Dónde | `backdrop-filter` |
|---|---|---|
| **N1: marco** | Topbar, Sidebar, Footer, UploadDock, DetailsPanel | Sí (`blur 20–28px`) |
| **N2: capas** | Dialog, BottomSheet, Menu, Select, Toast, Tooltip, NotificationBell | Sí, pero con fondo casi opaco (`glass-panel`) en las que tapan contenido |
| **N3: tarjetas únicas** | Stat cards de Admin, bento de Storage, cards de Settings, tarjeta de login | Sí |
| **N4: repetidas** | Tarjetas de archivo/carpeta (`FileGridView`), filas (`FileListView`), `ItemCollection`, `UsersTable`, `ActivityList` | **No.** `glass-lite`: gradiente translúcido + borde + glow en hover, sin blur |

Las N4 siguen viéndose "glass" porque el marco (N1) y el fondo con halos ya dan profundidad. Así el explorador sigue fluido con 500+ elementos.

### 3.4 Fondo de la app (`AppBackdrop`)

Componente nuevo en `src/shared/ui/AppBackdrop.tsx`, port de `AuroraBackground`:

- `position: fixed; inset: 0; z-index: 0; pointer-events: none` renderizado **como hermano**, al inicio de `AppLayout` y `AuthLayout`. **Nunca envuelve** al contenido (§4).
- Rejilla `.grid-surface` + 3 halos `.orb` con color `text-glow-a/25`, `text-glow-b/20`, `text-glow-c/20`, para que sigan el preset y el white-label.
- Prop `animated` (D4):
  - **Login e instalador (`AuthLayout`):** `animated` → halos con `aurora-drift` (18s), igual que la landing, más cursor glow (D6).
  - **App autenticada (`AppLayout`):** halos **estáticos**. Siguen ahí porque el glass necesita color detrás para lucir: sin ellos, el blur de ventanas, cards, barras y menús se vería como un gris plano. Lo único que se quita es el movimiento.
- Halos con `.orb` (degradado radial), nunca `filter: blur()`. Si se anima, solo `transform`.
- `bg-canvas` del contenedor de contenido pasa a `bg-transparent` (o `bg-canvas/60` en claro) para que el fondo se vea.

**Por qué estáticos en la app.** Todo lo que se mueve detrás de una superficie con `backdrop-filter` obliga a recalcular su desenfoque en cada frame. Con halos quietos, el blur de Topbar, Sidebar, Dialogs, cards y menús se calcula una vez y solo se recalcula al hacer scroll. Así el glass se mantiene en toda la plataforma sin coste continuo ni choques con drag & drop o la selección por arrastre.

### 3.5 Presets de estilo + personalización (white-label)

**Modelo de prioridad** (de menor a mayor):

```
1. Preset por defecto: Invicter        (:root y .dark en index.css)
2. Preset elegido por el admin         ([data-theme-preset="classic"] en <html>)
3. Colores personalizados del admin    (variables inline en <html>, como hoy)
```

Así se cumplen las tres cosas: hay dos estilos base, el admin elige cuál aplicar, y la personalización actual sigue funcionando por encima del preset elegido.

**Valores de cada preset**

| Token | **Invicter** (default) | **Clásico** (el actual de la plataforma) |
|---|---|---|
| `--color-primary` claro / oscuro | `#2563eb` / `#60a5fa` | `#1a73e8` / `#8ab4f8` |
| `--color-gradient-start` | `#2563eb` (blue-600) | `#1a73e8` |
| `--color-gradient-end` | `#06b6d4` (cyan-500) | `#9333ea` (purple-600) |
| `--glow-c` (tercer halo) | `#4f46e5` (indigo-600) | `#7c3aed` (violet-600) |
| `--color-focus` claro / oscuro | `#2563eb` / `#22d3ee` | `#1a73e8` / `#8ab4f8` |
| `--color-primary-subtle` oscuro | azul Invicter profundo | `30 58 95` (actual) |
| `.text-gradient` | blue-400 → cyan-400 → indigo-400 | blue-400 → purple-400 → violet-400 |
| Scrollbar | `#1d4ed8 → #0e7490` | `#1d4ed8 → #7e22ce` |

Si prefieres que *Clásico* sea **morado violeta** en lugar del púrpura actual (`#9333ea`), basta con cambiar `--color-gradient-end` a `#7c3aed`. Es un único valor.

**Implementación**

| Capa | Cambio | Riesgo |
|---|---|---|
| **API** `AdminController.php` (bloque de colores, ~l. 609-630) | Aceptar la clave `theme_preset` con *whitelist* `['invicter', 'classic']`; vacío = `delete` (vuelve a Invicter). Registrar en `ActivityLogger` como el resto | Bajo: mismo patrón que `primary_color` |
| **API** `SettingsController.php` (~l. 30) | Publicar `theme_preset` en `/settings/public` | Bajo |
| **BD** | Ninguno: el almacén de settings es clave-valor | — |
| **Front** `usePlatformSettings.tsx` | Añadir `theme_preset` al tipo; poner/quitar `data-theme-preset` en `<html>`; guardarlo en `localStorage` (`pc-theme-preset`) | Bajo |
| **Front** `index.html` | En el script anti-FOUC que ya existe, leer `pc-theme-preset` y aplicar el atributo **antes del primer pintado**, para que no se vea Invicter un instante cuando el preset es Clásico | Bajo |
| **Front** `index.css` | Bloques `[data-theme-preset="classic"]` y `.dark[data-theme-preset="classic"]` con los valores de la tabla | Bajo |
| **Front** `AppearanceSettings.tsx` | Selector visual de preset (dos tarjetas con muestra de degradado, botón y halo) **encima** de los color pickers. Al elegir preset, los pickers muestran sus valores. *Restaurar* borra solo los colores personalizados y vuelve al preset elegido | Medio: probar todas las combinaciones (§7) |

---

## 4. Riesgos de romper funcionalidad y cómo se evitan

| # | Riesgo | Dónde | Mitigación |
|---|---|---|---|
| R1 | **`backdrop-filter`, `filter` o `transform` en un ancestro reubica los hijos `fixed`** | `useMarqueeSelection.tsx:104` (recuadro de selección por arrastre, `fixed` **sin Portal**, dentro de `ExplorerLayout`) · overlays del panel de detalles en `ExplorerLayout.tsx:699-707` e `ItemCollection.tsx:294-302` | **Regla:** nunca aplicar `backdrop-filter`/`filter`/`transform` a `<main>`, al wrapper de contenido de `AppLayout`, a `ExplorerLayout` ni a `ItemCollection`. El glass va en elementos **hoja** (la tarjeta, la barra), no en contenedores de vista. Prueba obligatoria: selección por arrastre con scroll |
| R2 | Halo/fondo encima de la UI captura clics | `AppBackdrop` | `pointer-events-none`, `z-0`, contenido en `relative z-10` |
| R3 | Menús translúcidos ilegibles sobre la rejilla de archivos | `Menu`, `Select`, menú contextual | `glass-panel` (≥ 96% opaco) en N2 |
| R4 | Se pierde el estado **seleccionado** o **drop-target** de archivos | `FileGridView.tsx:113-143`, `FileListView.tsx:96-105` | Se mantienen `ring-2 ring-primary` y `bg-primary-subtle`; solo se recalibra el token `primary-subtle`. Validar contraste en ambos temas |
| R5 | El white-label del admin deja de aplicarse, o el preset pisa los colores personalizados | `usePlatformSettings.tsx`, `AppearanceSettings.tsx`, `AdminController.php` | No se tocan los nombres de variable. Los colores inline siguen ganando al atributo de preset (§3.5). Probar la matriz: Invicter/Clásico × con/sin colores custom × claro/oscuro × restaurar |
| R12 | Fondo animado bajo glass baja los FPS | Login (D4) | Animación solo en `AuthLayout`, que tiene una sola tarjeta glass. En la app los halos son estáticos (§3.4) |
| R14 | Lag al cambiar de tema claro ↔ oscuro | Toda la app | **Resuelto:** el cambio de tema es instantáneo (`.theme-transition` apaga las transiciones en vez de interpolar 200ms) y las clases glass ya no transicionan su fondo. Con decenas de superficies con `backdrop-filter`, interpolar el fondo forzaba a recalcular cada desenfoque en cada frame |
| R13 | Parpadeo de preset al cargar (Invicter → Clásico) | Arranque | Preset en `localStorage` y aplicado en el script anti-FOUC de `index.html` |
| R6 | El blur anidado parpadea (*backdrop root*) | IconButtons glass dentro de Topbar glass | Lección de la landing (`glass-merged`): los hijos de una barra con blur **no** llevan su propio `backdrop-filter`, solo fondo translúcido |
| R7 | Caída de FPS en Safari/equipos modestos | Explorer, Admin | Niveles §3.3 · halos con `radial-gradient` (no `blur`) · sin `will-change` permanente · reemplazar `blur-2xl` + `mix-blend-multiply` de `AuthLayout` |
| R8 | El `<select>` nativo cae a fondo blanco en oscuro | 3 archivos con `<select>` | Regla base de la landing: `select, option { background: sólido; color-scheme }` por tema |
| R9 | Las animaciones de framer-motion chocan con transiciones CSS nuevas | `AuthLayout`, `ExplorerLayout`, diálogos | No se añade `transition-transform` a elementos animados por framer-motion; el hover de `.btn-glow` no se aplica a `motion.*` |
| R10 | `theme-transition` anima propiedades nuevas y produce flash | `ThemeProvider` | Las utilidades glass declaran su propia `transition` de `background`/`border-color`; se valida el cambio claro ↔ oscuro |
| R11 | El visor de previsualización pierde contraste | `PreviewModal` (`bg-black/90`) | Se mantiene el fondo negro (es visor de medios). Solo la barra superior y los botones de navegación pasan a `glass-subtle` oscuro |

---

## 5. Fases de trabajo

> Cada fase = 1 PR independiente, desplegable, con su checklist de regresión (§7). Rama sugerida: `feat/branding-invicter`.

### Fase 0: Preparación (sin cambios visibles)
- [ ] Crear rama y capturar **screenshots de referencia** (claro y oscuro, escritorio y móvil) de: Login, Instalador, Mi unidad (grid y lista), Detalles, Papelera, Recientes, Destacados, Búsqueda, Almacenamiento, Admin (dashboard, usuarios, settings ×9), Notificaciones, Perfil, Preview.
- [ ] Inventario final de hex en duro (`grep -rE "#[0-9a-fA-F]{6}" src`) clasificado en *se cambia* / *no se toca* (iconos por tipo de archivo, plantillas de email).
- [ ] Decisiones cerradas (§6): nada pendiente.

### Fase 1: Tokens y utilidades base ✅ (completada)
**Archivos:** `src/index.css`, `tailwind.config.ts`, `index.html` (meta `theme-color`).
- [x] Tokens de halo `--glow-a/b/c`, texto degradado `--text-gradient-*`, scrollbar `--scroll-*` y `--ease-out-expo` (§3.1). Los colores del glass quedaron como valores directos en cada clase (claro + `.dark`) en vez de tokens `--glass-*`: se leen mejor y no los cambia ningún preset.
- [x] Valores por defecto de marca → preset Invicter (claro y oscuro), estados emerald/amber/red (D7).
- [x] Preset Clásico en CSS: `:root[data-theme-preset='classic']` y `.dark[data-theme-preset='classic']`. Falta conectarlo (atributo en `<html>`, API, Apariencia) en la Fase 6.
- [x] Portadas `.glass`, `.glass-strong`, `.glass-subtle`, `.glass-panel`, `.glass-hover`, `.glass-lite`, `.input-glass`, `.btn-glow`, `.text-gradient`, `.orb`, `.grid-surface`, más las utilidades `.ring-glow-focus` y `.cursor-glow`. Ninguna fija `border-radius` (salvo `.orb`, que es un círculo decorativo).
- [x] Keyframes `aurora-drift`, `gradient-x`, `shimmer`, `pulse-glow`, `ping-dot` + curva `ease-out-expo`; se apagan con `prefers-reduced-motion`.
- [x] Scrollbar con degradado de marca, `::selection`, fondo sólido de `<option>` (R8), `theme-color` por tema.
- **Resultado visible:** cambia el color de marca en toda la app (azul Google → azul Invicter; el degradado del botón primario pasa de azul → morado a azul → cian), los colores de estado, la scrollbar y la selección. Las clases glass aún no se usan, así que Tailwind todavía no las incluye en el CSS compilado.
- **Ojo:** si en la base de datos ya hay colores guardados en *Apariencia*, siguen ganando (inline) y no se verá el cambio de marca hasta pulsar *Restaurar*.
- **Verificado:** `npm run build` (`tsc -b` + Vite) sin errores.

### Fase 2: Fondo y marco de la app ✅ (completada)
**Archivos:** nuevos `shared/ui/AppBackdrop.tsx` y `shared/ui/CursorGlow.tsx`; `AppLayout.tsx`, `AuthLayout.tsx`, `Topbar.tsx`, `Sidebar.tsx`, `Footer.tsx`, `StorageIndicator.tsx`.
- [x] `AppBackdrop` (rejilla + 3 halos `.orb` con `text-glow-a/b/c`) montado como hermano en `-z-10`, **estático** en `AppLayout` y `animated` en `AuthLayout`. No crea contexto de apilamiento, así que el orden de drawer, UploadDock y menús en Portal no cambia.
- [x] Wrapper de contenido de `AppLayout`: `bg-canvas` retirado (transparente). **Sin** filter/transform/backdrop (R1), con comentario en el código.
- [x] **Topbar:** `glass-strong` solo con borde inferior, sin z-index (el drawer sigue tapándola). Buscador `input-glass` + `ring-glow-focus` (conserva `rounded-pill`). Logo por defecto con degradado de marca y nombre de la organización con `text-gradient`.
- [x] **Sidebar:** `glass` (escritorio) / `glass-panel` (nueva prop `inDrawer` para el drawer móvil). Estados unificados en `ITEM_ACTIVE` (tinte degradado + anillo) e `ITEM_IDLE` (hover translúcido) para ítems, subítems, unidades y carpetas compartidas. Buscador móvil `input-glass`. Radios intactos.
- [x] `StorageIndicator`: tinte translúcido con anillo, sin blur (está dentro del sidebar glass, R6).
- [x] Footer: `glass` con borde superior. `ReportBugDialog` usa `Dialog` (Portal), así que no le afecta.
- [x] Drawer móvil: overlay `bg-overlay/70 backdrop-blur-md`.
- [x] **AuthLayout:** `AppBackdrop animated` + `CursorGlow` (sustituyen los halos `blur-2xl` + `mix-blend-multiply`); tarjeta `glass-strong`; botón de tema flotante `glass-strong glass-hover`; logo por defecto en degradado y nombre con `text-gradient`. Sin `bg-canvas` en el contenedor (taparía el fondo).
- ➡️ El brillo del botón **"Nuevo"** llega en la Fase 3 con la variante `primary` de `Button`, que lo aplica en toda la app.
- **Verificado:** `npm run build` sin errores; capturas del login en claro y oscuro con Chrome headless (build de producción, sin backend). Las pantallas con sesión no se pudieron capturar sin backend: quedan para la QA con la API levantada.

### Fase 3: Design system (`shared/ui`) ✅ (completada)
Mayor palanca: estas piezas aparecen en toda la app.

| Componente | Hecho | Se conservó |
|---|---|---|
| **Button** `primary` | Degradado de marca + `btn-glow` (halo, elevación al hover); `transition-all` para que el hover anime | `rounded-pill`, alturas, `loading`, iconos, API |
| **Button** `secondary` | `glass-lite glass-hover` (sin blur: vive dentro de diálogos glass) | |
| **Button** `tonal` / `ghost` | Tinte `primary/10` con anillo / velos translúcidos | |
| **Button** `danger` | Degradado `red-600 → red-500` con halo rojo | |
| **IconButton** | Velos translúcidos al hover; `active` con tinte de marca y anillo. Sin blur propio (R6) | radios, tamaños |
| **Input** | `input-glass` + `ring-glow-focus`; con error, borde y anillo rojos (no se usa el foco de marca para no tapar el rojo) | `rounded-drive`, `h-11`, label/hint/error, aria |
| **Select** (trigger) | `input-glass ring-glow-focus` + chevron que gira al abrir | `rounded-md`, API |
| **Menu** | Panel `glass-panel` + anillo; ítems con velo translúcido, icono en `text-primary`, `danger` con tinte rojo; separador translúcido | `rounded-xl`, Portal, posición, volteo, `maxHeight`, bottom sheet en móvil |
| **BottomSheet** | `glass-panel`, asa sticky con `bg-inherit`, overlay con blur | `rounded-t-2xl`, safe-area |
| **Dialog** | Panel `glass-strong` + anillo; overlay `bg-overlay/50` (claro) / `/80` (oscuro) con `backdrop-blur-md`; título `font-semibold` | `rounded-2xl`, tamaños, Escape, scroll lock |
| **Tooltip** | `glass-panel` con texto `content-primary` | `rounded-md`, Portal |
| **Toast** | `glass-strong` + anillo; caja de icono con halo de su tono; error en `red` (antes `rose`) e info con el color de marca | `rounded-xl`, posición, acción |
| **Checkbox** | Marcada: degradado de marca con halo; desmarcada: tinte translúcido | tamaño, radio, `indeterminate` |
| **ProgressBar** | Tono `primary` con degradado de marca y halo; pista translúcida | tonos de estado, modo indeterminado |
| **Spinner** | Nueva prop `tone: 'current' | 'brand'`. `current` (por defecto) no cambia: es el de los botones. `brand` dibuja el arco con el degradado de marca | API anterior intacta |
| **Loader** | Velo de la landing (`bg-canvas/80 backdrop-blur-[22px]`) + spinner `brand` | `z-toast`, mensaje |
| **Pagination** | Su `Select` ya no sobrescribe el estilo; flechas con tinte de marca al hover | |
| **EmptyState** | Icono en círculo `glass` con halo `.orb` detrás; título `font-semibold` | |
| **Avatar** | Sin cambios: los colores de las iniciales identifican a cada usuario | |

- ➡️ La barra con *shimmer* animado de la ProgressBar se deja fuera: añadía DOM y animación continua en subidas largas sin aportar información.
- ⚠️ **Pendiente para la Fase 5:** varios formularios del admin (`AdminPage`, `AdminCharts`, `SmtpSettings`, `UserFormDialog`, `ReportBugDialog`) pasan a `Select` su propio estilo antiguo (`bg-surface border-border-strong`), que gana al del componente. Se limpian en el barrido de campos de la Fase 5.
- **Verificado:** `npm run build` sin errores; capturas del login (oscuro) y de recuperar contraseña (claro) con los nuevos `Input`, `Checkbox` y `Button`.

### Fase 4: Explorador de archivos ✅ (completada; pendiente prueba funcional con backend)
**Archivos:** `ExplorerLayout`, `FileGridView`, `FileListView`, `Breadcrumbs`, `DetailsPanel`, `SortControl`, `ViewToggle`, `MoveDialog`, `ShareDialog`, `PublicUrlsModal`, `library/ItemCollection`, `TrashPage`, `SearchFilterBar`. (`ItemActionsMenu`, `DeleteDialog`, `NamePromptDialog`, `RecentPage`, `StarredPage` y `SearchPage` no tenían estilos propios: heredan de la Fase 3.)
- [x] Tarjetas de carpeta y archivo: `glass-lite glass-hover` (N4, **sin blur**). Miniatura sobre tinte translúcido; pie con borde translúcido.
- [x] **Estados funcionales intactos:** destino de soltado (`border-primary bg-primary/15 ring-2 ring-primary`), seleccionado (`border-primary bg-primary/10 ring-1 ring-primary/40`), acciones visibles en hover/foco. Los manejadores (`data-sel-key`, drag & drop, clic, doble clic, menú contextual) no se tocaron.
- [x] Lista y papelera: contenedor `glass-lite`, cabecera y filas con bordes translúcidos, hover translúcido, seleccionado `bg-primary/10`, destino de soltado con anillo.
- [x] `DetailsPanel` (explorador y colecciones): contenedor `glass-strong` en escritorio y en el drawer móvil (overlay con `backdrop-blur-sm`). Interiores con tintes y `glass-lite`.
- [x] `SortControl` y `ViewToggle`: `input-glass`; el modo activo de la vista lleva el degradado de marca. Breadcrumbs: hover translúcido y último nivel en `font-semibold`.
- [x] Barra de herramientas sticky en móvil: `bg-canvas/80` + blur **solo en `max-sm:`** (en escritorio no hay `backdrop-filter`, así no crea bloque contenedor). Botón «Seleccionar/Listo» con el degradado de marca cuando está activo.
- [x] Portada de Mi unidad: bienvenida con el nombre de la organización en `text-gradient`, buscador `glass` con foco de marca, accesos directos `glass-lite glass-hover`. Overlay de «Suelta para subir aquí» translúcido con blur.
- [x] Filtros de búsqueda: `glass-subtle`; activos con tinte de marca.
- [x] Diálogos: lista de carpetas de Mover y lista de URLs públicas en `glass-lite`; autocompletado de Compartir en `glass-panel`; filas de miembros `glass-lite glass-hover`; `<select>` de permisos con `input-glass`. Se corrigió de paso una clase inexistente (`bg-surface-variant/40`).
- [x] **R1 respetado:** ni `ExplorerLayout`, ni `ItemCollection`, ni el área de scroll llevan `backdrop-filter`/`filter`/`transform` nuevos; el recuadro de selección (`marqueeOverlay`) queda fuera de cualquier superficie glass.
- **Verificado:** `npm run build` sin errores; ningún resto de `bg-surface`, `bg-canvas` opaco, `shadow-elevation` o `primary-subtle` en explorador y colecciones.
- ⚠️ **Pendiente:** recorrido funcional real (marquee, drag & drop, menú contextual, grid/lista, detalles) con backend levantado; en local MySQL está apagado.

### Fase 5: Resto de features
- [ ] **UploadDock:** `glass-strong`, barra de progreso con degradado + shimmer.
- [ ] **NotificationBell:** panel `glass-panel`; badge con `ping-dot` cian.
- [ ] **PreviewModal:** barra y flechas `glass-subtle` oscuro (R11).
- [ ] **Almacenamiento** (`StoragePage`, bento): cards `glass` + `glass-hover`, cifra principal `text-gradient`, barras de cuota con degradado. `kindMeta.ts` (colores por tipo) **no se toca**.
- [ ] **Admin:** stat cards `glass`, `UsersTable` (N4), `UserFilters` (glass-subtle), `UserFormDialog`/`PasswordResetDialog` (heredan Dialog), `ServerLimits`, `SmtpSettings`, `LogoUploader`.
- [ ] **Gráficas ApexCharts:** paleta `['#2563eb', '#06b6d4', '#818cf8', '#34d399', '#fbbf24']`, fondo transparente, rejilla `rgba(148,163,184,.1)`, tooltip con `theme` según modo. Idealmente leídos de los tokens CSS en tiempo de ejecución para que sigan el white-label.
- [ ] **Settings del admin (×9 páginas):** paneles `glass`, navegación lateral con ítem activo en degradado.
- [ ] **Wizard de instalación** (`/install`). **No** usa `AuthLayout`: tiene su propio contenedor en `InstallWizard.tsx` (`bg-surface-container`). Recibe:
  - `AppBackdrop animated` + tarjeta `glass-strong`.
  - Logo y título con `text-gradient`.
  - `Stepper`: paso activo con degradado, completados con check en degradado, conector con relleno de degradado.
  - Los 5 pasos (`StepRequirements`, `StepDatabase`, `StepConfig`, `StepAdmin`, `StepDone`): Inputs, Buttons y listas de requisitos con estados ok/error en emerald/red.
  - ⚠️ Corre **antes** de que exista la BD, así que no hay settings ni preset: siempre se ve con Invicter (los defaults de `index.css`). No debe llamar a `usePlatformSettings` ni depender de él.
  - Probar el flujo completo de instalación en limpio (sin `config.php` ni `install.lock`).
- [ ] Notificaciones, Perfil, Soporte, Papelera, Recientes, Destacados, Búsqueda: revisar que heredan bien; ajustar los `bg-surface` sueltos a `glass` o `glass-lite` según §3.3.

### Fase 6: Presets de estilo, white-label y pantalla de Apariencia
Diseño completo en §3.5.

- [ ] **API:** `theme_preset` en `AdminController.php` (whitelist `invicter` | `classic`) y en `SettingsController.php` (`/settings/public`).
- [ ] **CSS:** bloques `[data-theme-preset="classic"]` (claro y oscuro) con los valores del preset Clásico.
- [ ] **`usePlatformSettings`:** aplicar el atributo `data-theme-preset` y cachearlo en `localStorage`.
- [ ] **`index.html`:** aplicar el preset en el script anti-FOUC (R13).
- [ ] **`AppearanceSettings.tsx`:**
  - Selector de preset con dos tarjetas: *Invicter* (azul → cian) y *Clásico* (azul → morado), cada una con muestra de botón, degradado y halo.
  - Debajo, los color pickers actuales (*personalización*), que muestran los valores del preset activo cuando no hay colores propios.
  - **Vista previa en vivo:** botón primario, card glass y halo con los valores en edición, antes de guardar.
  - *Restaurar colores* borra solo la personalización y vuelve al preset elegido; el preset se cambia desde su selector.
- [ ] Verificar la matriz de R5: Invicter/Clásico × con/sin personalización × claro/oscuro × restaurar.
- [ ] Detalle existente a revisar: `--color-primary` personalizado se escribe inline en `<html>` y anula también el valor de `.dark` (en oscuro queda el mismo tono que en claro). Fuera de alcance salvo que se pida; queda anotado.

### Fase 7: Animaciones inteligentes (entrada, salida y feedback)
> Pedido explícito: llevar a la plataforma las animaciones de la landing **con sentido**, no por decorar. Cada animación tiene que comunicar algo (qué apareció, de dónde viene, qué cambió) y nunca frenar una tarea repetitiva.

**Principios**
1. **Rápidas y con propósito.** Entradas de 180–320 ms con la curva `out-expo` de la landing; salidas más cortas (120–200 ms) que las entradas. Nada que bloquee la interacción mientras anima.
2. **Una sola librería por caso.** `framer-motion` (ya está en 10 archivos) para entrada/salida de componentes que se montan y desmontan (`AnimatePresence`); CSS (`transition`, keyframes de Tailwind) para hover, foco y estados.
3. **Solo `transform` y `opacity`** (y `filter: blur` únicamente en entradas puntuales, nunca en listas). Nada de animar tamaño, `top/left` ni sombras grandes en bucle.
4. **No animar lo que se repite por cientos.** Las tarjetas y filas del explorador no reciben animación individual al hacer scroll (como el `Reveal` de la landing): como mucho, un escalonado corto (máx. ~12 elementos, 25 ms entre cada uno) en la **primera** carga de una carpeta.
5. **Nunca sobre la funcionalidad:** sin `transform` en contenedores de vista (R1, recuadro de selección), sin animar durante drag & drop o marquee, sin retrasar el foco de teclado ni el cierre con Escape.
6. **`prefers-reduced-motion`:** todas las nuevas se reducen a un fundido corto o se desactivan (`MotionConfig reducedMotion="user"` de framer-motion + las reglas CSS ya existentes).

**Catálogo propuesto (de la landing → dónde aplica)**

| Animación de la landing | Uso en la plataforma | Detalle |
|---|---|---|
| **Velo de carga** (`veil-rise` / `veil-fall`) | `Loader` global y arranque (`RootGate`) | El contenido del velo sube al entrar y baja al salir; el fondo aparece de una vez |
| **Reveal blur-in** | Entrada de pantallas (cambio de ruta) | Fundido + `translateY(8px)` + blur 6px → 0 en ~280 ms, **solo** en el contenedor de página (no en hijos repetidos). Se aplica en un wrapper que **no** contiene el recuadro de selección |
| **Reveal fade-in-up escalonado** | Primera carga de una carpeta, tarjetas del dashboard admin, bento de Almacenamiento, tarjetas de Ajustes | Máx. ~12 elementos con 25–40 ms de escalonado; el resto aparece sin animación |
| **Zoom suave** (`scale .96 → 1`) | `Dialog`, `Menu`, `Select`, `Tooltip` (ya usan `animate-scale-in`) | Afinar a la curva `out-expo` y añadir **salida** (hoy desaparecen de golpe) con `AnimatePresence` |
| **Slide desde el borde** | Drawer móvil, `BottomSheet`, `DetailsPanel`, `UploadDock` | Ya existen; unificar duraciones y añadir salida donde falte |
| **Toasts con muelle** | `Toast` (ya con framer) | Mantener; sumar la caja del icono con un `pulse-glow` de una sola pasada al aparecer |
| **`ping-dot`** | Campana de notificaciones con pendientes; indicador "subiendo" del `UploadDock` | Punto con onda, solo mientras haya algo pendiente |
| **`gradient-x`** (degradado que se desplaza) | Botón primario mientras está en `loading`; barra de progreso de subidas activas | Indica actividad sin spinner extra; se detiene al terminar |
| **Hover glass** (`glass-hover`, `btn-glow`) | Ya aplicado en Fases 2–4 | Revisar coherencia de duraciones |
| **Brillo de cursor y halos animados** | Solo login e instalador (D4, D6) | Ya aplicado |
| **Contador animado de cifras** (estilo métricas de la landing) | Cifras del dashboard admin y de Almacenamiento | Cuenta rápida (~600 ms) solo la primera vez que se ven |
| **Transición entre vistas** | Cuadrícula ↔ lista (ya con `AnimatePresence`), pasos del wizard de instalación | Fundido cruzado corto; en el wizard, deslizamiento horizontal según avance/retroceso |
| **Salida del botón de tema** | `ThemeToggle` | Icono sol/luna que rota y se funde (el cambio de tema en sí sigue siendo instantáneo) |

**Archivos previstos:** `tailwind.config.ts` (keyframes `veil-rise/fall`, `reveal-*`), nuevo `shared/ui/motion.ts` (variantes y duraciones compartidas), `AppProviders.tsx` (`MotionConfig`), `AppLayout.tsx` (wrapper de página **fuera** del área del marquee), `Loader`, `Dialog`, `Menu`, `Select`, `Tooltip`, `BottomSheet`, `Toast`, `NotificationBell`, `UploadDock`, `ThemeToggle`, `InstallWizard`/`Stepper`, dashboard admin, `StoragePage`.

**QA específica:** el marquee, el drag & drop y el menú contextual funcionan igual con las animaciones activas; ninguna animación se dispara en bucle con la pestaña oculta; reduced-motion verificado; el cambio de tema sigue siendo instantáneo.

### Fase 8: QA, cierre y versión 2.0.0
- [ ] Recorrido completo con el checklist de §7 en **claro y oscuro**, **escritorio y móvil**, Chrome + Safari (o WebKit) + Firefox.
- [ ] Rendimiento: explorador con 500+ elementos, scroll y marquee a ≥ 50 fps; Lighthouse sin regresión.
- [ ] Contraste AA de textos sobre glass (sobre todo `content-tertiary` en claro).
- [ ] `prefers-reduced-motion` activo: sin animación de halos en login ni shimmer.
- [ ] `npm run build` (incluye `tsc -b`) sin errores.
- [ ] Comparar con los screenshots de la Fase 0.
- [ ] **Subir la versión de la app a `2.0.0`** al cerrar el plan: `APP_VERSION` en `frontend/src/shared/config/version.ts` (variable global que pinta el footer y el login) y `version` en `frontend/package.json`. Revisar si `getLastUpdatedLabel()` necesita fecha nueva.

---

## 6. Decisiones

### 6.1 Confirmadas

| ID | Decisión | Dónde se refleja |
|---|---|---|
| **D1** | Invicter (azul → cian) es el estilo **por defecto**. Se añade el preset **Clásico** (azul → morado, el actual) y el admin elige cuál aplicar en *Apariencia*. La personalización de colores **se mantiene** y funciona por encima del preset | §3.5, Fase 6, R5, R13 |
| **D2** | Tema **según el sistema**, como hoy. Ambos temas reciben el estilo glass | §2.5 |
| **D3** | **Se mantiene Poppins + Google Sans** | §1.2 |
| **D4** | Halos **animados solo en login/instalador**. En la app, halos **estáticos** detrás del glass. Glass y blur se mantienen en toda la plataforma: ventanas, cards, barras, menús, selects | §3.4, R12 |
| **D5** | Login sin fotos de `app-assets/Fondos/`: rejilla + halos, como la landing | §3.4, Fase 2 |
| **D6** | Cursor glow **solo en login**. Sin tilt 3D ni reveal en la app (interfieren con drag & drop, menú contextual y listas largas) | Fase 2 |
| **D7** | Colores de estado → emerald / amber / red de la landing (solo tokens) | §3.1 |
| **D8** | **Tres configuraciones de color:** **Invicter** (azul → cian, por defecto) · **Clásico** = el degradado actual de la plataforma, exactamente `#1a73e8 → #9333ea` (el del botón "Iniciar sesión") · **Personalizado** = los color pickers de hoy, encima de cualquiera de los dos | §3.5, Fase 6 |

Ya no quedan decisiones pendientes.

---

## 7. Checklist de regresión funcional (por PR)

**Autenticación:** login · logout · refresh de sesión · recuperar contraseña · wizard de instalación completo en limpio (requisitos, base de datos, configuración, admin, final).
**Explorador:** navegar carpetas · breadcrumbs · crear carpeta · subir (botón y drag & drop) · renombrar · mover · copiar · duplicar · eliminar · restaurar desde papelera · vaciar papelera · destacar · copiar URL pública · compartir · selección simple, múltiple (Ctrl/Shift) y **por arrastre (marquee)** · menú contextual (clic derecho) · menú de acciones (⋮) · vista grid ↔ lista · ordenar · panel de detalles (escritorio y drawer móvil) · unidades compartidas.
**Capas:** todos los Dialogs abren, cierran con Escape y overlay, y no hacen scroll de fondo · Menús no se cortan en bordes ni con zoom · Select elige valor · BottomSheet en < 768px · Tooltips · Toasts con acción · NotificationBell.
**Admin:** dashboard y gráficas · rango de fechas · usuarios (crear, editar, cuota, reset) · las 9 páginas de settings guardan · Apariencia: cambiar preset Invicter ↔ Clásico (sin parpadeo al recargar), guardar colores personalizados sobre cada preset, restaurar, logos.
**Otros:** previsualización (imagen, PDF, video, audio, texto) · almacenamiento · búsqueda (topbar y sidebar móvil) · cambio de tema claro ↔ oscuro ↔ sistema sin flash · GA4 sigue registrando.

---

## 8. Mapa rápido landing → Project Cloud

| Landing | Project Cloud |
|---|---|
| `html.is-light .x { … }` (claro como override) | `.x { claro }` + `.dark .x { oscuro }` |
| `text-ink` / `text-sub` / `text-faint` | `text-content-primary` / `-secondary` / `-tertiary` |
| `from-blue-600 via-blue-500 to-cyan-500` | `from-gradient-start via-primary to-gradient-end` (respeta white-label) |
| `text-blue-600/25` en `.orb` | `text-glow-a/25` |
| `MENU_SURFACE` (`rounded-[1.5rem]`) | `glass-panel ring-1 …` + **`rounded-xl` existente** |
| Modal `rounded-[2.2rem]` | Dialog **`rounded-2xl` existente** |
| Input `rounded-2xl` | Input **`rounded-drive` existente** |
| Botón `rounded-full` | Botón **`rounded-pill` existente** (equivalente) |
| `Material Symbols` | `lucide-react` (sin cambio) |
| `focus:ring-cyan-400/25` | `ring-glow-focus` (cian en oscuro, primario en claro) |

---

## 9. Estimación orientativa

| Fase | Esfuerzo | Riesgo |
|---|---|---|
| 0. Preparación | 0.5 día | — |
| 1. Tokens y utilidades | 0.5–1 día | Bajo |
| 2. Fondo y marco | 1 día | Medio (R1, R6) |
| 3. Design system | 1.5–2 días | Medio |
| 4. Explorador | 1.5 días | **Alto** (R1, R4, R7) |
| 5. Resto de features | 2 días | Bajo-medio |
| 6. Presets + white-label (API + front) | 1–1.5 días | Medio (R5, R13) |
| 7. Animaciones inteligentes | 1.5–2 días | Medio (R1, rendimiento) |
| 8. QA + versión 2.0.0 | 1 día | — |
| **Total** | **~11–12 días** | |

---

*Referencia de origen: `landing-ecosistema-invicter` (rama `cmezquita`, commit `1f35fae`). Plan generado el 2026-10-03.*
