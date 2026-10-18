/**
 * Genera un release firmado de Project Cloud.
 *
 *   node scripts/release/build.mjs [--skip-frontend] [--out <carpeta>] [--key <llave>]
 *
 * Pasos:
 *   1. Lee version.json y las notas release/notes/<versión>.json (obligatorias).
 *   2. Sincroniza api/version.php y compila el frontend (salvo --skip-frontend).
 *   3. Arma el paquete: public/ (frontend/dist + .htaccess raíz) y api/ (sin
 *      configuración, datos locales ni scripts de depuración).
 *   4. Escribe release.json con el sha256 de cada archivo y crea el ZIP.
 *   5. Firma el manifiesto con la llave privada Ed25519.
 *
 * La salida (por defecto release/out/) replica la carpeta del servidor de
 * versiones: se sube tal cual a techmaleon.com.mx/project-cloud/.
 */
import { execSync } from 'node:child_process'
import { createPrivateKey, createPublicKey, sign } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import {
  DEFAULT_KEY_PATH,
  PRODUCT,
  ROOT,
  collectPackageEntries,
  publicKeyInfo,
  readReleaseKeyPhp,
  releaseDescriptor,
  sha256,
  signedMessage,
} from './lib.mjs'
import { createZip } from './zip.mjs'

const args = process.argv.slice(2)
const argValue = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const skipFrontend = args.includes('--skip-frontend')
const outDir = resolve(argValue('--out') ?? resolve(ROOT, 'release/out'))
const keyPath = resolve(argValue('--key') ?? DEFAULT_KEY_PATH)

function fail(message) {
  console.error(`\n✖ ${message}`)
  process.exit(1)
}

const toPosix = (p) => p.split(sep).join('/')

// ── 1. Versión y notas ──────────────────────────────────────────────────────
const versionInfo = JSON.parse(readFileSync(resolve(ROOT, 'version.json'), 'utf8'))
const { version, schema, released_at: releasedAt } = versionInfo
const notesPath = resolve(ROOT, 'release/notes', `${version}.json`)
if (!existsSync(notesPath)) fail(`Faltan las notas del release: release/notes/${version}.json`)
const notes = JSON.parse(readFileSync(notesPath, 'utf8'))
for (const field of ['min_from_version', 'requirements', 'migrations', 'changelog', 'features']) {
  if (!(field in notes)) fail(`release/notes/${version}.json: falta "${field}"`)
}
if (!Array.isArray(notes.changelog) || notes.changelog.length === 0) fail('El changelog no puede estar vacío.')

// ── 2. Llave de firma (antes de compilar: si falta, no perder tiempo) ───────
if (!existsSync(keyPath)) fail(`No se encontró la llave privada en ${keyPath}. Ejecuta scripts/release/keygen.mjs.`)
const privateKey = createPrivateKey(readFileSync(keyPath))
const embedded = readReleaseKeyPhp()
const derived = publicKeyInfo(createPublicKey(privateKey))
if (derived.publicKey !== embedded.publicKey) {
  fail('La llave privada no corresponde a la pública de api/src/Updater/ReleaseKey.php. Las instalaciones rechazarían este paquete.')
}

console.log(`▶ Release ${PRODUCT} v${version} (schema ${schema})`)

const dirty = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim()
if (dirty) console.warn('⚠ Hay cambios sin commit: el paquete incluye el estado actual del disco, no el último commit.')

// ── 3. Compilación ──────────────────────────────────────────────────────────
execSync('node scripts/sync-version.mjs', { cwd: ROOT, stdio: 'inherit' })
if (!skipFrontend) {
  console.log('▶ Compilando el frontend…')
  execSync('npm run build', { cwd: resolve(ROOT, 'frontend'), stdio: 'inherit' })
}
// ── 4. Archivos del paquete (los mismos que lleva frontend/dist) ────────────
/** @type {{ name: string, data: Buffer }[]} */
let entries
try {
  entries = collectPackageEntries()
} catch (err) {
  fail(err.message)
}
const releaseJson = releaseDescriptor(entries, versionInfo)
entries.push({ name: 'release.json', data: Buffer.from(JSON.stringify(releaseJson, null, 2)) })

// ── 5. ZIP, firma y manifiesto ──────────────────────────────────────────────
const zip = createZip(entries, new Date(`${releasedAt}T12:00:00`))
const zipName = `${PRODUCT}-${version}.zip`

rmSync(outDir, { recursive: true, force: true })
mkdirSync(resolve(outDir, 'releases'), { recursive: true })
writeFileSync(resolve(outDir, 'releases', zipName), zip)

const manifest = {
  product: PRODUCT,
  version,
  released_at: releasedAt,
  schema,
  min_from_version: notes.min_from_version,
  requirements: notes.requirements,
  package: {
    url: `releases/${zipName}`, // relativa a manifest.json
    size_bytes: zip.length,
    sha256: sha256(zip),
  },
  migrations: notes.migrations,
  changelog: notes.changelog,
  features: notes.features,
}
manifest.signature = {
  alg: 'ed25519',
  key_id: embedded.keyId,
  value: sign(null, Buffer.from(signedMessage(manifest), 'utf8'), privateKey).toString('base64'),
}

writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
writeFileSync(
  resolve(outDir, '.htaccess'),
  `# Servidor de versiones de Project Cloud.
Options -Indexes
<Files "manifest.json">
    <IfModule mod_headers.c>
        Header set Cache-Control "no-cache, no-store, must-revalidate"
    </IfModule>
</Files>
`
)

const mb = (zip.length / 1024 / 1024).toFixed(2)
console.log(`\n✔ Release listo en ${outDir}`)
console.log(`  manifest.json`)
console.log(`  releases/${zipName}  (${mb} MB, ${entries.length} archivos)`)
console.log(`  sha256 ${manifest.package.sha256}`)
console.log(`\nVerifica con:  node scripts/release/verify.mjs ${toPosix(relative(ROOT, outDir)) || '.'}`)
console.log(`Publica subiendo el CONTENIDO de esa carpeta a techmaleon.com.mx/project-cloud/ (incluido .htaccess).`)
console.log(`Sube primero el ZIP y al final manifest.json, para que nadie vea la versión antes de que el paquete exista.`)

const stats = statSync(resolve(outDir, 'releases', zipName))
if (stats.size !== zip.length) fail('El ZIP escrito no coincide con el generado.')
