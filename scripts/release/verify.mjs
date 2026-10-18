/**
 * Verifica un release generado, con las mismas comprobaciones que hará el
 * actualizador en cada instalación (firma, sha256 del ZIP y de cada archivo).
 *
 *   node scripts/release/verify.mjs [carpeta]    (por defecto release/out)
 */
import { verify } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { ROOT, publicKeyObject, readReleaseKeyPhp, sha256, signedMessage } from './lib.mjs'

const dir = resolve(ROOT, process.argv[2] ?? 'release/out')
const manifest = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8'))
const key = readReleaseKeyPhp()

const check = (ok, label) => {
  console.log(`${ok ? '✔' : '✖'} ${label}`)
  if (!ok) process.exitCode = 1
  return ok
}

check(manifest.signature?.key_id === key.keyId, `Key ID ${manifest.signature?.key_id}`)
check(
  verify(null, Buffer.from(signedMessage(manifest), 'utf8'), publicKeyObject(key.publicKey), Buffer.from(manifest.signature.value, 'base64')),
  'Firma Ed25519 del manifiesto'
)

const zip = readFileSync(resolve(dir, manifest.package.url))
check(zip.length === manifest.package.size_bytes, `Tamaño del ZIP (${zip.length} bytes)`)
check(sha256(zip) === manifest.package.sha256, 'sha256 del ZIP')

// Lee el directorio central para comprobar cada archivo contra release.json.
const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
const count = zip.readUInt16LE(eocd + 10)
let ptr = zip.readUInt32LE(eocd + 16)
const contents = new Map()
for (let i = 0; i < count; i++) {
  const method = zip.readUInt16LE(ptr + 10)
  const compSize = zip.readUInt32LE(ptr + 20)
  const nameLen = zip.readUInt16LE(ptr + 28)
  const extraLen = zip.readUInt16LE(ptr + 30)
  const commentLen = zip.readUInt16LE(ptr + 32)
  const localOffset = zip.readUInt32LE(ptr + 42)
  const name = zip.toString('utf8', ptr + 46, ptr + 46 + nameLen)
  const localNameLen = zip.readUInt16LE(localOffset + 26)
  const localExtraLen = zip.readUInt16LE(localOffset + 28)
  const start = localOffset + 30 + localNameLen + localExtraLen
  const body = zip.subarray(start, start + compSize)
  contents.set(name, method === 8 ? inflateRawSync(body) : body)
  ptr += 46 + nameLen + extraLen + commentLen
}

const release = JSON.parse(contents.get('release.json').toString('utf8'))
check(release.version === manifest.version, `release.json es de la versión ${release.version}`)
let bad = 0
for (const [name, meta] of Object.entries(release.files)) {
  const data = contents.get(name)
  if (!data || sha256(data) !== meta.sha256) bad++
}
check(bad === 0, `${Object.keys(release.files).length} archivos coinciden con release.json${bad ? ` (${bad} con error)` : ''}`)
check(contents.size === Object.keys(release.files).length + 1, 'El ZIP no contiene archivos fuera de release.json')
const unsafe = [...contents.keys()].filter((n) => n.includes('..') || n.startsWith('/') || !/^(public\/|api\/|release\.json$)/.test(n))
check(unsafe.length === 0, 'Rutas seguras (sin "..", absolutas ni fuera de public/ y api/)')

console.log(process.exitCode ? '\nEl release NO es válido.' : `\nRelease v${manifest.version} válido.`)
