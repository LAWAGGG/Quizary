/**
 * AuroraBg — motif background khas 21st: blob gradient blur lembut.
 * Dipakai sebagai lapisan dekoratif di hero/auth/public pages.
 */
export function AuroraBg({ base = '#6C5CE7', className = '' }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div className="aurora-blob w-72 h-72 -top-24 -left-24" style={{ backgroundColor: `${base}33` }} />
      <div className="aurora-blob w-80 h-80 -bottom-32 -right-20" style={{ backgroundColor: `${base}26` }} />
      <div className="aurora-blob w-52 h-52 top-1/3 right-1/4" style={{ backgroundColor: `${base}1f` }} />
    </div>
  )
}
