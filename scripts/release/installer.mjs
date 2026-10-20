/**
 * Genera el ZIP del instalador de Project Cloud (instalaciones nuevas).
 *
 *   node scripts/release/installer.mjs [--skip-frontend] [--out <carpeta>]
 *
 * El ZIP trae la plataforma completa SIN configuración ni datos (sin config.php,
 * install.lock, storage/ ni copias de seguridad). Se sube a la raíz del dominio
 * (httpdocs / public_html), se descomprime ahí mismo y, al abrir el dominio,
 * arranca el asistente web de instalación. Los archivos van en la raíz del ZIP,
 * sin carpeta contenedora.
 *
 * Contiene exactamente lo mismo que frontend/dist (ver siteEntries en lib.mjs),
 * incluido api/var/release.json para que la instalación pueda actualizarse
 * después desde el panel. No necesita la llave de firma.
 *
 * La salida (por defecto release/installer/) va aparte de release/out/: el
 * instalador NO se publica en el servidor de versiones.
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { PRODUCT, ROOT, collectPackageEntries, siteEntries } from './lib.mjs'
import { createZip } from './zip.mjs'

const args = process.argv.slice(2)
const argValue = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const skipFrontend = args.includes('--skip-frontend')
const outDir = resolve(argValue('--out') ?? resolve(ROOT, 'release/installer'))

function fail(message) {
  console.error(`\n✖ ${message}`)
  process.exit(1)
}

const toPosix = (p) => p.split(sep).join('/')

const versionInfo = JSON.parse(readFileSync(resolve(ROOT, 'version.json'), 'utf8'))
const { version, released_at: releasedAt } = versionInfo
console.log(`▶ Instalador ${PRODUCT} v${version}`)

const dirty = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim()
if (dirty) console.warn('⚠ Hay cambios sin commit: el instalador incluye el estado actual del disco, no el último commit.')

// ── Compilación ─────────────────────────────────────────────────────────────
execSync('node scripts/sync-version.mjs', { cwd: ROOT, stdio: 'inherit' })
if (!skipFrontend) {
  console.log('▶ Compilando el frontend…')
  execSync('npm run build', { cwd: resolve(ROOT, 'frontend'), stdio: 'inherit' })
} else {
  // Sin compilar, frontend/dist debe ser de esta misma versión.
  const distRelease = resolve(ROOT, 'frontend/dist/api/var/release.json')
  const built = existsSync(distRelease) ? JSON.parse(readFileSync(distRelease, 'utf8')).version : null
  if (built !== version) fail(`frontend/dist es de la versión ${built ?? 'desconocida'}, no de la ${version}. Compila sin --skip-frontend.`)
}

// ── Paquete ─────────────────────────────────────────────────────────────────
let entries
try {
  entries = siteEntries(collectPackageEntries(), versionInfo)
} catch (err) {
  fail(err.message)
}

const zip = createZip(entries, new Date(`${releasedAt}T12:00:00`))
const zipName = `${PRODUCT}-${version}-installer.zip`
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, zipName), zip)

const mb = (zip.length / 1024 / 1024).toFixed(2)
console.log(`\n✔ Instalador listo: ${toPosix(relative(ROOT, resolve(outDir, zipName)))}  (${mb} MB, ${entries.length} archivos)`)
console.log(`Súbelo a la raíz del dominio (httpdocs / public_html), descomprímelo ahí y abre el dominio: arranca el asistente.`)
