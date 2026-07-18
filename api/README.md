# Project Cloud — API (PHP)

API REST en PHP 8.x vanilla (sin Composer), arquitectura en capas.

## Estructura

```
api/
├── index.php        # Front controller: recibe todas las peticiones /api/*
├── .htaccess        # Enruta a index.php; no deniega (evita 403 en Plesk)
├── bootstrap.php    # Autoloader (sin Composer) + carga de config
├── routes.php       # Definición de rutas
├── src/
│   ├── .htaccess    # Require all denied (protege el código fuente)
│   ├── Core/        # Router, Request, Response, Database (PDO), Jwt, Validator, Config
│   ├── Middleware/  # Auth, AdminOnly, RateLimit, Cors
│   ├── Controllers/ # Reciben la petición, delegan a Services, devuelven Response
│   ├── Services/    # Lógica de negocio (FileSystem, Auth, Quota, Upload…)
│   ├── Repositories/# Acceso a datos (PDO prepared statements)
│   └── Installer/   # Wizard de instalación
├── config/          # config.php (generado por el instalador) + install.lock
│   └── .htaccess    # Require all denied (protege credenciales)
└── storage.htaccess.dist  # Plantilla de hardening para /storage
```

Todo acceso a `/api/*` pasa por `index.php` (enrutado desde el `.htaccess` raíz).
`src/` y `config/` además se deniegan con sus propios `.htaccess` (defensa en
profundidad). No se usa denegación en `api/` para evitar 403 por conflicto de
override en Plesk.

## Flujo de una petición

`/api/v1/...` → `index.php` → Router → Middleware → Controller → Service → Repository → Response JSON

## Estado

- **Fase 0 (actual):** estructura de carpetas + front controller stub con `/api/v1/health`.
- **Fase 1:** Core completo (Router, PDO, JWT, Validator) + esquema de BD + hardening.
- **Fase 2+:** instalador, autenticación, explorador, subidas, admin.

## Desarrollo local

```bash
# index.php como router (simula el .htaccess que enruta /api → index.php)
php -S localhost:8000 index.php
# El proxy de Vite (vite.config.ts) redirige /api → localhost:8000
```
