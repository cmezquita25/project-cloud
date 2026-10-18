import QRCode from 'qrcode'

/**
 * QR generado en el navegador (sin servicios externos). Corrección de errores
 * nivel H: aguanta el logo de la organización tapando el centro (~20 %).
 */
const OPTIONS = { errorCorrectionLevel: 'H' as const, margin: 2, color: { dark: '#0f172aff', light: '#ffffffff' } }

/**
 * Logo (favicon de la organización) como data URL PNG reducido a 192 px, o
 * null si no hay. Reducido para que el SVG descargado no cargue con el
 * archivo original (un favicon puede pesar megas).
 */
export async function loadLogo(enabled: boolean): Promise<string | null> {
  if (!enabled) return null
  try {
    const res = await fetch('/api/v1/settings/logo/favicon')
    if (!res.ok) return null
    const bitmap = await createImageBitmap(await res.blob())
    const scale = Math.min(1, 192 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return canvas.toDataURL('image/png')
  } catch {
    return null // sin logo (o un SVG que el navegador no rasteriza): QR sin logo
  }
}

/** SVG del QR, con el logo al centro sobre un fondo blanco redondeado. */
export async function qrSvg(text: string, logo: string | null): Promise<string> {
  const svg = await QRCode.toString(text, { ...OPTIONS, type: 'svg' })
  if (!logo) return svg
  const size = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)?.[1] ?? 0)
  if (!size) return svg
  const box = size * 0.22
  const pad = size * 0.025
  const at = (size - box) / 2
  const overlay =
    `<rect x="${at - pad}" y="${at - pad}" width="${box + pad * 2}" height="${box + pad * 2}" rx="${pad * 1.5}" fill="#ffffff"/>` +
    `<image href="${logo}" x="${at}" y="${at}" width="${box}" height="${box}" preserveAspectRatio="xMidYMid meet"/>`
  return svg.replace('</svg>', overlay + '</svg>')
}

/** PNG del QR (para descargar), dibujando el SVG en un canvas. */
export async function qrPng(text: string, logo: string | null, px = 1024): Promise<Blob> {
  const svg = await qrSvg(text, logo)
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, 0, px, px)
  return await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar el PNG'))), 'image/png')
  )
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Nombre de archivo seguro a partir del nombre compartido. */
export function qrFilename(name: string, ext: 'png' | 'svg'): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 60) || 'enlace'
  return `${/^qr(-|$)/i.test(base) ? base : `QR-${base}`}.${ext}`
}
