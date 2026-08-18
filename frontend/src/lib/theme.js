const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)))

export function hexToRgb(hex) {
  const h = (hex || '#6C5CE7').replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`
}

export function mixHex(a, b, t) {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  })
}

export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/**
 * Derive a full set of related shades + gradients from a single theme color,
 * so interactive UI never reuses the exact same hex everywhere.
 * `dark` makes the tinted tokens (soft/border/light) mix toward the dark
 * surface instead of white, so themed pages stay readable in dark mode.
 */
export function themePalette(hex, dark = false) {
  const base = hex || '#6C5CE7'
  const onBase = luminance(base) > 0.62 ? '#1F2937' : '#FFFFFF'
  const tint = dark ? '#0F172A' : '#FFFFFF'
  return {
    base,
    onBase,
    light: mixHex(base, tint, dark ? 0.22 : 0.55),
    soft: mixHex(base, tint, dark ? 0.1 : 0.88),
    border: mixHex(base, tint, dark ? 0.42 : 0.72),
    dark: mixHex(base, '#000000', 0.28),
    blobLight: mixHex(base, '#FFFFFF', 0.35),
    blobDark: mixHex(base, '#000000', 0.3),
    gradient: `linear-gradient(160deg, ${mixHex(base, '#FFFFFF', 0.12)} 0%, ${base} 48%, ${mixHex(base, '#000000', 0.32)} 100%)`,
    cta: `linear-gradient(135deg, ${mixHex(base, '#FFFFFF', 0.08)} 0%, ${base} 45%, ${mixHex(base, '#000000', 0.24)} 100%)`,
    pageBg: `linear-gradient(180deg, ${mixHex(base, '#FFFFFF', 0.9)} 0%, #F4F5F7 340px)`,
  }
}
