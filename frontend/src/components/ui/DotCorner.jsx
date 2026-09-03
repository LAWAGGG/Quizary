const POSITIONS = {
  'top-left': 'top-6 left-6',
  'top-right': 'top-6 right-6',
  'bottom-left': 'bottom-6 left-6',
  'bottom-right': 'bottom-6 right-6',
}

const FLIPS = {
  'top-left': '-scale-y-100',
  'top-right': '-scale-x-100',
  'bottom-left': '-scale-y-100',
  'bottom-right': '-scale-x-100',
}

export function DotCorner({ side = 4, filled = 4, color = '#6C5CE7', position = 'top-left', className = '' }) {
  const rows = []
  let idx = 0
  for (let r = 0; r < side; r++) {
    const row = []
    for (let c = 0; c <= r; c++) {
      row.push(idx < filled)
      idx++
    }
    rows.push(row)
  }

  return (
    <div className={`pointer-events-none absolute ${POSITIONS[position]} ${className}`} aria-hidden="true">
      <div className={`flex flex-col ${FLIPS[position]}`}>
        {rows.map((row, r) => (
          <div key={r} className="flex items-center">
            {row.map((isFilled, c) => (
              <span
                key={c}
                className="w-2 h-2 rounded-full border-2 mr-2 mb-2"
                style={{
                  borderColor: color,
                  backgroundColor: isFilled ? color : 'transparent',
                  opacity: isFilled ? 1 : 0.4,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
