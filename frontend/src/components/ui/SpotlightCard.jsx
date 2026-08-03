import { useRef } from 'react'

/**
 * SpotlightCard — khas 21st: radial gradient yang mengikuti kursor mouse.
 * Warna glow diambil dari token primary agar konsisten dengan tema.
 */
export function SpotlightCard({ children, className = '', color = '108,92,231', intensity = 0.08, ...props }) {
  const ref = useRef(null)

  const onMouseMove = (e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`)
    el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`)
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      className={`spotlight-card ${className}`}
      style={{
        '--spot-glow': `radial-gradient(320px circle at var(--spot-x,50%) var(--spot-y,50%), rgb(${color} / ${intensity}), transparent 60%)`,
      }}
      {...props}
    >
      <div className="relative z-[1] h-full">{children}</div>
    </div>
  )
}
