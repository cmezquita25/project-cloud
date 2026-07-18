# ☁️ Project Cloud

Clon de Google Drive auto-hosteado en Plesk. Frontend React + TypeScript + Tailwind (build estático) y backend API en PHP vanilla sobre MySQL.

> **URL de producción:** `https://drive.techmaleon.mx`
> **Plan de trabajo completo:** ver [PLAN.md](./PLAN.md)

## Estructura del monorepo

```
proyecto-cloud/
├── PLAN.md          # Hoja de ruta por fases
├── frontend/        # React + TS + Vite + Tailwind (Screaming Architecture)
├── api/             # API PHP vanilla en capas
├── database/        # schema.sql
└── docs/            # DEPLOY.md y otra documentación
```

## Desarrollo (frontend)

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/ para subir a Plesk
```

## Desarrollo (API)

```bash
cd api
php -S localhost:8000 -t public
```

El proxy de Vite redirige `/api` → `localhost:8000` en desarrollo.

## Estado del proyecto

**Fase 0 completada:** fundaciones y design system.
- ✅ Monorepo (frontend Vite + estructura API).
- ✅ Theme tokenizado (paleta Google Drive, modo claro/oscuro).
- ✅ Design system base (Button, Menu, Dialog, BottomSheet, Toast…).
- ✅ Layout clon de Drive (topbar, sidebar, drawer móvil).
- ✅ Router con rutas placeholder.

Siguientes fases en [PLAN.md](./PLAN.md).
