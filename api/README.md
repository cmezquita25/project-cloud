# Project Cloud — API (PHP)

API REST en PHP 8.x vanilla (sin Composer), arquitectura en capas.

## Estructura

```
api/
├── public/          # ÚNICA carpeta expuesta por el servidor web
│   ├── index.php    # Front controller: recibe todas las peticiones /api/*
│   └── .htaccess    # Reescribe todo hacia index.php
├── src/
│   ├── Core/        # Router, Request, Response, Database (PDO), Jwt, Validator, Config
│   ├── Middleware/  # Auth, AdminOnly, RateLimit, Cors
│   ├── Controllers/ # Reciben la petición, delegan a Services, devuelven Response
│   ├── Services/    # Lógica de negocio (FileSystem, Auth, Quota, Upload…)
│   ├── Repositories/# Acceso a datos (PDO prepared statements)
│   └── Installer/   # Wizard de instalación
├── config/          # config.php (generado por el instalador) + install.lock
└── .htaccess        # Bloquea acceso directo a todo salvo public/
```

## Flujo de una petición

`/api/v1/...` → `public/index.php` → Router → Middleware → Controller → Service → Repository → Response JSON

## Estado

- **Fase 0 (actual):** estructura de carpetas + front controller stub con `/api/v1/health`.
- **Fase 1:** Core completo (Router, PDO, JWT, Validator) + esquema de BD + hardening.
- **Fase 2+:** instalador, autenticación, explorador, subidas, admin.

## Desarrollo local

```bash
php -S localhost:8000 -t public
# El proxy de Vite (vite.config.ts) redirige /api → localhost:8000
```
