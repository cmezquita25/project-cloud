/**
 * Sincroniza la versión de la app desde `version.json` (fuente única de verdad)
 * hacia el backend (`api/version.php`) y el package.json del frontend.
 *
 * El frontend la lee en tiempo de build desde vite.config.ts, así que basta con
 * editar `version.json` y ejecutar este script (lo hace `npm run build` solo).
 *
 *   node scripts/sync-version.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const info = JSON.parse(readFileSync(resolve(root, 'version.json'), 'utf8'))

if (!/^\d+\.\d+\.\d+$/.test(info.version)) {
  throw new Error(`version.json: "version" debe ser semver (x.y.z), recibido "${info.version}"`)
}
if (!Number.isInteger(info.schema) || info.schema < 1) {
  throw new Error('version.json: "schema" debe ser un entero positivo')
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(info.released_at)) {
  throw new Error('version.json: "released_at" debe tener formato YYYY-MM-DD')
}

const php = `<?php

declare(strict_types=1);

/**
 * Versión instalada de Project Cloud.
 * GENERADO por scripts/sync-version.mjs a partir de version.json — no editar a mano.
 */
return [
    'version'     => '${info.version}',
    'schema'      => ${info.schema},
    'released_at' => '${info.released_at}',
];
`
writeFileSync(resolve(root, 'api/version.php'), php)

const pkgPath = resolve(root, 'frontend/package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
if (pkg.version !== info.version) {
  pkg.version = info.version
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

console.log(`[sync-version] v${info.version} · schema ${info.schema} · ${info.released_at}`)
